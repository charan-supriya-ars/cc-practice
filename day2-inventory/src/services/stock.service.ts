import { getClient } from '../db/client.js';
import { InboundSchema, OutboundSchema, type InboundInput, type OutboundInput } from '../schemas/stock.js';

export async function getStockLevel(productId: number): Promise<number> {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT COALESCE(SUM(CASE WHEN direction='IN' THEN quantity ELSE -quantity END), 0) as stock
          FROM stock_movements WHERE product_id = ?`,
    args: [productId],
  });
  return Number(result.rows[0].stock);
}

export async function recordInbound(input: InboundInput) {
  const data = InboundSchema.parse(input);
  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO stock_movements (product_id, direction, quantity, reason, unit_cost, notes)
          VALUES (?, 'IN', ?, ?, ?, ?)`,
    args: [data.product_id, data.quantity, data.reason, data.unit_cost, data.notes],
  });
  return getMovementById(Number(result.lastInsertRowid));
}

export async function recordOutbound(input: OutboundInput) {
  const data = OutboundSchema.parse(input);

  const currentStock = await getStockLevel(data.product_id);
  if (currentStock < data.quantity) {
    throw new Error(`Insufficient stock: available=${currentStock}, requested=${data.quantity}`);
  }

  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO stock_movements (product_id, direction, quantity, reason, reference_id, unit_cost, notes)
          VALUES (?, 'OUT', ?, ?, ?, ?, ?)`,
    args: [data.product_id, data.quantity, data.reason, data.reference_id ?? null, data.unit_cost, data.notes],
  });
  return getMovementById(Number(result.lastInsertRowid));
}

export async function getMovements(productId: number) {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC`,
    args: [productId],
  });
  return result.rows;
}

async function getMovementById(id: number) {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM stock_movements WHERE id = ?`,
    args: [id],
  });
  return result.rows[0] ?? null;
}
