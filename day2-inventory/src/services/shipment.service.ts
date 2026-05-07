import { type InValue } from '@libsql/client';
import { getClient } from '../db/client.js';
import { CreateShipmentSchema, UpdateShipmentSchema, type CreateShipmentInput, type UpdateShipmentInput } from '../schemas/shipment.js';
import { updateOrderStatus } from './order.service.js';

export async function createShipment(input: CreateShipmentInput) {
  const data = CreateShipmentSchema.parse(input);
  const client = getClient();

  const order = await client.execute({ sql: `SELECT * FROM orders WHERE id = ?`, args: [data.order_id] });
  if (!order.rows[0]) throw new Error(`Order ${data.order_id} not found`);
  if (order.rows[0].status !== 'confirmed') {
    throw new Error(`Order must be confirmed before shipping (current: ${order.rows[0].status})`);
  }

  const result = await client.execute({
    sql: `INSERT INTO shipments (order_id, carrier, tracking_number) VALUES (?, ?, ?)`,
    args: [data.order_id, data.carrier, data.tracking_number ?? null],
  });

  await updateOrderStatus(data.order_id, 'shipped');

  return getShipmentById(Number(result.lastInsertRowid));
}

export async function updateShipment(orderId: number, input: UpdateShipmentInput) {
  const data = UpdateShipmentSchema.parse(input);
  const client = getClient();

  const shipment = await client.execute({ sql: `SELECT * FROM shipments WHERE order_id = ?`, args: [orderId] });
  if (!shipment.rows[0]) throw new Error(`Shipment for order ${orderId} not found`);

  const fields: string[] = [];
  const args: InValue[] = [];

  if (data.tracking_number !== undefined) { fields.push('tracking_number = ?'); args.push(data.tracking_number); }
  if (data.carrier !== undefined) { fields.push('carrier = ?'); args.push(data.carrier); }
  if (data.status !== undefined) {
    fields.push('status = ?');
    args.push(data.status);
    if (data.status === 'shipped') fields.push("shipped_at = datetime('now')");
    if (data.status === 'delivered') {
      fields.push("delivered_at = datetime('now')");
      await updateOrderStatus(orderId, 'delivered');
    }
  }

  if (fields.length === 0) return shipment.rows[0];

  args.push(orderId);
  await client.execute({
    sql: `UPDATE shipments SET ${fields.join(', ')} WHERE order_id = ?`,
    args,
  });

  return getShipmentByOrderId(orderId);
}

export async function getShipmentByOrderId(orderId: number) {
  const client = getClient();
  const result = await client.execute({ sql: `SELECT * FROM shipments WHERE order_id = ?`, args: [orderId] });
  return result.rows[0] ?? null;
}

async function getShipmentById(id: number) {
  const client = getClient();
  const result = await client.execute({ sql: `SELECT * FROM shipments WHERE id = ?`, args: [id] });
  return result.rows[0] ?? null;
}
