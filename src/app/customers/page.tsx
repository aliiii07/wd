import Link from "next/link";
import { connection } from "next/server";
import { Badge, ButtonLink, PageHeader, Table, Td } from "@/components/ui";
import { db } from "@/lib/db";
import { date, label, money } from "@/lib/format";
import { CustomerStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Customers" };

export default async function CustomersPage(props: PageProps<"/customers">) {
  await connection();
  const { q, status } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const statusFilter = typeof status === "string" && status in CustomerStatus ? (status as CustomerStatus) : undefined;

  const customers = await db.customer.findMany({
    where: {
      status: statusFilter,
      ...(search && {
        OR: [{ fullName: { contains: search } }, { phone: { contains: search } }, { email: { contains: search } }],
      }),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Brides and leads" action={<ButtonLink href="/customers/new">+ New customer</ButtonLink>} />

      {/* A plain GET form: submitting it just changes the URL (?q=...&status=...) */}
      <form className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name, phone or email"
          className="min-w-60 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={statusFilter ?? ""} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.values(CustomerStatus).map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-line bg-surface px-4 py-2 text-sm">Search</button>
      </form>

      <Table headers={["Name", "Phone", "Wedding", "Budget", "Source", "Status"]} empty="No customers found.">
        {customers.map((c) => (
          <tr key={c.id} className="hover:bg-canvas">
            <Td>
              <Link href={`/customers/${c.id}`} className="font-medium hover:text-rose">
                {c.fullName}
              </Link>
            </Td>
            <Td>{c.phone}</Td>
            <Td>{date(c.weddingDate)}</Td>
            <Td className="tabular-nums">{money(c.budget)}</Td>
            <Td className="text-muted">{label(c.source)}</Td>
            <Td>
              <Badge value={c.status} />
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
