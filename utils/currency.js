export function formatCurrency(amount) {
  const num = parseFloat(amount || 0).toFixed(2);
  const [integer, decimal] = num.split(".");
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `NGN ${formatted}.${decimal}`; // use NGN text instead of symbol
}