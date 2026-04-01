export function generatePublicId(prefix) {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();

  return `${prefix}-${random}${timestamp.slice(-3)}`;
}