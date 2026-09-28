import { connection } from "next/server";
import { Button, Card, Field, FormGrid, PageHeader, Select, TextArea } from "@/components/ui";
import { createDress } from "@/lib/actions";
import { db } from "@/lib/db";

export const metadata = { title: "Add dress" };

export default async function NewDressPage() {
  await connection();
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="Add dress" />
      <Card className="max-w-2xl">
        <form action={createDress} className="space-y-4">
          <FormGrid>
            <Field label="SKU (your code)" name="sku" required placeholder="SH-010" />
            <Field label="Name" name="name" required />
            <Field label="Designer" name="designer" />
            <Field label="Silhouette" name="silhouette" placeholder="A-line, Mermaid, Ball gown…" />
            <Field label="Color" name="color" />
            <Field label="Sizes" name="size" placeholder="36–42" />
            <Field label="Sale price" name="price" inputMode="numeric" required />
            <Field label="Rental price" name="rentalPrice" inputMode="numeric" hint="Leave empty if not for rent" />
            <Field label="Cost" name="cost" inputMode="numeric" hint="What the shop paid" />
            <Field label="In stock" name="stock" type="number" min={0} defaultValue={1} />
            <Select label="Supplier" name="supplierId" placeholder="—" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </FormGrid>
          <TextArea label="Notes" name="notes" />
          <Button>Save dress</Button>
        </form>
      </Card>
    </>
  );
}
