const VALID_PREFIXES = ["070", "080", "081", "090", "091"];

export function normalizePhone(phone) {
  let cleaned = phone.replace(/\D/g, "");

  // Convert +234 / 234 → 0
  if (cleaned.startsWith("234")) {
    cleaned = "0" + cleaned.slice(3);
  }

  // Must start with 0
  if (!cleaned.startsWith("0")) {
    throw new Error("Invalid Nigerian phone number");
  }

  // Must be exactly 11 digits
  if (cleaned.length !== 11) {
    throw new Error("Invalid Nigerian phone number length");
  }

  // Validate prefix
  if (!VALID_PREFIXES.some(prefix => cleaned.startsWith(prefix))) {
    throw new Error("Invalid Nigerian phone number ");
  }

  return cleaned;
}