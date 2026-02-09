function pad2(value) {
  return String(value).padStart(2, '0');
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

// For <input type="date" />, we want a stable YYYY-MM-DD based on the user's local timezone
// (not UTC), otherwise dates can shift around midnight for non-UTC timezones.
export function toDateInputValue(value) {
  if (!value) return '';

  if (typeof value === 'string' && isYmd(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// Backend's `MyDateString` scalar expects "YYYY-MM-DDTHH:mm:ss" (no timezone).
// For date range filtering, only the date part is used server-side (it converts to start/end-of-day),
// so we always send 00:00:00.
export function dateInputToMyDateString(dateInputValue) {
  const ymd = toDateInputValue(dateInputValue);
  if (!isYmd(ymd)) return '';
  return `${ymd}T00:00:00`;
}

// Backend's `Time` scalar expects RFC3339/RFC3339Nano. We convert a date-only UI value to an
// ISO timestamp representing *local midnight* for that date, then serialize to UTC (Z).
// This avoids off-by-one display issues when formatting dates in the user's locale.
export function dateInputToISODateTime(dateInputValue) {
  const ymd = toDateInputValue(dateInputValue);
  if (!isYmd(ymd)) return '';

  const [y, m, d] = ymd.split('-').map((part) => Number(part));
  // Numeric Date constructor uses local timezone.
  const localMidnight = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(localMidnight.getTime())) return '';
  return localMidnight.toISOString();
}

