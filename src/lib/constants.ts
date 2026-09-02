export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/**
 * Calculates age in full years from a YYYY-MM-DD string
 */
export function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 && age <= 130 ? age : null;
}

/**
 * Validates whether a DOB string is valid and in the past
 */
export function validateDOB(dobString: string): { isValid: boolean; error?: string } {
  if (!dobString) {
    return { isValid: false, error: 'Date of birth is required' };
  }

  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }

  const now = new Date();
  if (birthDate > now) {
    return { isValid: false, error: 'Date of birth cannot be in the future' };
  }

  const age = calculateAge(dobString);
  if (age === null || age < 5) {
    return { isValid: false, error: 'Please provide a valid date of birth' };
  }

  return { isValid: true };
}
