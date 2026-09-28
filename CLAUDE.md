@AGENTS.md

# Sharlin — bridal shop ERP + CRM

Internal management app for Sharlin, a wedding dress shop: CRM (customers,
leads, appointments) and ERP (dress inventory, sale/rental orders, payments,
alterations, suppliers, staff).

The owner is new to programming. Explain changes in plain language, keep code
simple and consistent with the existing pattern, and prefer copying an
existing page's structure over introducing new libraries or abstractions.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4
- Prisma 7 with SQLite via `@prisma/adapter-better-sqlite3`
- Client is generated to `src/generated/prisma` (gitignored). Import types and
  enums from `@/generated/prisma/client` / `@/generated/prisma/enums`.
- `prisma migrate dev` does NOT run `generate` in Prisma 7 — use
  `npm run db:migrate`, which does both.

## Conventions

- Pages are Server Components that query `db` directly and call
  `await connection()` first so data is never served from a prerender.
- All writes go through Server Actions in `src/lib/actions.ts`, using the form
  helpers in `src/lib/form.ts` (`text`, `int`, `oneOf`, …). Validation errors
  are thrown and shown by `src/app/error.tsx`.
- Money is `Int` in whole currency units. Never Float. Order total/paid/balance
  are always computed with `orderTotals()` in `src/lib/orders.ts`, never stored.
- UI uses components from `src/components/ui.tsx` and brand tokens from
  `src/app/globals.css` (`bg-rose`, `text-muted`, `border-line`, …).
- No authentication yet. Do not deploy publicly until login is added and
  checked at the top of every Server Action.

## Commands

- `npm run dev` · `npm run build` · `npm run lint`
- `npm run db:migrate` after editing `prisma/schema.prisma`
- `npm run db:seed` (wipes data) · `npm run db:studio`
