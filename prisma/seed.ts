// Fills the database with sample data so the app isn't empty.
// Run with: npm run db:seed   (it wipes existing data first!)
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

const day = 86_400_000;
const fromNow = (days: number, hour = 11) => {
  const d = new Date(Date.now() + days * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  // Delete in reverse dependency order.
  await db.payment.deleteMany();
  await db.alteration.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.appointment.deleteMany();
  await db.customer.deleteMany();
  await db.dress.deleteMany();
  await db.supplier.deleteMany();
  await db.staff.deleteMany();

  const [owner, consultant, seamstress] = await Promise.all([
    db.staff.create({ data: { name: "Sharlin Owner", role: "OWNER" } }),
    db.staff.create({ data: { name: "Madina", role: "CONSULTANT" } }),
    db.staff.create({ data: { name: "Nodira", role: "SEAMSTRESS" } }),
  ]);

  const atelier = await db.supplier.create({
    data: { name: "Bella Sposa Atelier", contactName: "Laura", email: "orders@example.com" },
  });
  const house = await db.supplier.create({
    data: { name: "Ivory House", contactName: "Omar", phone: "+1 555 0100" },
  });

  const dresses = await Promise.all(
    [
      { sku: "SH-001", name: "Aurora", silhouette: "Ball gown", color: "Ivory", price: 2400, rentalPrice: 600, cost: 1100, stock: 2, supplierId: atelier.id },
      { sku: "SH-002", name: "Celeste", silhouette: "Mermaid", color: "White", price: 3100, rentalPrice: 750, cost: 1500, stock: 1, supplierId: atelier.id },
      { sku: "SH-003", name: "Lina", silhouette: "A-line", color: "Champagne", price: 1650, rentalPrice: 400, cost: 700, stock: 3, supplierId: house.id },
      { sku: "SH-004", name: "Noor", silhouette: "Sheath", color: "Ivory", price: 1200, rentalPrice: null, cost: 500, stock: 0, supplierId: house.id },
      { sku: "SH-005", name: "Seraphine", silhouette: "Ball gown", color: "Blush", price: 3800, rentalPrice: 900, cost: 1900, stock: 1, supplierId: atelier.id },
    ].map((data) => db.dress.create({ data: { ...data, size: "36–42" } })),
  );

  const aziza = await db.customer.create({
    data: { fullName: "Aziza K.", phone: "+1 555 0111", weddingDate: fromNow(45), budget: 3000, status: "BOOKED", source: "INSTAGRAM" },
  });
  const sara = await db.customer.create({
    data: { fullName: "Sara M.", phone: "+1 555 0122", email: "sara@example.com", weddingDate: fromNow(12), budget: 1000, status: "BOOKED", source: "REFERRAL" },
  });
  const leila = await db.customer.create({
    data: { fullName: "Leila R.", phone: "+1 555 0133", weddingDate: fromNow(120), budget: 2000, status: "CONSULTED", source: "WALK_IN" },
  });
  const dilnoza = await db.customer.create({
    data: { fullName: "Dilnoza T.", phone: "+1 555 0144", weddingDate: fromNow(200), status: "LEAD", source: "TELEGRAM", notes: "Wants a long train." },
  });

  // A sale with deposit and an alteration in progress.
  await db.order.create({
    data: {
      customerId: aziza.id,
      type: "SALE",
      status: "IN_ALTERATIONS",
      eventDate: aziza.weddingDate,
      items: { create: { dressId: dresses[1].id, size: "38", price: 3000 } },
      payments: { create: [{ amount: 1000, method: "CARD", paidAt: fromNow(-30) }] },
      alterations: {
        create: [
          { description: "Take in waist 2cm, hem", price: 150, dueDate: fromNow(20), status: "IN_PROGRESS", staffId: seamstress.id },
        ],
      },
    },
  });

  // A rental, fully paid, ready for pickup.
  await db.order.create({
    data: {
      customerId: sara.id,
      type: "RENTAL",
      status: "READY",
      eventDate: sara.weddingDate,
      returnDueDate: fromNow(14),
      items: { create: { dressId: dresses[2].id, size: "36", price: 400 } },
      payments: { create: [{ amount: 400, method: "CASH", paidAt: fromNow(-10) }] },
    },
  });

  await db.appointment.createMany({
    data: [
      { customerId: sara.id, staffId: consultant.id, startsAt: fromNow(1, 15), type: "PICKUP" },
      { customerId: aziza.id, staffId: seamstress.id, startsAt: fromNow(3, 12), type: "FITTING" },
      { customerId: dilnoza.id, staffId: consultant.id, startsAt: fromNow(2, 11), type: "CONSULTATION" },
      { customerId: leila.id, staffId: owner.id, startsAt: fromNow(-5, 14), type: "CONSULTATION", status: "COMPLETED" },
    ],
  });

  console.log("Seeded Sharlin sample data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
