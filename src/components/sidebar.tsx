"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/appointments", label: "Appointments" },
  { href: "/orders", label: "Orders" },
  { href: "/dresses", label: "Dresses" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/staff", label: "Staff" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="border-b border-line bg-surface md:min-h-screen md:w-56 md:border-b-0 md:border-r">
      <div className="px-5 pt-5 pb-3 md:pt-8 md:pb-6">
        <Link href="/" className="font-serif text-2xl tracking-wide text-rose">
          Sharlin
        </Link>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Bridal</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${
              isActive(link.href) ? "bg-rose-soft font-medium text-rose-dark" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
