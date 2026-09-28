import { connection } from "next/server";
import { Button, ButtonLink, Card, Field, FormGrid, PageHeader, Select, TextArea } from "@/components/ui";
import { createOrder } from "@/lib/actions";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { OrderType, PaymentMethod } from "@/generated/prisma/enums";

export const metadata = { title: "New order" };

export default async function NewOrderPage(props: PageProps<"/orders/new">) {
  await connection();
  const { customerId } = await props.searchParams;
  const [customers, dresses] = await Promise.all([
    db.customer.findMany({ where: { status: { not: "LOST" } }, orderBy: { fullName: "asc" } }),
    db.dress.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (customers.length === 0 || dresses.length === 0) {
    return (
      <>
        <PageHeader title="New order" />
        <Card className="max-w-2xl">
          <p className="mb-4 text-sm text-muted">You need at least one customer and one dress before creating an order.</p>
          <div className="flex gap-2">
            <ButtonLink href="/customers/new">+ New customer</ButtonLink>
            <ButtonLink href="/dresses/new" variant="secondary">+ Add dress</ButtonLink>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="New order" />
      <Card className="max-w-2xl">
        <form action={createOrder} className="space-y-4">
          <FormGrid>
            <Select
              label="Customer"
              name="customerId"
              required
              defaultValue={typeof customerId === "string" ? customerId : undefined}
              options={customers.map((c) => ({ value: c.id, label: `${c.fullName} · ${c.phone}` }))}
            />
            <Select label="Sale or rental" name="type" options={OrderType} />
            <Select
              label="Dress"
              name="dressId"
              required
              className="sm:col-span-2"
              options={dresses.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.sku}) — ${money(d.price)}${d.rentalPrice ? ` / rent ${money(d.rentalPrice)}` : ""} — ${d.stock} in stock`,
              }))}
            />
            <Field label="Size" name="size" />
            <Field label="Agreed price" name="price" inputMode="numeric" hint="Leave empty to use the catalog price" />
            <Field label="Event date" name="eventDate" type="date" />
            <Field label="Return by (rentals)" name="returnDueDate" type="date" />
            <Field label="Deposit paid now" name="deposit" inputMode="numeric" hint="Optional — confirms the order" />
            <Select label="Deposit method" name="method" options={PaymentMethod} />
          </FormGrid>
          <TextArea label="Notes" name="notes" />
          <Button>Create order</Button>
        </form>
      </Card>
    </>
  );
}
