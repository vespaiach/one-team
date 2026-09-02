const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  if (value.length === 0) {
    return "Enter your email address.";
  }
  if (!EMAIL_SHAPE.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}