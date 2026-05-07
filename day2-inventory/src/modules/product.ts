import { getClient } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  created_at: string;
  updated_at: string;
}

export interface AddProductInput {
  sku: string;
  name: string;
  description?: string;
  price: number;
  cost: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  cost?: number;
}

export async function addProduct(input: AddProductInput): Promise<Product> {
  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO products (sku, name, description, price, cost)
          VALUES (?, ?, ?, ?, ?)`,
    args: [input.sku, input.name, input.description ?? '', input.price, input.cost],
  });

  const id = Number(result.lastInsertRowid);
  logger.info(`Product created: id=${id}, sku=${input.sku}`);

  const product = await findById(id);
  if (!product) throw new Error(`Failed to retrieve created product id=${id}`);
  return product;
}

export async function listProducts(): Promise<Product[]> {
  const client = getClient();
  const result = await client.execute('SELECT * FROM products ORDER BY id');
  logger.info(`Listed ${result.rows.length} products`);
  return result.rows.map(toProduct);
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
  const existing = await findById(id);
  if (!existing) throw new Error(`Product id=${id} not found`);

  const fields: string[] = [];
  const args: (string | number)[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); args.push(input.name); }
  if (input.description !== undefined) { fields.push('description = ?'); args.push(input.description); }
  if (input.price !== undefined) { fields.push('price = ?'); args.push(input.price); }
  if (input.cost !== undefined) { fields.push('cost = ?'); args.push(input.cost); }

  if (fields.length === 0) {
    logger.warn(`updateProduct called with no changes for id=${id}`);
    return existing;
  }

  fields.push("updated_at = datetime('now')");
  args.push(id);

  const client = getClient();
  await client.execute({
    sql: `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });

  logger.info(`Product updated: id=${id}`);
  const updated = await findById(id);
  if (!updated) throw new Error(`Failed to retrieve updated product id=${id}`);
  return updated;
}

export async function deleteProduct(id: number): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw new Error(`Product id=${id} not found`);

  const client = getClient();

  const refs = await client.execute({
    sql: 'SELECT COUNT(*) as cnt FROM stock_movements WHERE product_id = ?',
    args: [id],
  });
  if (Number(refs.rows[0].cnt) > 0) {
    throw new Error(`Cannot delete product id=${id}: stock movements exist`);
  }

  const invRefs = await client.execute({
    sql: 'SELECT COUNT(*) as cnt FROM inventory WHERE product_id = ?',
    args: [id],
  });
  if (Number(invRefs.rows[0].cnt) > 0) {
    throw new Error(`Cannot delete product id=${id}: inventory records exist`);
  }

  await client.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [id] });
  logger.info(`Product deleted: id=${id}`);
}

async function findById(id: number): Promise<Product | null> {
  const client = getClient();
  const result = await client.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [id] });
  if (!result.rows[0]) return null;
  return toProduct(result.rows[0]);
}

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: Number(row.id),
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description),
    price: Number(row.price),
    cost: Number(row.cost),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
