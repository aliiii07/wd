import Link from "next/link";
import { connection } from "next/server";
import { Badge, ButtonLink, PageHeader, StatusForm, Table, Td } from "@/components/ui";
import { setAppointmentStatus } from "@/lib/actions";
import { db } from "@/lib/db";
import { dateTime, label } from "@/lib/format";
import { AppointmentStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Appointments" };

export default async function AppointmentsPage(props: PageProps<"/appointments">) {
  await connection();
  const { show } = await props.searchParams;
  const past = show === "past";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const appointments = await db.appointment.findMany({
    where: { startsAt: past ? { lt: startOfToday } : { gte: startOfToday } },
    include: { customer: true, staff: true },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Appointments" action={<ButtonLink href="/appointments/new">+ Book appointment</ButtonLink>} />

      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/appointments" className={!past ? "font-medium text-rose" : "text-muted"}>Upcoming</Link>
        <span className="text-line">|</span>
        <Link href="/appointments?show=past" className={past ? "font-medium text-rose" : "text-muted"}>Past</Link>
      </div>

      <Table headers={["When", "Customer", "Type", "With", "Status", ""]} empty={past ? "No past appointments." : "No upcoming appointments."}>
        {appointments.map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap">{dateTime(a.startsAt)}</Td>
            <Td>
              <Link href={`/customers/${a.customerId}`} className="font-medium hover:text-rose">{a.customer.fullName}</Link>
              {a.notes && <p className="text-xs text-muted">{a.notes}</p>}
            </Td>
            <Td>{label(a.type)}</Td>
            <Td>{a.staff?.name ?? "—"}</Td>
            <Td><Badge value={a.status} /></Td>
            <Td><StatusForm action={setAppointmentStatus} id={a.id} value={a.status} options={AppointmentStatus} /></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
