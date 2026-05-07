import { getClient } from '../db/client.js';
import { CreateOrderSchema, type CreateOrderInput } from '../schemas/order.js';
import { getStockLevel } from './stock.service.js';
import { getDiscountForProduct } from './campaign.service.js';

export async function createOrder(input: CreateOrderInput) {
  const data = CreateOrderSchema.parse(input);
  const client = getClient();
  const now = new Date().toISOString();

  const orderResult = await client.execute({
    sql: `INSERT INTO orders (customer_name, status, total_amount, discount_amount, created_at, updated_at) VALUES (?, 'pending', 0, 0, ?, ?)`,
    args: [data.customer_name, now, now],
  });
  const orderId = Number(orderResult.lastInsertRowid);

  let totalAmount = 0;
  let totalDiscount = 0;

  for (const item of data.items) {
    const product = await client.execute({ sql: `SELECT * FROM products WHERE id = ?`, args: [item.product_id] });
    if (!product.rows[0]) throw new Error(`Product ${item.product_id} not found`);

    const unitPrice = Number(product.rows[0].unit_price);
    const campaign = await getDiscountForProduct(item.product_id, now);

    let discount = 0;
    if (campaign) {
      if (campaign.discount_type === 'percentage') {
        discount = unitPrice * item.quantity * (Number(campaign.discount_value) / 100);
      } else {
        discount = Number(campaign.discount_value) * item.quantity;
      }
    }

    const lineTotal = unitPrice * item.quantity - discount;

    await client.execute({
      sql: `INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, line_total) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [orderId, item.product_id, item.quantity, unitPrice, discount, lineTotal],
    });

    totalAmount += lineTotal;
    totalDiscount += discount;
  }

  await client.execute({
    sql: `UPDATE orders SET total_amount = ?, discount_amount = ? WHERE id = ?`,
    args: [totalAmount, totalDiscount, orderId],
  });

  return getOrderById(orderId);
}

export async function getOrderById(id: number) {
  const client = getClient();
  const order = await client.execute({ sql: `SELECT * FROM orders WHERE id = ?`, args: [id] });
  if (!order.rows[0]) return null;

  const items = await client.execute({ sql: `SELECT * FROM order_items WHERE order_id = ?`, args: [id] });
  return { ...order.rows[0], items: items.rows };
}

export async function listOrders(status?: string) {
  const client = getClient();
  if (status) {
    const result = await client.execute({ sql: `SELECT * FROM orders WHERE status = ? ORDER BY id DESC`, args: [status] });
    return result.rows;
  }
  const result = await client.execute(`SELECT * FROM orders ORDER BY id DESC`);
  return result.rows;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export async function updateOrderStatus(id: number, newStatus: string) {
  const client = getClient();
  const order = await client.execute({ sql: `SELECT * FROM orders WHERE id = ?`, args: [id] });
  if (!order.rows[0]) throw new Error(`Order ${id} not found`);

  const currentStatus = String(order.rows[0].status);
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from '${currentStatus}' to '${newStatus}'`);
  }

  if (newStatus === 'confirmed') {
    const items = await client.execute({ sql: `SELECT * FROM order_items WHERE order_id = ?`, args: [id] });
    for (const item of items.rows) {
      const stock = await getStockLevel(Number(item.product_id));
      if (stock < Number(item.quantity)) {
        throw new Error(`Insufficient stock for product ${item.product_id}: available=${stock}, required=${item.quantity}`);
      }
    }
    for (const item of items.rows) {
      await client.execute({
        sql: `INSERT INTO stock_movements (product_id, direction, quantity, reason, reference_id, unit_cost, notes)
              VALUES (?, 'OUT', ?, 'sale', ?, 0, ?)`,
        args: [item.product_id, item.quantity, id, `Order #${id}`],
      });
    }
  }

  if (newStatus === 'cancelled' && currentStatus === 'confirmed') {
    const items = await client.execute({ sql: `SELECT * FROM order_items WHERE order_id = ?`, args: [id] });
    for (const item of items.rows) {
      await client.execute({
        sql: `INSERT INTO stock_movements (product_id, direction, quantity, reason, reference_id, unit_cost, notes)
              VALUES (?, 'IN', ?, 'return', ?, 0, ?)`,
        args: [item.product_id, item.quantity, id, `Cancelled order #${id}`],
      });
    }
  }

  await client.execute({
    sql: `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [newStatus, id],
  });

  return getOrderById(id);
}
