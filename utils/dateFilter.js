import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  format,
} from "date-fns";

export function getDateRange(filter, startDate, endDate) {
  const now = new Date();

  switch (filter) {
    case "daily":
      return { $gte: startOfDay(now), $lte: endOfDay(now) };

    case "weekly":
      return {
        $gte: startOfWeek(now, { weekStartsOn: 1 }),
        $lte: endOfWeek(now, { weekStartsOn: 1 }),
      };

    case "monthly":
      return { $gte: startOfMonth(now), $lte: endOfMonth(now) };

    case "quarterly":
      return { $gte: startOfQuarter(now), $lte: endOfQuarter(now) };

    case "custom":
      if (!startDate || !endDate) {
        throw new Error("Start date and end date required");
      }
      return {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };

    default:
      return {}; // all time
  }
}

export function formatDateRange(filter, startDate, endDate) {
  const now = new Date();

  let start, end;

  switch (filter) {
    case "daily":
      start = startOfDay(now);
      end = endOfDay(now);
      break;

    case "weekly":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;

    case "monthly":
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;

    case "quarterly":
      start = startOfQuarter(now);
      end = endOfQuarter(now);
      break;

    case "custom":
      if (!startDate || !endDate) return "Custom Range";
      start = new Date(startDate);
      end = new Date(endDate);
      break;

    default:
      return "All Time";
  }

  return `${format(start, "MMM dd, yyyy")} - ${format(end, "MMM dd, yyyy")}`;
}