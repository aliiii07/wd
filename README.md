# Sharlin — Bridal Shop ERP + CRM

The management system for **Sharlin** wedding dress shop.

- **CRM** (customers): brides and leads, wedding dates, budgets, where they found us, appointments.
- **ERP** (the business): dress inventory, orders (sale or rental), payments and balances, alterations, suppliers, staff.

---

## First time on a new computer

You need [Node.js](https://nodejs.org) version 20 or newer. Check with `node -v`.

```bash
npm install        # downloads the libraries the project uses (into node_modules/)
cp .env.example .env   # creates your local settings file
npm run setup      # creates the database and fills it with sample data
npm run dev        # starts the app
```

Open **http://localhost:3000** in your browser. Stop the app with `Ctrl + C` in the terminal.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app while you code. Pages update when you save a file. |
| `npm run db:studio` | Opens a spreadsheet-like view of the database in your browser. Great for looking at or fixing data. |
| `npm run db:migrate` | Run this after you change `prisma/schema.prisma`. It updates the database to match. It will ask you for a name for the change, like `add-dress-photos`. |
| `npm run db:seed` | **Deletes all data** and puts the sample data back. |
| `npm run db:reset` | Deletes the whole database and rebuilds it from scratch with sample data. |
| `npm run lint` | Checks the code for common mistakes. |
| `npm run build` | Checks that the whole app compiles, as it would for going live. |

## How the project is organized

```
prisma/
  schema.prisma        ← THE DATABASE DESIGN. Every table and field lives here.
  seed.ts              ← sample data
  migrations/          ← history of database changes (made automatically, don't edit)
  dev.db               ← the actual database file (not saved to git)
src/
  app/                 ← the pages. The folder path = the web address:
    page.tsx               /             Dashboard
    customers/page.tsx     /customers    list + search
    customers/new/         /customers/new
    customers/[id]/        /customers/5  one customer ([id] = any number)
    appointments/, orders/, dresses/, suppliers/, staff/  (same pattern)
    layout.tsx         ← the frame around every page (sidebar)
    globals.css        ← the Sharlin colors
  components/
    ui.tsx             ← reusable pieces: Button, Card, Table, Field, Badge…
    sidebar.tsx        ← the menu
  lib/
    actions.ts         ← everything that SAVES data (runs when a form is submitted)
    db.ts              ← the database connection
    orders.ts          ← order math: total, paid, balance
    format.ts          ← how money and dates are shown. Change CURRENCY here.
    form.ts            ← helpers to read form fields safely
  generated/prisma/    ← made automatically from schema.prisma (not saved to git)
```

### How a page works (the pattern to copy)

1. A page file (e.g. `src/app/dresses/page.tsx`) **reads** from the database with `db.dress.findMany(...)` and shows it.
2. A form on the page has `action={createDress}`. When submitted, `createDress` in `src/lib/actions.ts` **saves** to the database.
3. The action then refreshes the page (`revalidatePath`) or goes to another page (`redirect`).

To add something new, copy an existing page that is closest to what you want.

## Tech used (and why)

| Tool | Why |
|---|---|
| [Next.js](https://nextjs.org/docs) | Website and server in one project. |
| [TypeScript](https://www.typescriptlang.org/) | JavaScript that catches mistakes before you run the code. |
| [Tailwind CSS](https://tailwindcss.com/docs) | Styling with class names like `text-rose p-4`. |
| [Prisma](https://www.prisma.io/docs) | Talks to the database with simple code instead of SQL. |
| SQLite | The database is one file. No server to install. |

## Money

Prices are stored as **whole numbers** in the shop currency (e.g. `2400`, not `2400.50`).
The currency symbol is set in `src/lib/format.ts` → `CURRENCY` (default `USD`; for example `UZS`, `EUR`, `RUB`).

## Roadmap — what to build next

Must-have before the app goes on the internet:

- [ ] **Login** for staff (e.g. [Auth.js](https://authjs.dev) or [Better Auth](https://www.better-auth.com)). Right now anyone who can open the app can change data. Then check the logged-in user at the top of every function in `src/lib/actions.ts`.
- [ ] **Hosted database** (e.g. PostgreSQL) instead of the SQLite file, plus **backups**.
- [ ] **Hosting** (e.g. Vercel, Railway, or a VPS).

Nice next features:

- [ ] Edit and delete for customers, dresses and orders (right now you can add and change status)
- [ ] Dress photos
- [ ] Measurements for each bride (bust, waist, hips, length…)
- [ ] Calendar view for appointments
- [ ] Rental returns overdue list on the dashboard
- [ ] SMS / Telegram reminders before appointments
- [ ] Printable receipt / contract for each order
- [ ] Monthly sales and profit report
- [ ] Friendlier form errors shown next to the field (`useActionState`)
