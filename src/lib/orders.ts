// Order math lives in one place so every page shows the same numbers.

type OrderMoney = {
  items: { price: number; quantity: number }[];
  alterations: { price: number }[];
  payments: { amount: number }[];
};

export function orderTotals(order: OrderMoney) {
  const dresses = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const alterations = order.alterations.reduce((sum, a) => sum + a.price, 0);
  const total = dresses + alterations;
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  return { dresses, alterations, total, paid, balance: total - paid };
}

// Include this in a Prisma query to get everything orderTotals() needs.
export const orderMoneyInclude = {
  items: { select: { price: true, quantity: true } },
  alterations: { select: { price: true } },
  payments: { select: { amount: true } },
} as const;
