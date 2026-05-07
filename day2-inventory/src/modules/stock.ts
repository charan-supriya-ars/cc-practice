import { getClient } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface StockMovementInput {
  productId: number;
  warehouseId: number;
  quantity: number;
  referenceType?: string;
  referenceId?: number;
}

export interface StockStatus {
  product_id: number;
  warehouse_id: number;
  quantity: number;
  updated_at: string;
}

export async function stockIn(input: StockMovementInput): Promise<void> {
  if (input.quantity <= 0) throw new Error('Quantity must be > 0');

  const client = getClient();
  await client.execute('BEGIN');
  try {
    await assertExists('products', input.productId, 'Product');
    await assertExists('warehouses', input.warehouseId, 'Warehouse');

    await client.execute({
      sql: `INSERT INTO inventory (product_id, warehouse_id, quantity)
            VALUES (?, ?, ?)
            ON CONFLICT(product_id, warehouse_id)
            DO UPDATE SET quantity = quantity + excluded.quantity,
                          updated_at = datetime('now')`,
      args: [input.productId, input.warehouseId, input.quantity],
    });

    await client.execute({
      sql: `INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, reference_type, reference_id)
            VALUES (?, ?, 'in', ?, ?, ?)`,
      args: [
        input.productId,
        input.warehouseId,
        input.quantity,
        input.referenceType ?? null,
        input.referenceId ?? null,
      ],
    });

    await client.execute('COMMIT');
    logger.info(
      `Stock IN: product=${input.productId}, warehouse=${input.warehouseId}, qty=${input.quantity}`,
    );
  } catch (err) {
    await client.execute('ROLLBACK');
    throw err;
  }
}

export async function stockOut(input: StockMovementInput): Promise<void> {
  if (input.quantity <= 0) throw new Error('Quantity must be > 0');

  const client = getClient();
  await client.execute('BEGIN');
  try {
    await assertExists('products', input.productId, 'Product');
    await assertExists('warehouses', input.warehouseId, 'Warehouse');

    const existing = await client.execute({
      sql: 'SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ?',
      args: [input.productId, input.warehouseId],
    });
    const current = existing.rows[0] ? Number(existing.rows[0].quantity) : 0;

    if (current < input.quantity) {
      throw new Error(
        `Insufficient stock: product=${input.productId}, warehouse=${input.warehouseId}, available=${current}, requested=${input.quantity}`,
      );
    }

    await client.execute({
      sql: `UPDATE inventory
            SET quantity = quantity - ?, updated_at = datetime('now')
            WHERE product_id = ? AND warehouse_id = ?`,
      args: [input.quantity, input.productId, input.warehouseId],
    });

    await client.execute({
      sql: `INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, reference_type, reference_id)
            VALUES (?, ?, 'out', ?, ?, ?)`,
      args: [
        input.productId,
        input.warehouseId,
        input.quantity,
        input.referenceType ?? null,
        input.referenceId ?? null,
      ],
    });

    await client.execute('COMMIT');
    logger.info(
      `Stock OUT: product=${input.productId}, warehouse=${input.warehouseId}, qty=${input.quantity}`,
    );
  } catch (err) {
    await client.execute('ROLLBACK');
    throw err;
  }
}

export async function getStockStatus(
  productId?: number,
  warehouseId?: number,
): Promise<StockStatus[]> {
  const client = getClient();
  const conditions: string[] = [];
  const args: number[] = [];

  if (productId !== undefined) {
    conditions.push('product_id = ?');
    args.push(productId);
  }
  if (warehouseId !== undefined) {
    conditions.push('warehouse_id = ?');
    args.push(warehouseId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await client.execute({
    sql: `SELECT product_id, warehouse_id, quantity, updated_at
          FROM inventory
          ${where}
          ORDER BY product_id, warehouse_id`,
    args,
  });

  logger.info(
    `Stock status queried: productId=${productId ?? '*'}, warehouseId=${warehouseId ?? '*'}, rows=${result.rows.length}`,
  );

  return result.rows.map((row) => ({
    product_id: Number(row.product_id),
    warehouse_id: Number(row.warehouse_id),
    quantity: Number(row.quantity),
    updated_at: String(row.updated_at),
  }));
}

async function assertExists(
  table: 'products' | 'warehouses',
  id: number,
  label: string,
): Promise<void> {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT id FROM ${table} WHERE id = ?`,
    args: [id],
  });
  if (!result.rows[0]) throw new Error(`${label} id=${id} not found`);
}
