import { connection } from "next/server";
import { Button, Card, Field, PageHeader, Table, Td } from "@/components/ui";
import { createSupplier } from "@/lib/actions";
import { db } from "@/lib/db";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await connection();
  const suppliers = await db.supplier.findMany({
    include: { _count: { select: { dresses: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Suppliers" subtitle="Designers and ateliers you buy dresses from" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table headers={["Name", "Contact", "Phone", "Email", "Dresses"]} empty="No suppliers yet.">
            {suppliers.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.contactName ?? "—"}</Td>
                <Td>{s.phone ?? "—"}</Td>
                <Td>{s.email ?? "—"}</Td>
                <Td>{s._count.dresses}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title="Add supplier">
          <form action={createSupplier} className="space-y-3">
            <Field label="Name" name="name" required />
            <Field label="Contact person" name="contactName" />
            <Field label="Phone" name="phone" type="tel" />
            <Field label="Email" name="email" type="email" />
            <Button>Add supplier</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
