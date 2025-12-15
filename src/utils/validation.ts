export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  // Remove spaces and ensure +63 format
  const cleaned = phone.replace(/\s/g, '');
  // Must start with +63 and have 9 digits after (total 12 digits: +63 + 9XXXXXXXXX)
  const phoneRegex = /^\+63[9]\d{9}$/;
  return phoneRegex.test(cleaned);
};

// Format phone number to +63 format
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If empty or just +, return +63
  if (!cleaned || cleaned === '+') {
    return '+63';
  }
  
  // If it already starts with +63, limit to 13 characters and return
  if (cleaned.startsWith('+63')) {
    return cleaned.length > 13 ? cleaned.substring(0, 13) : cleaned;
  }
  
  // If it starts with 0, replace with +63
  if (cleaned.startsWith('0')) {
    cleaned = '+63' + cleaned.substring(1);
  }
  // If it starts with 63 (without +), add +
  else if (cleaned.startsWith('63')) {
    cleaned = '+' + cleaned;
  }
  // If it starts with 9, add +63 prefix
  else if (cleaned.startsWith('9')) {
    cleaned = '+63' + cleaned;
  }
  // Otherwise, add +63 prefix (remove any existing + or 63)
  else {
    cleaned = '+63' + cleaned.replace(/^\+?63?/, '');
  }
  
  // Limit to 13 characters (+63 + 10 digits = 13 total)
  if (cleaned.length > 13) {
    cleaned = cleaned.substring(0, 13);
  }
  
  return cleaned;
};

export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validateMinLength = (value: string, min: number): boolean => {
  return value.length >= min;
};

export const validateLicenseNumber = (license: string): boolean => {
  return license.trim().length >= 8;
};

export const validatePlateNumber = (plate: string): boolean => {
  const plateRegex = /^[A-Z]{1,3}[0-9]{1,4}$/;
  return plateRegex.test(plate.replace(/\s/g, '').toUpperCase());
};





