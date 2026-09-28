// Display helpers: money, dates, and human-readable labels for enum values.

// Change these two lines to match the shop.
export const CURRENCY = "USD";
export const LOCALE = "en-US";

export function money(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function date(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

export function dateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// For <input type="date"> default values.
export function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

// "IN_ALTERATIONS" -> "In alterations"
export function label(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function daysUntil(value: Date) {
  const ms = value.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
