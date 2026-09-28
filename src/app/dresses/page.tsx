import { connection } from "next/server";
import { ButtonLink, PageHeader, Table, Td } from "@/components/ui";
import { adjustStock } from "@/lib/actions";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Dresses" };

export default async function DressesPage() {
  await connection();
  const dresses = await db.dress.findMany({ include: { supplier: true }, orderBy: { sku: "asc" } });
  const stockValue = dresses.reduce((sum, d) => sum + (d.cost ?? 0) * d.stock, 0);

  return (
    <>
      <PageHeader
        title="Dresses"
        subtitle={`${dresses.length} models · stock value at cost ${money(stockValue)}`}
        action={<ButtonLink href="/dresses/new">+ Add dress</ButtonLink>}
      />
      <Table headers={["SKU", "Dress", "Supplier", "Price", "Rental", "Cost", "In stock"]} empty="No dresses yet. Add your first one.">
        {dresses.map((d) => (
          <tr key={d.id} className={d.isActive ? "" : "opacity-50"}>
            <Td className="text-muted">{d.sku}</Td>
            <Td>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-muted">{[d.designer, d.silhouette, d.color, d.size].filter(Boolean).join(" · ")}</p>
            </Td>
            <Td>{d.supplier?.name ?? "—"}</Td>
            <Td className="tabular-nums">{money(d.price)}</Td>
            <Td className="tabular-nums">{money(d.rentalPrice)}</Td>
            <Td className="tabular-nums text-muted">{money(d.cost)}</Td>
            <Td>
              <div className="flex items-center gap-2">
                <StockButton id={d.id} change={-1} disabled={d.stock <= 0} />
                <span className={`w-6 text-center tabular-nums ${d.stock <= 0 ? "font-medium text-red-600" : ""}`}>{d.stock}</span>
                <StockButton id={d.id} change={1} />
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function StockButton({ id, change, disabled }: { id: number; change: number; disabled?: boolean }) {
  return (
    <form action={adjustStock}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="change" value={change} />
      <button
        disabled={disabled}
        aria-label={change > 0 ? "Add one to stock" : "Remove one from stock"}
        className="h-7 w-7 rounded border border-line text-sm hover:bg-canvas disabled:opacity-30"
      >
        {change > 0 ? "+" : "−"}
      </button>
    </form>
  );
}
