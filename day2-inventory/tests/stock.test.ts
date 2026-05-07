import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { stockIn, stockOut, getStockStatus } from '../src/modules/stock.js';
import { addProduct } from '../src/modules/product.js';
import { getClient } from '../src/db/client.js';

async function addWarehouse(name: string, location: string): Promise<number> {
  const client = getClient();
  const result = await client.execute({
    sql: 'INSERT INTO warehouses (name, location) VALUES (?, ?)',
    args: [name, location],
  });
  return Number(result.lastInsertRowid);
}

async function getMovements(): Promise<Record<string, unknown>[]> {
  const client = getClient();
  const result = await client.execute('SELECT * FROM stock_movements ORDER BY id');
  return result.rows as Record<string, unknown>[];
}

describe('Stock Module', () => {
  beforeEach(async () => {
    await setupTestDb();
    await addProduct({ sku: 'P1', name: '商品1', price: 1000, cost: 500 });
    await addProduct({ sku: 'P2', name: '商品2', price: 2000, cost: 800 });
    await addWarehouse('東京倉庫', 'Tokyo');
    await addWarehouse('大阪倉庫', 'Osaka');
  });

  // ── stockIn ──

  describe('stockIn', () => {
    it('should create inventory row when none exists', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 100 });

      const status = await getStockStatus(1, 1);
      expect(status).toHaveLength(1);
      expect(status[0].quantity).toBe(100);
    });

    it('should increment quantity when inventory already exists', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 100 });
      await stockIn({ productId: 1, warehouseId: 1, quantity: 50 });

      const status = await getStockStatus(1, 1);
      expect(status[0].quantity).toBe(150);
    });

    it('should keep separate quantities per warehouse', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 100 });
      await stockIn({ productId: 1, warehouseId: 2, quantity: 30 });

      const all = await getStockStatus(1);
      expect(all).toHaveLength(2);
      expect(all.find((s) => s.warehouse_id === 1)!.quantity).toBe(100);
      expect(all.find((s) => s.warehouse_id === 2)!.quantity).toBe(30);
    });

    it('should record a stock_movement row with type=in', async () => {
      await stockIn({
        productId: 1,
        warehouseId: 1,
        quantity: 10,
        referenceType: 'purchase',
        referenceId: 42,
      });

      const movements = await getMovements();
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('in');
      expect(Number(movements[0].quantity)).toBe(10);
      expect(movements[0].reference_type).toBe('purchase');
      expect(Number(movements[0].reference_id)).toBe(42);
    });

    it('should allow null reference fields', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 5 });
      const movements = await getMovements();
      expect(movements[0].reference_type).toBeNull();
      expect(movements[0].reference_id).toBeNull();
    });

    it('should reject zero quantity', async () => {
      await expect(
        stockIn({ productId: 1, warehouseId: 1, quantity: 0 }),
      ).rejects.toThrow('Quantity must be > 0');
    });

    it('should reject negative quantity', async () => {
      await expect(
        stockIn({ productId: 1, warehouseId: 1, quantity: -5 }),
      ).rejects.toThrow('Quantity must be > 0');
    });

    it('should reject non-existent product', async () => {
      await expect(
        stockIn({ productId: 999, warehouseId: 1, quantity: 10 }),
      ).rejects.toThrow('Product id=999 not found');
    });

    it('should reject non-existent warehouse', async () => {
      await expect(
        stockIn({ productId: 1, warehouseId: 999, quantity: 10 }),
      ).rejects.toThrow('Warehouse id=999 not found');
    });

    it('should rollback movement when validation fails', async () => {
      await expect(
        stockIn({ productId: 999, warehouseId: 1, quantity: 10 }),
      ).rejects.toThrow();

      const movements = await getMovements();
      expect(movements).toHaveLength(0);
    });
  });

  // ── stockOut ──

  describe('stockOut', () => {
    beforeEach(async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 100 });
    });

    it('should decrement inventory quantity', async () => {
      await stockOut({ productId: 1, warehouseId: 1, quantity: 30 });

      const status = await getStockStatus(1, 1);
      expect(status[0].quantity).toBe(70);
    });

    it('should record a stock_movement row with type=out', async () => {
      await stockOut({
        productId: 1,
        warehouseId: 1,
        quantity: 10,
        referenceType: 'order',
        referenceId: 7,
      });

      const movements = await getMovements();
      const outMovement = movements.find((m) => m.type === 'out')!;
      expect(Number(outMovement.quantity)).toBe(10);
      expect(outMovement.reference_type).toBe('order');
      expect(Number(outMovement.reference_id)).toBe(7);
    });

    it('should allow exact depletion (quantity = current)', async () => {
      await stockOut({ productId: 1, warehouseId: 1, quantity: 100 });
      const status = await getStockStatus(1, 1);
      expect(status[0].quantity).toBe(0);
    });

    it('should reject insufficient stock', async () => {
      await expect(
        stockOut({ productId: 1, warehouseId: 1, quantity: 200 }),
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject when inventory row does not exist (treated as 0)', async () => {
      await expect(
        stockOut({ productId: 2, warehouseId: 1, quantity: 1 }),
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject zero quantity', async () => {
      await expect(
        stockOut({ productId: 1, warehouseId: 1, quantity: 0 }),
      ).rejects.toThrow('Quantity must be > 0');
    });

    it('should reject negative quantity', async () => {
      await expect(
        stockOut({ productId: 1, warehouseId: 1, quantity: -1 }),
      ).rejects.toThrow('Quantity must be > 0');
    });

    it('should reject non-existent product', async () => {
      await expect(
        stockOut({ productId: 999, warehouseId: 1, quantity: 1 }),
      ).rejects.toThrow('Product id=999 not found');
    });

    it('should reject non-existent warehouse', async () => {
      await expect(
        stockOut({ productId: 1, warehouseId: 999, quantity: 1 }),
      ).rejects.toThrow('Warehouse id=999 not found');
    });

    it('should rollback when insufficient stock', async () => {
      const before = (await getMovements()).length;
      await expect(
        stockOut({ productId: 1, warehouseId: 1, quantity: 9999 }),
      ).rejects.toThrow();

      const after = await getMovements();
      expect(after).toHaveLength(before);
      const status = await getStockStatus(1, 1);
      expect(status[0].quantity).toBe(100);
    });
  });

  // ── getStockStatus ──

  describe('getStockStatus', () => {
    it('should return empty array when no inventory exists', async () => {
      const status = await getStockStatus();
      expect(status).toEqual([]);
    });

    it('should return all inventory rows when no filter', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 10 });
      await stockIn({ productId: 1, warehouseId: 2, quantity: 20 });
      await stockIn({ productId: 2, warehouseId: 1, quantity: 30 });

      const status = await getStockStatus();
      expect(status).toHaveLength(3);
    });

    it('should filter by productId only', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 10 });
      await stockIn({ productId: 1, warehouseId: 2, quantity: 20 });
      await stockIn({ productId: 2, warehouseId: 1, quantity: 30 });

      const status = await getStockStatus(1);
      expect(status).toHaveLength(2);
      expect(status.every((s) => s.product_id === 1)).toBe(true);
    });

    it('should filter by warehouseId only', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 10 });
      await stockIn({ productId: 2, warehouseId: 1, quantity: 20 });
      await stockIn({ productId: 1, warehouseId: 2, quantity: 30 });

      const status = await getStockStatus(undefined, 1);
      expect(status).toHaveLength(2);
      expect(status.every((s) => s.warehouse_id === 1)).toBe(true);
    });

    it('should filter by both productId and warehouseId', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 10 });
      await stockIn({ productId: 1, warehouseId: 2, quantity: 20 });

      const status = await getStockStatus(1, 2);
      expect(status).toHaveLength(1);
      expect(status[0].product_id).toBe(1);
      expect(status[0].warehouse_id).toBe(2);
      expect(status[0].quantity).toBe(20);
    });

    it('should return rows ordered by product_id, warehouse_id', async () => {
      await stockIn({ productId: 2, warehouseId: 2, quantity: 1 });
      await stockIn({ productId: 1, warehouseId: 2, quantity: 2 });
      await stockIn({ productId: 2, warehouseId: 1, quantity: 3 });
      await stockIn({ productId: 1, warehouseId: 1, quantity: 4 });

      const status = await getStockStatus();
      expect(status.map((s) => [s.product_id, s.warehouse_id])).toEqual([
        [1, 1],
        [1, 2],
        [2, 1],
        [2, 2],
      ]);
    });

    it('should include zero-quantity rows after full depletion', async () => {
      await stockIn({ productId: 1, warehouseId: 1, quantity: 5 });
      await stockOut({ productId: 1, warehouseId: 1, quantity: 5 });

      const status = await getStockStatus(1, 1);
      expect(status).toHaveLength(1);
      expect(status[0].quantity).toBe(0);
    });
  });
});
