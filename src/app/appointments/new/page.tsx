import { connection } from "next/server";
import { Button, ButtonLink, Card, Field, FormGrid, PageHeader, Select, TextArea } from "@/components/ui";
import { createAppointment } from "@/lib/actions";
import { db } from "@/lib/db";
import { AppointmentType } from "@/generated/prisma/enums";

export const metadata = { title: "Book appointment" };

export default async function NewAppointmentPage() {
  await connection();
  const [customers, staff] = await Promise.all([
    db.customer.findMany({ where: { status: { not: "LOST" } }, orderBy: { fullName: "asc" } }),
    db.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Book appointment" />
      {customers.length === 0 ? (
        <Card className="max-w-2xl">
          <p className="mb-4 text-sm text-muted">Add a customer first, then book her appointment.</p>
          <ButtonLink href="/customers/new">+ New customer</ButtonLink>
        </Card>
      ) : (
        <Card className="max-w-2xl">
          <form action={createAppointment} className="space-y-4">
            <FormGrid>
              <Select label="Customer" name="customerId" required options={customers.map((c) => ({ value: c.id, label: `${c.fullName} · ${c.phone}` }))} />
              <Field label="Date & time" name="startsAt" type="datetime-local" required />
              <Select label="Type" name="type" options={AppointmentType} />
              <Select label="With" name="staffId" placeholder="Anyone" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
            </FormGrid>
            <TextArea label="Notes" name="notes" />
            <Button>Book appointment</Button>
          </form>
        </Card>
      )}
    </>
  );
}
