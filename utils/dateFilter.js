export function getDateRange(filter) {
  const now = new Date();

  let start;

  switch (filter) {
    case "daily":
      start = new Date(now.setHours(0, 0, 0, 0));
      break;

    case "weekly":
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;

    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;

    case "quarterly":
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      break;

    default:
      start = new Date(0); // all time
  }

  return { $gte: start, $lte: new Date() };
}