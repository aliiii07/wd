"use server";

// Server Actions: functions that run on the server when a <form> is submitted.
// Each one reads the form, writes to the database, then refreshes the pages
// that show that data (revalidatePath) or sends the user to a new page (redirect).
//
// TODO before putting the app on the internet: add login and check it at the
// top of every action. Right now anyone who can open the app can change data.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { int, oneOf, optionalDate, optionalInt, optionalText, requiredDate, text } from "@/lib/form";
import {
  AlterationStatus,
  AppointmentStatus,
  AppointmentType,
  CustomerStatus,
  LeadSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  StaffRole,
} from "@/generated/prisma/enums";

// ─── Customers ───

export async function createCustomer(form: FormData) {
  const customer = await db.customer.create({
    data: {
      fullName: text(form, "fullName"),
      phone: text(form, "phone"),
      email: optionalText(form, "email"),
      weddingDate: optionalDate(form, "weddingDate"),
      budget: optionalInt(form, "budget"),
      source: oneOf(form, "source", LeadSource),
      notes: optionalText(form, "notes"),
    },
  });
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerStatus(form: FormData) {
  const id = int(form, "id");
  await db.customer.update({
    where: { id },
    data: { status: oneOf(form, "status", CustomerStatus) },
  });
  revalidatePath(`/customers/${id}`);
}

// ─── Appointments ───

export async function createAppointment(form: FormData) {
  const customerId = int(form, "customerId");
  await db.appointment.create({
    data: {
      customerId,
      staffId: optionalInt(form, "staffId"),
      startsAt: requiredDate(form, "startsAt"),
      type: oneOf(form, "type", AppointmentType),
      notes: optionalText(form, "notes"),
    },
  });
  redirect(form.get("returnTo") === "customer" ? `/customers/${customerId}` : "/appointments");
}

export async function setAppointmentStatus(form: FormData) {
  await db.appointment.update({
    where: { id: int(form, "id") },
    data: { status: oneOf(form, "status", AppointmentStatus) },
  });
  revalidatePath("/", "layout");
}

// ─── Dresses (inventory) ───

export async function createDress(form: FormData) {
  const sku = text(form, "sku");
  if (await db.dress.findUnique({ where: { sku } })) throw new Error(`A dress with SKU "${sku}" already exists`);
  await db.dress.create({
    data: {
      sku,
      name: text(form, "name"),
      designer: optionalText(form, "designer"),
      silhouette: optionalText(form, "silhouette"),
      color: optionalText(form, "color"),
      size: optionalText(form, "size"),
      price: int(form, "price"),
      rentalPrice: optionalInt(form, "rentalPrice"),
      cost: optionalInt(form, "cost"),
      stock: optionalInt(form, "stock") ?? 0,
      supplierId: optionalInt(form, "supplierId"),
      notes: optionalText(form, "notes"),
    },
  });
  redirect("/dresses");
}

export async function adjustStock(form: FormData) {
  const id = int(form, "id");
  const change = int(form, "change");
  const dress = await db.dress.findUniqueOrThrow({ where: { id } });
  if (dress.stock + change < 0) throw new Error("Stock cannot go below zero");
  await db.dress.update({ where: { id }, data: { stock: { increment: change } } });
  revalidatePath("/dresses");
}

// ─── Orders ───

// Price for a dress on an order: what was typed, or the catalog price.
async function priceFor(form: FormData, dressId: number, type: OrderType) {
  const typed = optionalInt(form, "price");
  if (typed != null) return typed;
  const dress = await db.dress.findUniqueOrThrow({ where: { id: dressId } });
  if (type === "RENTAL" && dress.rentalPrice == null) throw new Error(`${dress.name} is not available for rent`);
  return type === "RENTAL" ? dress.rentalPrice! : dress.price;
}

export async function createOrder(form: FormData) {
  const dressId = int(form, "dressId");
  const type = oneOf(form, "type", OrderType);
  const price = await priceFor(form, dressId, type);
  const deposit = optionalInt(form, "deposit");
  const order = await db.order.create({
    data: {
      customerId: int(form, "customerId"),
      type,
      status: deposit ? "CONFIRMED" : "QUOTE",
      eventDate: optionalDate(form, "eventDate"),
      returnDueDate: optionalDate(form, "returnDueDate"),
      notes: optionalText(form, "notes"),
      items: {
        create: { dressId, size: optionalText(form, "size"), price },
      },
      payments: deposit
        ? { create: { amount: deposit, method: oneOf(form, "method", PaymentMethod), note: "Deposit" } }
        : undefined,
    },
  });
  // A customer with an order is booked.
  await db.customer.updateMany({
    where: { id: order.customerId, status: { in: ["LEAD", "CONSULTED"] } },
    data: { status: "BOOKED" },
  });
  redirect(`/orders/${order.id}`);
}

export async function setOrderStatus(form: FormData) {
  const id = int(form, "id");
  await db.order.update({ where: { id }, data: { status: oneOf(form, "status", OrderStatus) } });
  revalidatePath(`/orders/${id}`);
}

export async function addOrderItem(form: FormData) {
  const orderId = int(form, "orderId");
  const dressId = int(form, "dressId");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await db.orderItem.create({
    data: {
      orderId,
      dressId,
      size: optionalText(form, "size"),
      price: await priceFor(form, dressId, order.type),
      quantity: optionalInt(form, "quantity") ?? 1,
    },
  });
  revalidatePath(`/orders/${orderId}`);
}

export async function addPayment(form: FormData) {
  const orderId = int(form, "orderId");
  const amount = int(form, "amount");
  if (amount <= 0) throw new Error("Payment amount must be more than zero");
  await db.payment.create({
    data: {
      orderId,
      amount,
      method: oneOf(form, "method", PaymentMethod),
      note: optionalText(form, "note"),
    },
  });
  revalidatePath(`/orders/${orderId}`);
}

export async function addAlteration(form: FormData) {
  const orderId = int(form, "orderId");
  await db.alteration.create({
    data: {
      orderId,
      description: text(form, "description"),
      price: optionalInt(form, "price") ?? 0,
      dueDate: optionalDate(form, "dueDate"),
      staffId: optionalInt(form, "staffId"),
    },
  });
  revalidatePath(`/orders/${orderId}`);
}

export async function setAlterationStatus(form: FormData) {
  const alteration = await db.alteration.update({
    where: { id: int(form, "id") },
    data: { status: oneOf(form, "status", AlterationStatus) },
  });
  revalidatePath(`/orders/${alteration.orderId}`);
}

// ─── Suppliers & staff ───

export async function createSupplier(form: FormData) {
  await db.supplier.create({
    data: {
      name: text(form, "name"),
      contactName: optionalText(form, "contactName"),
      phone: optionalText(form, "phone"),
      email: optionalText(form, "email"),
      notes: optionalText(form, "notes"),
    },
  });
  revalidatePath("/suppliers");
}

export async function createStaff(form: FormData) {
  await db.staff.create({
    data: {
      name: text(form, "name"),
      role: oneOf(form, "role", StaffRole),
      phone: optionalText(form, "phone"),
    },
  });
  revalidatePath("/staff");
}
