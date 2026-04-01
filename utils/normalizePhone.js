export function normalizePhone(phone) {
  let cleaned = phone.replace(/\D/g, "");

  // Convert Nigerian numbers
  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.slice(1);
  }

  if (!cleaned.startsWith("234")) {
    throw new Error("Invalid Nigerian phone number");
  }

  return cleaned;
}