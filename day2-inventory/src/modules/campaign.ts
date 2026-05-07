import { getClient } from '../db/client.js';
import { logger } from '../utils/logger.js';

export type DiscountType = 'percentage' | 'fixed';

export interface Campaign {
  id: number;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface CreateCampaignInput {
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  start_date: string;
  end_date: string;
  active?: boolean;
}

export interface ApplyCampaignResult {
  orderId: number;
  campaignId: number;
  originalTotal: number;
  discountAmount: number;
  newTotal: number;
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  if (input.discount_value <= 0) {
    throw new Error('discount_value must be > 0');
  }
  if (input.discount_type === 'percentage' && input.discount_value > 100) {
    throw new Error('percentage discount_value must be <= 100');
  }
  if (input.end_date <= input.start_date) {
    throw new Error('end_date must be after start_date');
  }

  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO campaigns (name, discount_type, discount_value, start_date, end_date, active)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      input.name,
      input.discount_type,
      input.discount_value,
      input.start_date,
      input.end_date,
      input.active === false ? 0 : 1,
    ],
  });

  const id = Number(result.lastInsertRowid);
  logger.info(`Campaign created: id=${id}, name=${input.name}`);

  const campaign = await findById(id);
  if (!campaign) throw new Error(`Failed to retrieve created campaign id=${id}`);
  return campaign;
}

export async function applyCampaign(
  orderId: number,
  campaignId: number,
  asOfDate?: string,
): Promise<ApplyCampaignResult> {
  const today = asOfDate ?? new Date().toISOString().slice(0, 10);
  const client = getClient();

  await client.execute('BEGIN');
  try {
    const campaign = await findById(campaignId);
    if (!campaign) throw new Error(`Campaign id=${campaignId} not found`);
    if (!campaign.active) throw new Error(`Campaign id=${campaignId} is not active`);
    if (today < campaign.start_date || today > campaign.end_date) {
      throw new Error(
        `Campaign id=${campaignId} is not valid on ${today} (period: ${campaign.start_date} to ${campaign.end_date})`,
      );
    }

    const orderRow = await client.execute({
      sql: 'SELECT id, status, total_amount FROM orders WHERE id = ?',
      args: [orderId],
    });
    if (!orderRow.rows[0]) throw new Error(`Order id=${orderId} not found`);

    const status = String(orderRow.rows[0].status);
    if (status !== 'pending') {
      throw new Error(`Cannot apply campaign to order id=${orderId}: status=${status}`);
    }

    const originalTotal = Number(orderRow.rows[0].total_amount);
    const discountAmount = calculateDiscount(originalTotal, campaign);
    const newTotal = Math.max(0, originalTotal - discountAmount);

    await client.execute({
      sql: `UPDATE orders SET total_amount = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [newTotal, orderId],
    });

    await client.execute('COMMIT');
    logger.info(
      `Campaign applied: order=${orderId}, campaign=${campaignId}, discount=${discountAmount}, newTotal=${newTotal}`,
    );

    return {
      orderId,
      campaignId,
      originalTotal,
      discountAmount,
      newTotal,
    };
  } catch (err) {
    await client.execute('ROLLBACK');
    throw err;
  }
}

export async function listActiveCampaigns(asOfDate?: string): Promise<Campaign[]> {
  const today = asOfDate ?? new Date().toISOString().slice(0, 10);
  const client = getClient();

  const result = await client.execute({
    sql: `SELECT * FROM campaigns
          WHERE active = 1 AND start_date <= ? AND end_date >= ?
          ORDER BY id`,
    args: [today, today],
  });

  logger.info(`Listed ${result.rows.length} active campaigns (as of ${today})`);
  return result.rows.map(toCampaign);
}

function calculateDiscount(total: number, campaign: Campaign): number {
  if (campaign.discount_type === 'percentage') {
    return total * (campaign.discount_value / 100);
  }
  return Math.min(campaign.discount_value, total);
}

async function findById(id: number): Promise<Campaign | null> {
  const client = getClient();
  const result = await client.execute({
    sql: 'SELECT * FROM campaigns WHERE id = ?',
    args: [id],
  });
  if (!result.rows[0]) return null;
  return toCampaign(result.rows[0]);
}

function toCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: Number(row.id),
    name: String(row.name),
    discount_type: String(row.discount_type) as DiscountType,
    discount_value: Number(row.discount_value),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    active: Number(row.active) === 1,
  };
}
