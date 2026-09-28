import Link from "next/link";
import { connection } from "next/server";
import { Badge, ButtonLink, PageHeader, Table, Td } from "@/components/ui";
import { db } from "@/lib/db";
import { date, label, money } from "@/lib/format";
import { orderMoneyInclude, orderTotals } from "@/lib/orders";
import { OrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Orders" };

export default async function OrdersPage(props: PageProps<"/orders">) {
  await connection();
  const { status } = await props.searchParams;
  const statusFilter = typeof status === "string" && status in OrderStatus ? (status as OrderStatus) : undefined;

  const orders = await db.order.findMany({
    where: { status: statusFilter },
    include: { customer: true, ...orderMoneyInclude, items: { include: { dress: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Orders" subtitle="Sales and rentals" action={<ButtonLink href="/orders/new">+ New order</ButtonLink>} />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FilterLink href="/orders" active={!statusFilter}>All</FilterLink>
        {Object.values(OrderStatus).map((s) => (
          <FilterLink key={s} href={`/orders?status=${s}`} active={statusFilter === s}>{label(s)}</FilterLink>
        ))}
      </div>

      <Table headers={["#", "Customer", "Type", "Dress", "Event", "Total", "Balance", "Status"]} empty="No orders.">
        {orders.map((o) => {
          const totals = orderTotals(o);
          return (
            <tr key={o.id} className="hover:bg-canvas">
              <Td><Link href={`/orders/${o.id}`} className="font-medium text-rose">#{o.id}</Link></Td>
              <Td><Link href={`/customers/${o.customerId}`} className="hover:text-rose">{o.customer.fullName}</Link></Td>
              <Td>{label(o.type)}</Td>
              <Td>{o.items.map((i) => i.dress.name).join(", ")}</Td>
              <Td className="whitespace-nowrap">{date(o.eventDate)}</Td>
              <Td className="tabular-nums">{money(totals.total)}</Td>
              <Td className={`tabular-nums ${totals.balance > 0 ? "font-medium" : "text-muted"}`}>{money(totals.balance)}</Td>
              <Td><Badge value={o.status} /></Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1 ${active ? "border-rose bg-rose-soft text-rose-dark" : "border-line bg-surface text-muted hover:text-ink"}`}>
      {children}
    </Link>
  );
}
