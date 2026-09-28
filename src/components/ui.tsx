// Reusable building blocks. Use these instead of styling every page by hand,
// so the whole app looks consistent.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { label } from "@/lib/format";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-medium">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  // good / finished
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PICKED_UP: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-emerald-50 text-emerald-700",
  DONE: "bg-emerald-50 text-emerald-700",
  READY: "bg-emerald-50 text-emerald-700",
  BOOKED: "bg-emerald-50 text-emerald-700",
  // needs attention
  QUOTE: "bg-amber-50 text-amber-700",
  PENDING: "bg-amber-50 text-amber-700",
  LEAD: "bg-amber-50 text-amber-700",
  // stopped
  CANCELLED: "bg-stone-100 text-stone-500",
  LOST: "bg-stone-100 text-stone-500",
  NO_SHOW: "bg-red-50 text-red-700",
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColors[value] ?? "bg-rose-soft text-rose-dark"}`}>
      {label(value)}
    </span>
  );
}

export function Table({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows > 0 ? (
            children
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-muted">
                {empty ?? "Nothing here yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

const buttonStyles = {
  primary: "bg-rose text-white hover:bg-rose-dark",
  secondary: "border border-line bg-surface text-ink hover:bg-canvas",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: keyof typeof buttonStyles }) {
  return (
    <Link href={href} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${buttonStyles[variant]}`}>
      {children}
    </Link>
  );
}

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-rose-soft";

type FieldProps = { label: string; hint?: string; className?: string };

export function Field({ label, hint, className = "", ...props }: FieldProps & ComponentProps<"input">) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">
        {label}
        {props.required && <span className="text-rose"> *</span>}
      </span>
      <input className={inputClass} {...props} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, className = "", ...props }: FieldProps & ComponentProps<"textarea">) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <textarea rows={3} className={inputClass} {...props} />
    </label>
  );
}

// Pass `options` as a Prisma enum object (e.g. LeadSource) or a list of {value, label}.
export function Select({
  label: fieldLabel,
  options,
  placeholder,
  className = "",
  ...props
}: FieldProps & ComponentProps<"select"> & {
  options: Record<string, string> | { value: string | number; label: string }[];
  placeholder?: string;
}) {
  const list = Array.isArray(options) ? options : Object.values(options).map((v) => ({ value: v, label: label(v) }));
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">
        {fieldLabel}
        {props.required && <span className="text-rose"> *</span>}
      </span>
      <select className={inputClass} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

// A tiny form with a hidden id and a status dropdown that saves on submit.
export function StatusForm({
  action,
  id,
  value,
  options,
  idName = "id",
}: {
  action: (form: FormData) => Promise<void>;
  id: number;
  value: string;
  options: Record<string, string>;
  idName?: string;
}) {
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name={idName} value={id} />
      <select name="status" defaultValue={value} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
        {Object.values(options).map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
      <Button variant="secondary" className="px-3 py-1.5">
        Save
      </Button>
    </form>
  );
}
