/**
 * Synthesized Web Audio Service for Jiya
 * Produces crisp phone dial tones, incoming ringtones, call connected/ended chimes, and message pops.
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;
  private dialInterval: number | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Unlock Web Audio on first user interaction
   */
  unlockAudio() {
    this.initCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Play a pleasant two-tone incoming message pop chime
   */
  playMessageChime() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.frequency.setValueAtTime(880, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22); // D6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Play continuous ringing for incoming call
   */
  startIncomingRingtone() {
    this.stopAll();
    this.initCtx();

    const playBurst = () => {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        o1.type = 'sine';
        o2.type = 'sine';

        // Dual melodic modern ringtone: 440Hz (A4) + 480Hz & 853Hz
        o1.frequency.setValueAtTime(659.25, now); // E5
        o1.frequency.setValueAtTime(880, now + 0.2); // A5
        o2.frequency.setValueAtTime(523.25, now); // C5
        o2.frequency.setValueAtTime(659.25, now + 0.2); // E5

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
        gain.gain.setValueAtTime(0.22, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        o1.connect(gain);
        o2.connect(gain);
        gain.connect(this.ctx.destination);

        o1.start(now);
        o2.start(now);
        o1.stop(now + 0.6);
        o2.stop(now + 0.6);
      } catch (e) {
        console.warn('Ringtone burst error:', e);
      }
    };

    playBurst();
    this.ringtoneInterval = window.setInterval(playBurst, 1500);
  }

  /**
   * Play periodic standard dial tone while waiting for receiver to pick up
   */
  startOutgoingDialTone() {
    this.stopAll();
    this.initCtx();

    const playDialTone = () => {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        o1.type = 'sine';
        o2.type = 'sine';

        o1.frequency.setValueAtTime(440, now);
        o2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

        o1.connect(gain);
        o2.connect(gain);
        gain.connect(this.ctx.destination);

        o1.start(now);
        o2.start(now);
        o1.stop(now + 1.3);
        o2.stop(now + 1.3);
      } catch (e) {
        console.warn('Dial tone error:', e);
      }
    };

    playDialTone();
    this.dialInterval = window.setInterval(playDialTone, 3000);
  }

  /**
   * Call connected chime
   */
  playCallConnected() {
    this.stopAll();
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  /**
   * Call ended / busy tone
   */
  playCallEnded() {
    this.stopAll();
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.setValueAtTime(360, now + 0.15);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  stopAll() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.dialInterval) {
      clearInterval(this.dialInterval);
      this.dialInterval = null;
    }
  }
}

export const audioService = new AudioService();
