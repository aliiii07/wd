import Link from "next/link";
import { connection } from "next/server";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { date, dateTime, daysUntil, money } from "@/lib/format";
import { orderMoneyInclude, orderTotals } from "@/lib/orders";

export default async function DashboardPage() {
  await connection(); // always show fresh data, never a cached copy

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const in60Days = new Date(now.getTime() + 60 * 86_400_000);

  const [newLeads, upcomingAppointments, upcomingWeddings, openOrders, lowStock] = await Promise.all([
    db.customer.count({ where: { status: "LEAD" } }),
    db.appointment.findMany({
      where: { startsAt: { gte: now, lte: in7Days }, status: "SCHEDULED" },
      include: { customer: true, staff: true },
      orderBy: { startsAt: "asc" },
    }),
    db.customer.findMany({
      where: { weddingDate: { gte: now, lte: in60Days }, status: { not: "LOST" } },
      orderBy: { weddingDate: "asc" },
    }),
    db.order.findMany({
      where: { status: { notIn: ["PICKED_UP", "RETURNED", "CANCELLED", "QUOTE"] } },
      include: { customer: true, ...orderMoneyInclude },
    }),
    db.dress.findMany({ where: { isActive: true, stock: { lte: 0 } }, orderBy: { name: "asc" } }),
  ]);

  const withBalance = openOrders
    .map((o) => ({ ...o, totals: orderTotals(o) }))
    .filter((o) => o.totals.balance > 0)
    .sort((a, b) => b.totals.balance - a.totals.balance);
  const outstanding = withBalance.reduce((sum, o) => sum + o.totals.balance, 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="New leads" value={newLeads} hint="Waiting for first visit" />
        <Stat label="Appointments" value={upcomingAppointments.length} hint="Next 7 days" />
        <Stat label="Open orders" value={openOrders.length} hint="Confirmed, not yet picked up" />
        <Stat label="To collect" value={money(outstanding)} hint="Unpaid balance on open orders" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming appointments" action={<Link href="/appointments" className="text-sm text-rose">All →</Link>}>
          {upcomingAppointments.length === 0 ? (
            <p className="text-sm text-muted">No appointments in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingAppointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <Link href={`/customers/${a.customerId}`} className="font-medium hover:text-rose">
                      {a.customer.fullName}
                    </Link>
                    <p className="text-muted">
                      {dateTime(a.startsAt)}
                      {a.staff && ` · ${a.staff.name}`}
                    </p>
                  </div>
                  <Badge value={a.type} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Weddings in the next 60 days">
          {upcomingWeddings.length === 0 ? (
            <p className="text-sm text-muted">No weddings coming up.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcomingWeddings.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/customers/${c.id}`} className="font-medium hover:text-rose">
                    {c.fullName}
                  </Link>
                  <span className="text-muted">
                    {date(c.weddingDate)} · <span className="text-ink">{daysUntil(c.weddingDate!)} days</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Balances to collect">
          {withBalance.length === 0 ? (
            <p className="text-sm text-muted">Every open order is fully paid.</p>
          ) : (
            <ul className="divide-y divide-line">
              {withBalance.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/orders/${o.id}`} className="hover:text-rose">
                    <span className="font-medium">#{o.id}</span> {o.customer.fullName}
                  </Link>
                  <span className="font-medium tabular-nums">{money(o.totals.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Out of stock" action={<Link href="/dresses" className="text-sm text-rose">Inventory →</Link>}>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted">All active dresses are in stock.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((d) => (
                <li key={d.id} className="flex justify-between py-2.5 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted">{d.sku}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
