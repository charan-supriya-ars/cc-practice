import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import { addProduct, listProducts, updateProduct, deleteProduct } from '../src/modules/product.js';
import { getClient } from '../src/db/client.js';

describe('Product Module', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  // ── addProduct ──

  describe('addProduct', () => {
    it('should create a product and return it', async () => {
      const product = await addProduct({
        sku: 'SKU-001',
        name: 'テスト商品',
        description: '説明文',
        price: 1000,
        cost: 500,
      });

      expect(product.id).toBe(1);
      expect(product.sku).toBe('SKU-001');
      expect(product.name).toBe('テスト商品');
      expect(product.description).toBe('説明文');
      expect(product.price).toBe(1000);
      expect(product.cost).toBe(500);
      expect(product.created_at).toBeTruthy();
      expect(product.updated_at).toBeTruthy();
    });

    it('should default description to empty string', async () => {
      const product = await addProduct({ sku: 'SKU-002', name: 'No Desc', price: 100, cost: 50 });
      expect(product.description).toBe('');
    });

    it('should reject duplicate SKU', async () => {
      await addProduct({ sku: 'DUP', name: 'First', price: 100, cost: 50 });
      await expect(
        addProduct({ sku: 'DUP', name: 'Second', price: 200, cost: 100 }),
      ).rejects.toThrow();
    });

    it('should reject negative price', async () => {
      await expect(
        addProduct({ sku: 'NEG', name: 'Negative', price: -1, cost: 50 }),
      ).rejects.toThrow();
    });
  });

  // ── listProducts ──

  describe('listProducts', () => {
    it('should return empty array when no products exist', async () => {
      const products = await listProducts();
      expect(products).toEqual([]);
    });

    it('should return all products ordered by id', async () => {
      await addProduct({ sku: 'A', name: 'Product A', price: 100, cost: 50 });
      await addProduct({ sku: 'B', name: 'Product B', price: 200, cost: 100 });
      await addProduct({ sku: 'C', name: 'Product C', price: 300, cost: 150 });

      const products = await listProducts();
      expect(products).toHaveLength(3);
      expect(products[0].sku).toBe('A');
      expect(products[1].sku).toBe('B');
      expect(products[2].sku).toBe('C');
    });
  });

  // ── updateProduct ──

  describe('updateProduct', () => {
    it('should update specified fields only', async () => {
      await addProduct({ sku: 'UPD', name: 'Original', price: 100, cost: 50 });

      const updated = await updateProduct(1, { name: 'Updated', price: 200 });
      expect(updated.name).toBe('Updated');
      expect(updated.price).toBe(200);
      expect(updated.cost).toBe(50); // unchanged
      expect(updated.sku).toBe('UPD'); // unchanged
    });

    it('should return existing product when no fields provided', async () => {
      await addProduct({ sku: 'NOP', name: 'No Change', price: 100, cost: 50 });
      const result = await updateProduct(1, {});
      expect(result.name).toBe('No Change');
    });

    it('should throw for non-existent product', async () => {
      await expect(updateProduct(999, { name: 'Ghost' })).rejects.toThrow('not found');
    });
  });

  // ── deleteProduct ──

  describe('deleteProduct', () => {
    it('should delete a product with no references', async () => {
      await addProduct({ sku: 'DEL', name: 'Delete Me', price: 100, cost: 50 });
      await deleteProduct(1);

      const products = await listProducts();
      expect(products).toHaveLength(0);
    });

    it('should throw for non-existent product', async () => {
      await expect(deleteProduct(999)).rejects.toThrow('not found');
    });

    it('should throw when stock movements exist', async () => {
      await addProduct({ sku: 'REF', name: 'Referenced', price: 100, cost: 50 });

      // Insert a warehouse and movement to block deletion
      const client = getClient();
      await client.execute({
        sql: "INSERT INTO warehouses (name, location) VALUES ('Main', 'Tokyo')",
        args: [],
      });
      await client.execute({
        sql: "INSERT INTO stock_movements (product_id, warehouse_id, type, quantity) VALUES (1, 1, 'in', 10)",
        args: [],
      });

      await expect(deleteProduct(1)).rejects.toThrow('stock movements exist');
    });

    it('should throw when inventory records exist', async () => {
      await addProduct({ sku: 'INV', name: 'In Inventory', price: 100, cost: 50 });

      const client = getClient();
      await client.execute({
        sql: "INSERT INTO warehouses (name, location) VALUES ('Sub', 'Osaka')",
        args: [],
      });
      await client.execute({
        sql: 'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (1, 1, 5)',
        args: [],
      });

      await expect(deleteProduct(1)).rejects.toThrow('inventory records exist');
    });
  });
});
