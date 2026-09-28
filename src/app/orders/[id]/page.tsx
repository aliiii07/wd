import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge, Button, Card, Field, PageHeader, Select, StatusForm, Table, Td } from "@/components/ui";
import { addAlteration, addOrderItem, addPayment, setAlterationStatus, setOrderStatus } from "@/lib/actions";
import { db } from "@/lib/db";
import { date, label, money } from "@/lib/format";
import { orderTotals } from "@/lib/orders";
import { AlterationStatus, OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

export default async function OrderPage(props: PageProps<"/orders/[id]">) {
  await connection();
  const { id } = await props.params;
  const order = await db.order.findUnique({
    where: { id: Number(id) },
    include: {
      customer: true,
      items: { include: { dress: true } },
      payments: { orderBy: { paidAt: "asc" } },
      alterations: { include: { staff: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const [dresses, staff] = await Promise.all([
    db.dress.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const totals = orderTotals(order);

  return (
    <>
      <PageHeader
        title={`Order #${order.id}`}
        subtitle={`${label(order.type)} · created ${date(order.createdAt)}`}
        action={<StatusForm action={setOrderStatus} id={order.id} value={order.status} options={OrderStatus} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Dresses">
            <Table headers={["Dress", "Size", "Qty", "Price"]}>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <Td><span className="font-medium">{i.dress.name}</span> <span className="text-muted">{i.dress.sku}</span></Td>
                  <Td>{i.size ?? "—"}</Td>
                  <Td>{i.quantity}</Td>
                  <Td className="tabular-nums">{money(i.price * i.quantity)}</Td>
                </tr>
              ))}
            </Table>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-rose">+ Add another item (veil, accessories…)</summary>
              <form action={addOrderItem} className="mt-3 grid items-end gap-3 sm:grid-cols-4">
                <input type="hidden" name="orderId" value={order.id} />
                <Select label="Dress / item" name="dressId" className="sm:col-span-2" options={dresses.map((d) => ({ value: d.id, label: `${d.name} (${d.sku})` }))} />
                <Field label="Price" name="price" inputMode="numeric" placeholder="Catalog" />
                <Button>Add</Button>
              </form>
            </details>
          </Card>

          <Card title="Alterations">
            <Table headers={["Work", "Seamstress", "Due", "Price", "Status"]} empty="No alterations.">
              {order.alterations.map((a) => (
                <tr key={a.id}>
                  <Td>{a.description}</Td>
                  <Td>{a.staff?.name ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{date(a.dueDate)}</Td>
                  <Td className="tabular-nums">{money(a.price)}</Td>
                  <Td><StatusForm action={setAlterationStatus} id={a.id} value={a.status} options={AlterationStatus} /></Td>
                </tr>
              ))}
            </Table>
            <form action={addAlteration} className="mt-4 grid items-end gap-3 sm:grid-cols-5">
              <input type="hidden" name="orderId" value={order.id} />
              <Field label="Work needed" name="description" required className="sm:col-span-2" placeholder="Hem, take in waist…" />
              <Field label="Price" name="price" inputMode="numeric" placeholder="0" />
              <Field label="Due" name="dueDate" type="date" />
              <Select label="Seamstress" name="staffId" placeholder="—" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
              <Button className="sm:col-span-5 sm:justify-self-start">Add alteration</Button>
            </form>
          </Card>

          <Card title="Payments">
            <Table headers={["Date", "Method", "Note", "Amount"]} empty="No payments yet.">
              {order.payments.map((p) => (
                <tr key={p.id}>
                  <Td>{date(p.paidAt)}</Td>
                  <Td>{label(p.method)}</Td>
                  <Td className="text-muted">{p.note ?? ""}</Td>
                  <Td className="tabular-nums">{money(p.amount)}</Td>
                </tr>
              ))}
            </Table>
            <form action={addPayment} className="mt-4 grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="orderId" value={order.id} />
              <Field label="Amount" name="amount" inputMode="numeric" required defaultValue={totals.balance > 0 ? totals.balance : undefined} />
              <Select label="Method" name="method" options={PaymentMethod} />
              <Field label="Note" name="note" />
              <Button>Record payment</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <Line term="Dresses" value={money(totals.dresses)} />
              <Line term="Alterations" value={money(totals.alterations)} />
              <Line term="Total" value={money(totals.total)} strong />
              <Line term="Paid" value={money(totals.paid)} />
              <div className={`mt-2 rounded-md p-3 ${totals.balance > 0 ? "bg-rose-soft" : "bg-emerald-50"}`}>
                <Line term="Balance due" value={money(totals.balance)} strong />
              </div>
            </dl>
          </Card>

          <Card title="Customer">
            <Link href={`/customers/${order.customerId}`} className="font-medium text-rose">{order.customer.fullName}</Link>
            <p className="text-sm text-muted">{order.customer.phone}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Line term="Event date" value={date(order.eventDate)} />
              {order.type === "RENTAL" && <Line term="Return by" value={date(order.returnDueDate)} />}
              <Line term="Status" value={<Badge value={order.status} />} />
            </dl>
            {order.notes && <p className="mt-4 whitespace-pre-line text-sm text-muted">{order.notes}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

function Line({ term, value, strong }: { term: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{term}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
