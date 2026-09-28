import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge, Button, ButtonLink, Card, Field, PageHeader, Select, StatusForm, Table, Td } from "@/components/ui";
import { createAppointment, updateCustomerStatus } from "@/lib/actions";
import { db } from "@/lib/db";
import { date, dateTime, daysUntil, label, money } from "@/lib/format";
import { orderMoneyInclude, orderTotals } from "@/lib/orders";
import { AppointmentType, CustomerStatus } from "@/generated/prisma/enums";

export default async function CustomerPage(props: PageProps<"/customers/[id]">) {
  await connection();
  const { id } = await props.params;
  const customer = await db.customer.findUnique({
    where: { id: Number(id) },
    include: {
      appointments: { include: { staff: true }, orderBy: { startsAt: "desc" } },
      orders: { include: { items: { include: { dress: true } }, alterations: orderMoneyInclude.alterations, payments: orderMoneyInclude.payments }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

  const staff = await db.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title={customer.fullName}
        subtitle={`Customer since ${date(customer.createdAt)}`}
        action={<ButtonLink href={`/orders/new?customerId=${customer.id}`}>+ New order</ButtonLink>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <Row term="Phone" value={<a href={`tel:${customer.phone}`} className="text-rose">{customer.phone}</a>} />
            <Row term="Email" value={customer.email ?? "—"} />
            <Row
              term="Wedding"
              value={
                customer.weddingDate
                  ? `${date(customer.weddingDate)} (${daysUntil(customer.weddingDate)} days)`
                  : "—"
              }
            />
            <Row term="Budget" value={money(customer.budget)} />
            <Row term="Source" value={label(customer.source)} />
            {customer.notes && <Row term="Notes" value={<span className="whitespace-pre-line">{customer.notes}</span>} />}
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">Status</p>
            <StatusForm action={updateCustomerStatus} id={customer.id} value={customer.status} options={CustomerStatus} />
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Orders">
            <Table headers={["#", "Type", "Dress", "Total", "Balance", "Status"]} empty="No orders yet.">
              {customer.orders.map((o) => {
                const totals = orderTotals(o);
                return (
                  <tr key={o.id}>
                    <Td>
                      <Link href={`/orders/${o.id}`} className="font-medium text-rose">#{o.id}</Link>
                    </Td>
                    <Td>{label(o.type)}</Td>
                    <Td>{o.items.map((i) => i.dress.name).join(", ")}</Td>
                    <Td className="tabular-nums">{money(totals.total)}</Td>
                    <Td className="tabular-nums">{money(totals.balance)}</Td>
                    <Td><Badge value={o.status} /></Td>
                  </tr>
                );
              })}
            </Table>
          </Card>

          <Card title="Appointments">
            <form action={createAppointment} className="mb-4 grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="customerId" value={customer.id} />
              <input type="hidden" name="returnTo" value="customer" />
              <Field label="When" name="startsAt" type="datetime-local" required />
              <Select label="Type" name="type" options={AppointmentType} />
              <Select label="With" name="staffId" placeholder="Anyone" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
              <Button>Book</Button>
            </form>
            <Table headers={["When", "Type", "With", "Status"]} empty="No appointments yet.">
              {customer.appointments.map((a) => (
                <tr key={a.id}>
                  <Td>{dateTime(a.startsAt)}</Td>
                  <Td>{label(a.type)}</Td>
                  <Td>{a.staff?.name ?? "—"}</Td>
                  <Td><Badge value={a.status} /></Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{term}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
