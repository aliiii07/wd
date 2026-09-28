import { connection } from "next/server";
import { Button, Card, Field, PageHeader, Select, Table, Td } from "@/components/ui";
import { createStaff } from "@/lib/actions";
import { db } from "@/lib/db";
import { label } from "@/lib/format";
import { StaffRole } from "@/generated/prisma/enums";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  await connection();
  const staff = await db.staff.findMany({
    include: { _count: { select: { appointments: true, alterations: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Staff" subtitle="Your team" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table headers={["Name", "Role", "Phone", "Appointments", "Alterations"]} empty="No staff yet.">
            {staff.map((s) => (
              <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                <Td className="font-medium">{s.name}</Td>
                <Td>{label(s.role)}</Td>
                <Td>{s.phone ?? "—"}</Td>
                <Td>{s._count.appointments}</Td>
                <Td>{s._count.alterations}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title="Add team member">
          <form action={createStaff} className="space-y-3">
            <Field label="Name" name="name" required />
            <Select label="Role" name="role" options={StaffRole} defaultValue="CONSULTANT" />
            <Field label="Phone" name="phone" type="tel" />
            <Button>Add</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
