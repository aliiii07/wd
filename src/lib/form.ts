// Small helpers to read values out of a submitted <form>.
// They throw a clear error if a required field is missing or wrong.

export function text(form: FormData, name: string): string {
  const value = String(form.get(name) ?? "").trim();
  if (!value) throw new Error(`"${name}" is required`);
  return value;
}

export function optionalText(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

export function int(form: FormData, name: string): number {
  const value = optionalInt(form, name);
  if (value == null) throw new Error(`"${name}" is required`);
  return value;
}

export function optionalInt(form: FormData, name: string): number | null {
  // Allow "12 000 000" or "12,000,000".
  const raw = String(form.get(name) ?? "").replace(/[\s,]/g, "");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`"${name}" must be a whole number`);
  return value;
}

export function optionalDate(form: FormData, name: string): Date | null {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return null;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) throw new Error(`"${name}" is not a valid date`);
  return value;
}

export function requiredDate(form: FormData, name: string): Date {
  const value = optionalDate(form, name);
  if (!value) throw new Error(`"${name}" is required`);
  return value;
}

// For <select> fields backed by a Prisma enum.
export function oneOf<T extends Record<string, string>>(form: FormData, name: string, options: T): T[keyof T] {
  const value = String(form.get(name) ?? "");
  if (!Object.values(options).includes(value)) throw new Error(`"${name}" has an invalid value`);
  return value as T[keyof T];
}
