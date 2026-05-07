import { type InValue } from '@libsql/client';
import { getClient } from '../db/client.js';
import { CreateProductSchema, UpdateProductSchema, type CreateProductInput, type UpdateProductInput } from '../schemas/product.js';

export async function createProduct(input: CreateProductInput) {
  const data = CreateProductSchema.parse(input);
  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO products (sku, name, description, unit_price, cost_price) VALUES (?, ?, ?, ?, ?)`,
    args: [data.sku, data.name, data.description, data.unit_price, data.cost_price],
  });
  return getProductById(Number(result.lastInsertRowid));
}

export async function getProductById(id: number) {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT * FROM products WHERE id = ?`,
    args: [id],
  });
  return result.rows[0] ?? null;
}

export async function getAllProducts() {
  const client = getClient();
  const result = await client.execute(`SELECT * FROM products ORDER BY id`);
  return result.rows;
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const data = UpdateProductSchema.parse(input);
  const fields: string[] = [];
  const args: InValue[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); args.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); args.push(data.description); }
  if (data.unit_price !== undefined) { fields.push('unit_price = ?'); args.push(data.unit_price); }
  if (data.cost_price !== undefined) { fields.push('cost_price = ?'); args.push(data.cost_price); }

  if (fields.length === 0) return getProductById(id);

  fields.push("updated_at = datetime('now')");
  args.push(id);

  const client = getClient();
  await client.execute({
    sql: `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
  return getProductById(id);
}

export async function deleteProduct(id: number) {
  const client = getClient();

  const movements = await client.execute({
    sql: `SELECT COUNT(*) as count FROM stock_movements WHERE product_id = ?`,
    args: [id],
  });
  if (Number(movements.rows[0].count) > 0) {
    throw new Error('Cannot delete product with existing stock movements');
  }

  await client.execute({ sql: `DELETE FROM products WHERE id = ?`, args: [id] });
  return true;
}
