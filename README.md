# Oq Libos ERP

ERP platform for wedding-dress boutiques. Each boutique (a tenant, for example **Sharlin**) signs in to its own
account and sees only its own branches, clients, dresses and money. The platform owner manages the boutiques from
an admin console.

The layout follows the Deepen gym ERP (sidebar, page header with section tabs, cards and status tags), rebuilt
around bridal work: rentals and sales tied to a wedding date, fittings, deposits and installments. The look is
ivory and ink with one brand colour, in a light and a dark theme. The interface is available in **O'zbekcha,
Русский and English**.

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
overdue, picked up today, booked ahead), so every screen has something to show. Its expenses cover the last six
months and are kept in proportion to those ten clients' payments, so the payroll lines are smaller than the
salaries on the staff pages.

## What's inside

| Section | What it does |
|---|---|
| **Bugun** (Today) | Today's revenue vs yesterday, a pie chart of today's payments by method (and by branch for the founder), today's schedule with complete / no-show, pickups and returns for the next 3 days, overdue returns, wedding countdown for the next 14 days |
| **Analitika** | Revenue, orders, average order, dress utilization, outstanding balances, deposits held, new clients, viewing-to-order rate; pie charts of payment methods and sales mix. Tabs: overview, **expenses** (revenue vs expenses by month, net profit and margin, a pie of where the money goes, every category ranked, expenses and profit by branch), branch comparison (founder), revenue per dress with payback, staff sales and commission, client sources |
| **Kalendar** | Month view of weddings, pickups, returns and appointments, plus a per-dress timeline of booked, rented, overdue, sold and cleaning days |
| **Buyurtmalar** | Rental and sale orders: deposit + installment plan due before pickup, security deposit, late fee per day, conflict check against other bookings, hand-over, return with late fee / damage deducted from the deposit, printable contract in uz/ru/en with the boutique's requisites |
| **Ko'rik / Andoza** | Viewings, fittings, pickups and returns with the stylist and the dresses to show |
| **Mijozlar** | Client profile: contact, where she heard about you, SMS language, wedding countdown, orders, appointments, **documents**, SMS history and **Send SMS** |
| **Tavarlar** | Dresses (size, colour, silhouette, condition, status, rent/sale/both, prices, cost) with **photos** (add them in the edit form or on the dress page; the first is the cover), accessories with stock, and **product types** you can add in three languages |
| **To'lovlar** | Payment history by method and type, and a quick-sale till for accessories |
| **Xarajatlar** | What the boutique spends, per branch: salaries (pick a staff member and their monthly salary fills in), rent, stock purchases, dry cleaning, marketing, utilities, taxes, repairs, transport and other. For any period: total spent against the previous period, revenue, net profit and margin, the biggest category, and a breakdown by category |
| **Hodimlar** | Staff list and **staff profiles** (photo, birthday, address, shift, salary, commission, this month's sales and payout, upcoming appointments, documents). Roles: manager, stylist, sales consultant, make-up artist, hair stylist, tailor, photographer, cashier, administrator, cleaner, driver, security. Weekly schedule and commission payouts |
| **Xabarnomalar** | Reminders to send (appointment, pickup, return, overdue, balance due, wedding countdown); **Xabar yozish**: find any client and write her anything, templates can be dropped in and fill in her real dates and amounts; templates in three languages (click to copy, **Edit** on each); SMS history with delivery status |
| **Filiallar** | Branches with this month's revenue, expenses and profit, and the boutique's logins (founder / branch account) |
| **Sozlamalar** | Boutique details and opening hours; rental and payment defaults (late fee, security deposit, cleaning days, rental length, deposit %, installments, accepted payment methods); SMS (sending mode, which reminders, how many days ahead, test SMS, setup guide); contract requisites and an extra clause; look (light / dark / follow the system, eight brand colours); password; backup, restore and demo reset |

Each client and staff profile has a **Documents** card: give the file a name (for example *Shartnoma* / Agreement),
attach it, then open it in the built-in viewer (PDFs and pictures show inside the ERP), open it in a new tab, or
download it.

Not in this version: the CRM lead board and alteration (tailoring) tracking were removed, to be designed again
later; client body measurements were removed. Removed from the gym ERP: demographics, classes and group visits,
workout and diet plans, body progress, check-in/QR, lockers and membership freeze.

## Sending SMS

Settings → SMS offers three modes:

| Mode | What happens | Setup |
|---|---|---|
| **Faqat qayd etish** (record only, the default) | Messages are written to SMS history; nothing leaves the ERP | None |
| **Telefon orqali** (through the phone) | Open the ERP on a phone: *Send* opens the phone's SMS app with the number and text filled in, you press send. Uses that SIM's normal tariff, one message at a time | None |
| **SMS shlyuz (Eskiz.uz)** | Reminders, the composer and client profiles send automatically | The four steps below |

1. **Eskiz account.** Sign up at [eskiz.uz](https://eskiz.uz/sms), sign the contract and top up the balance. Until
   the account is activated it is in test status, and Eskiz delivers only the text *Bu Eskiz dan test* /
   *Это тест от Eskiz* / *This is test from Eskiz*.
2. **Moderation.** In the Eskiz cabinet, submit your message texts (Notifications → Templates) and, if you want,
   your own sender name instead of the shared `4546`. Eskiz does not deliver texts that don't match an approved
   template.
3. **Run the gateway** in `server/sms-gateway` on a machine that stays on (Node.js 18 or newer, no packages). It
   keeps the Eskiz password off the browser and relays each message:

   ```bash
   ESKIZ_EMAIL=you@example.uz ESKIZ_PASSWORD='your-eskiz-password' API_KEY='a-long-random-string' \
   ALLOW_ORIGIN=https://your-erp-address node server/sms-gateway/index.mjs
   ```

   For real use, put it behind HTTPS (a small VPS with Caddy or Nginx, or a host such as Render, Railway or Fly.io):
   a page opened over `https://` cannot call an `http://` address other than `localhost`. Optional variables:
   `ESKIZ_FROM` (sender name, default `4546`) and `PORT` (default `8787`).
4. **Connect the ERP.** In Settings → SMS choose *SMS shlyuz (Eskiz.uz)*, enter the gateway's address and the same
   `API_KEY`, save, and press *Send test SMS* with your own number.

The gateway accepts `POST /send` with the header `X-Api-Key` and the JSON body
`{ "to": "998901234567", "text": "…", "from": "4546" }`, answers `{ "ok": true, "id": "…" }` or
`{ "ok": false, "error": "…" }`, and has `GET /health`.

Notes:

- Curly and Uzbek apostrophes (`oʻ`, `gʻ`), long dashes and no-break spaces are replaced with plain characters
  before sending, so a Latin text stays at 160 characters per SMS. Cyrillic texts are 70 characters per SMS.
- Reminders go out when someone presses *Send* on the Notifications page. Sending them on a timer every morning
  needs the backend (a scheduled job that calls the same gateway).

## How it's built

- React 19 + TypeScript + Vite, Recharts for charts, lucide icons, HashRouter.
- `src/styles.css`: the design tokens (colours, type, spacing) for the light and dark themes and the eight brand
  colours; fonts are Prata for headings and Poppins for everything else (Montserrat for Cyrillic, which Poppins lacks).
- `src/lib/brand.ts`: the platform's name and monogram (change them here). `src/lib/theme.tsx`: light / dark mode.
- `src/data/types.ts`: the data model. `Platform` holds the boutiques and every login; each boutique's records
  live in their own `DB`.
- `src/data/domain.ts`: money, installment plan, availability and utilization rules.
  `src/data/actions.ts`: operations that change several records together (book, pay, hand over, return, cancel…).
  `src/data/reminders.ts`: which reminders are due and how templates are filled in.
- `src/lib/files.ts`: photos and documents. `src/lib/sms.ts`: the three ways of sending.
- `src/data/seed.ts`: the Sharlin demo and the empty template a new boutique starts from.
- `src/i18n/dict.ts` keeps every text in all three languages side by side.

### Data storage (important)

This version keeps data **in the browser**:

- Records (clients, orders, payments, expenses, settings…) are in localStorage: one entry for the platform (boutiques and
  logins) and one per boutique. Settings → Data exports and restores them as a JSON backup.
- Photos and documents are in the browser's IndexedDB **on this device only**. They are not part of the JSON
  backup and are not visible from another computer or phone.

That is enough to try the system on one computer. For real use, the boutiques and their branches need a shared
backend: replace the load/save in `src/data/store.tsx` with API calls (the actions in `src/data/actions.ts` map
one-to-one to endpoints, and each boutique's data maps to its own tenant on the server), store files in object
storage (for example S3-compatible), and move sign-in to the server. Demo passwords are stored in plain text and
must not be used for real accounts.
