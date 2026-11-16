const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidPassword(value: string) {
  return value.length >= 8;
}

export function isValidVisibleName(value: string) {
  return value.trim().length >= 2;
}
