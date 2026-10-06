# Oq Libos ERP

ERP platform for wedding-dress boutiques. Each boutique (a tenant, for example **Sharlin**) signs in to its own
account and sees only its own branches, clients, dresses and money. The platform owner manages the boutiques from
an admin console.

The layout follows the Deepen gym ERP (dark sidebar, header band with section tabs, cards and status chips),
recoloured to **black and gold on white** and rebuilt around bridal work: rentals and sales tied to a wedding date,
fittings, alterations and deposits. The interface is available in **O'zbekcha, Русский and English**.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/
npm run build:single # one self-contained file: dist-single/index.html
```

Demo logins (password `123456` for all; the login page lists them under *Demo hisoblar*):

| Login | Who | Sees |
|---|---|---|
| `founder@sharlin.uz` | Dilshoda Xaydaraliyeva, founder of Sharlin | Both branches, overall analytics, the branch comparison, Filiallar and logins |
| `lola@sharlin.uz` | Sharlin Lola (branch 1) | Only Sharlin Lola's data and analytics |
| `cola@sharlin.uz` | Sharlin Cola (branch 2) | Only Sharlin Cola's data and analytics |
| `admin@oqlibos.uz` | Platform admin | The list of boutiques: add a boutique with its founder login and first branch, rename, switch off |

The demo boutique has five clients in each branch, with orders at every stage (finished, out with the client,
overdue, picked up today, booked ahead), so every screen has something to show.

## What's inside

| Section | What it does |
|---|---|
| **Bugun** (Today) | Today's revenue vs yesterday, fittings schedule, pickups/returns for the next 3 days, overdue returns, a pie chart of today's payments by method, wedding countdown for the next 14 days, alterations due, new inquiries |
| **Analitika** | Revenue, orders, average order, dress utilization, outstanding balances, deposits held, new clients, lead conversion; pie charts of payment methods and sales mix. Tabs: overview, branch comparison with a revenue-share pie (founder), revenue per dress with payback, staff sales and commission, lead funnel and client sources |
| **Kalendar** | Month view of weddings, pickups, returns and appointments, plus a per-dress timeline that shows booked, rented, overdue, sold and cleaning days |
| **Buyurtmalar** | Rental and sale orders: deposit + installment plan due before pickup, security deposit, late fee per day, conflict check against other bookings (an overdue dress stays blocked until it's back), hand-over, return with late fee / damage deducted from the deposit, printable contract in uz/ru/en |
| **Ko'rik / Andoza** | Viewings, measurements, fittings, pickups and returns with the stylist and dresses to show |
| **Mijozlar** | Clients with body measurements (bust, waist, hips, height, …), wedding date countdown, orders, payments, SMS history |
| **So'rovlar (CRM)** | Lead board (new → contacted → appointment → won / lost), drag and drop, convert to client |
| **Tavarlar** | Dresses (size, colour, silhouette, condition, status, rent/sale/both, prices, cost), accessories with stock, and **product types** that you can add in three languages |
| **Tikuv ishlari** | Alteration board: tasks, tailor, due date, fitting sessions, measurements snapshot; the dress status follows the work |
| **To'lovlar** | Payment history by method and type, and a quick-sale till for accessories |
| **Hodimlar** | Staff with roles (stylist, tailor, sales consultant, manager, admin), weekly schedule, commission and payout |
| **Xabarnomalar** | Reminders to send (appointment, pickup, return, overdue, balance due, wedding countdown, alteration ready), editable SMS templates in three languages, SMS history |
| **Filiallar** | Branches with this month's figures, and the boutique's logins (founder / branch account) |
| **Sozlamalar** | Boutique name, default late fee, security deposit, cleaning days between rentals, rental length, language, password |

Removed from the gym ERP: demographics, classes and group visits, workout and diet plans, body progress,
check-in/QR, lockers and membership freeze.

## How it's built

- React 19 + TypeScript + Vite, Recharts for charts, lucide icons, HashRouter.
- `src/lib/brand.ts`: the platform's name and monogram (change them here).
- `src/data/types.ts`: the data model. `Platform` holds the boutiques and every login; each boutique's records
  live in their own `DB`.
- `src/data/domain.ts`: money, installment plan, availability and utilization rules.
  `src/data/actions.ts`: operations that change several records together (book, pay, hand over, return, cancel…).
- `src/data/seed.ts`: the Sharlin demo and the empty template a new boutique starts from.
- `src/i18n/dict.ts` keeps every text in all three languages side by side.

### Data storage (important)

This version keeps all data **in the browser's localStorage**: one entry for the platform (boutiques and logins)
and one per boutique. That is enough to try the system on one computer. For real use, the boutiques and their
branches need a shared backend: replace the load/save in `src/data/store.tsx` with API calls (the actions in
`src/data/actions.ts` map one-to-one to endpoints, and each boutique's data maps to its own tenant on the server)
and move sign-in to the server. Demo passwords are stored in plain text and must not be used for real accounts.

### SMS

Reminders are logged to the SMS history but not sent. To send real messages, call an Uzbek SMS gateway
(Eskiz.uz or Playmobile) from `logSms` in `src/data/actions.ts`, ideally through the backend so the API key
never reaches the browser.
