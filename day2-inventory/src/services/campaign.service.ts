import { type InValue } from '@libsql/client';
import { getClient } from '../db/client.js';
import { CreateCampaignSchema, UpdateCampaignSchema, type CreateCampaignInput, type UpdateCampaignInput } from '../schemas/campaign.js';

export async function createCampaign(input: CreateCampaignInput) {
  const data = CreateCampaignSchema.parse(input);
  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO campaigns (name, discount_type, discount_value, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
    args: [data.name, data.discount_type, data.discount_value, data.start_date, data.end_date],
  });
  return getCampaignById(Number(result.lastInsertRowid));
}

export async function getCampaignById(id: number) {
  const client = getClient();
  const result = await client.execute({ sql: `SELECT * FROM campaigns WHERE id = ?`, args: [id] });
  if (!result.rows[0]) return null;

  const products = await client.execute({
    sql: `SELECT product_id FROM campaign_products WHERE campaign_id = ?`,
    args: [id],
  });
  return { ...result.rows[0], product_ids: products.rows.map(r => Number(r.product_id)) };
}

export async function updateCampaign(id: number, input: UpdateCampaignInput) {
  const data = UpdateCampaignSchema.parse(input);
  const fields: string[] = [];
  const args: InValue[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); args.push(data.name); }
  if (data.discount_type !== undefined) { fields.push('discount_type = ?'); args.push(data.discount_type); }
  if (data.discount_value !== undefined) { fields.push('discount_value = ?'); args.push(data.discount_value); }
  if (data.start_date !== undefined) { fields.push('start_date = ?'); args.push(data.start_date); }
  if (data.end_date !== undefined) { fields.push('end_date = ?'); args.push(data.end_date); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); args.push(data.is_active ? 1 : 0); }

  if (fields.length === 0) return getCampaignById(id);

  args.push(id);
  const client = getClient();
  await client.execute({
    sql: `UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
  return getCampaignById(id);
}

export async function addProductToCampaign(campaignId: number, productId: number) {
  const client = getClient();
  await client.execute({
    sql: `INSERT OR IGNORE INTO campaign_products (campaign_id, product_id) VALUES (?, ?)`,
    args: [campaignId, productId],
  });
}

export async function removeProductFromCampaign(campaignId: number, productId: number) {
  const client = getClient();
  await client.execute({
    sql: `DELETE FROM campaign_products WHERE campaign_id = ? AND product_id = ?`,
    args: [campaignId, productId],
  });
}

export async function getActiveCampaigns() {
  const client = getClient();
  const result = await client.execute(
    `SELECT * FROM campaigns WHERE is_active = 1 ORDER BY id`,
  );
  return result.rows;
}

export async function getDiscountForProduct(productId: number, date: string): Promise<{ discount_type: string; discount_value: number } | null> {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT c.discount_type, c.discount_value
          FROM campaigns c
          JOIN campaign_products cp ON c.id = cp.campaign_id
          WHERE cp.product_id = ?
            AND c.is_active = 1
            AND c.start_date <= ?
            AND c.end_date >= ?
          ORDER BY c.discount_value DESC
          LIMIT 1`,
    args: [productId, date, date],
  });

  if (!result.rows[0]) return null;
  return {
    discount_type: String(result.rows[0].discount_type),
    discount_value: Number(result.rows[0].discount_value),
  };
}
