// In-memory order store.
export type Order = { id: string; chargeId: string; total: number; placedAt: string; status: "shipped" | "delivered"; priorRefunds: number };

const orders: Order[] = [
  { id: "A-100", chargeId: "ch_1", total: 89.5, placedAt: "2026-09-12", status: "delivered", priorRefunds: 0 },
  { id: "A-101", chargeId: "ch_2", total: 899, placedAt: "2026-09-20", status: "delivered", priorRefunds: 2 },
];

export function findOrder(id: string): Order | undefined { return orders.find(o => o.id === id); }
