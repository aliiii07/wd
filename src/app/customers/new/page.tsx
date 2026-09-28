import { Button, Card, Field, FormGrid, PageHeader, Select, TextArea } from "@/components/ui";
import { createCustomer } from "@/lib/actions";
import { LeadSource } from "@/generated/prisma/enums";

export const metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="New customer" />
      <Card className="max-w-2xl">
        <form action={createCustomer} className="space-y-4">
          <FormGrid>
            <Field label="Full name" name="fullName" required />
            <Field label="Phone" name="phone" type="tel" required />
            <Field label="Email" name="email" type="email" />
            <Field label="Wedding date" name="weddingDate" type="date" />
            <Field label="Budget" name="budget" inputMode="numeric" placeholder="e.g. 2500" />
            <Select label="How did she find us?" name="source" options={LeadSource} defaultValue="WALK_IN" />
          </FormGrid>
          <TextArea label="Notes" name="notes" placeholder="Style she likes, size, anything to remember" />
          <Button>Save customer</Button>
        </form>
      </Card>
    </>
  );
}
