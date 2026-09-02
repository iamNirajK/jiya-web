import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageViewerModalProps {
  imageUrl: string | null;
  caption?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  imageUrl,
  caption,
  onClose,
}) => {
  const [scale, setScale] = useState(1);

  if (!imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `jiya-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-md select-none p-4">
        {/* Top Control Bar */}
        <div className="w-full max-w-2xl flex items-center justify-between z-10 py-2">
          <div className="text-white/80 text-xs font-medium truncate max-w-xs">
            {caption || 'Shared Image'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.5))}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(1, s - 0.5))}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download Image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
          <motion.img
            src={imageUrl}
            alt="Expanded view"
            style={{ transform: `scale(${scale})` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl transition-transform"
          />
        </div>

        {/* Optional Caption Bar */}
        {caption && (
          <div className="w-full max-w-md py-3 text-center text-white/90 text-xs bg-white/10 backdrop-blur-md rounded-2xl px-4 mt-2">
            {caption}
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
