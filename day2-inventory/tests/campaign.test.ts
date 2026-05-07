import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from './helpers.js';
import {
  createCampaign,
  applyCampaign,
  listActiveCampaigns,
} from '../src/modules/campaign.js';
import { getClient } from '../src/db/client.js';

async function seedOrder(total: number, status = 'pending'): Promise<number> {
  const client = getClient();
  const result = await client.execute({
    sql: `INSERT INTO orders (customer_name, status, total_amount) VALUES (?, ?, ?)`,
    args: ['Test Customer', status, total],
  });
  return Number(result.lastInsertRowid);
}

async function getOrderTotal(id: number): Promise<number> {
  const client = getClient();
  const result = await client.execute({
    sql: 'SELECT total_amount FROM orders WHERE id = ?',
    args: [id],
  });
  return Number(result.rows[0].total_amount);
}

describe('Campaign Module', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  // ── createCampaign ──

  describe('createCampaign', () => {
    it('should create a percentage campaign', async () => {
      const campaign = await createCampaign({
        name: 'Summer Sale',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-06-01',
        end_date: '2026-08-31',
      });

      expect(campaign.id).toBeGreaterThan(0);
      expect(campaign.name).toBe('Summer Sale');
      expect(campaign.discount_type).toBe('percentage');
      expect(campaign.discount_value).toBe(10);
      expect(campaign.active).toBe(true);
    });

    it('should create a fixed-amount campaign', async () => {
      const campaign = await createCampaign({
        name: 'Flat 500 Off',
        discount_type: 'fixed',
        discount_value: 500,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });

      expect(campaign.discount_type).toBe('fixed');
      expect(campaign.discount_value).toBe(500);
    });

    it('should default active=true when not specified', async () => {
      const campaign = await createCampaign({
        name: 'Default Active',
        discount_type: 'percentage',
        discount_value: 5,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      expect(campaign.active).toBe(true);
    });

    it('should respect active=false', async () => {
      const campaign = await createCampaign({
        name: 'Paused',
        discount_type: 'percentage',
        discount_value: 5,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        active: false,
      });
      expect(campaign.active).toBe(false);
    });

    it('should reject discount_value <= 0', async () => {
      await expect(
        createCampaign({
          name: 'Zero',
          discount_type: 'percentage',
          discount_value: 0,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
        }),
      ).rejects.toThrow(/discount_value/);
    });

    it('should reject percentage > 100', async () => {
      await expect(
        createCampaign({
          name: 'Too Much',
          discount_type: 'percentage',
          discount_value: 150,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
        }),
      ).rejects.toThrow(/percentage/);
    });

    it('should allow fixed discount > 100', async () => {
      const campaign = await createCampaign({
        name: 'Big Fixed',
        discount_type: 'fixed',
        discount_value: 5000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      expect(campaign.discount_value).toBe(5000);
    });

    it('should reject end_date equal to start_date', async () => {
      await expect(
        createCampaign({
          name: 'Same Day',
          discount_type: 'fixed',
          discount_value: 100,
          start_date: '2026-06-15',
          end_date: '2026-06-15',
        }),
      ).rejects.toThrow(/end_date/);
    });

    it('should reject end_date before start_date', async () => {
      await expect(
        createCampaign({
          name: 'Backwards',
          discount_type: 'fixed',
          discount_value: 100,
          start_date: '2026-12-31',
          end_date: '2026-01-01',
        }),
      ).rejects.toThrow(/end_date/);
    });
  });

  // ── applyCampaign ──

  describe('applyCampaign', () => {
    it('should apply percentage discount to order total', async () => {
      const orderId = await seedOrder(10000);
      const c = await createCampaign({
        name: 'P10',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });

      const result = await applyCampaign(orderId, c.id, '2026-06-15');

      expect(result.originalTotal).toBe(10000);
      expect(result.discountAmount).toBe(1000);
      expect(result.newTotal).toBe(9000);
      expect(await getOrderTotal(orderId)).toBe(9000);
    });

    it('should apply fixed discount to order total', async () => {
      const orderId = await seedOrder(10000);
      const c = await createCampaign({
        name: 'F500',
        discount_type: 'fixed',
        discount_value: 500,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });

      const result = await applyCampaign(orderId, c.id, '2026-06-15');

      expect(result.discountAmount).toBe(500);
      expect(result.newTotal).toBe(9500);
    });

    it('should cap fixed discount at order total (no negative totals)', async () => {
      const orderId = await seedOrder(300);
      const c = await createCampaign({
        name: 'F1000',
        discount_type: 'fixed',
        discount_value: 1000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });

      const result = await applyCampaign(orderId, c.id, '2026-06-15');

      expect(result.discountAmount).toBe(300);
      expect(result.newTotal).toBe(0);
    });

    it('should reject when campaign does not exist', async () => {
      const orderId = await seedOrder(1000);
      await expect(applyCampaign(orderId, 999, '2026-06-15')).rejects.toThrow(/Campaign/);
    });

    it('should reject when order does not exist', async () => {
      const c = await createCampaign({
        name: 'X',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      await expect(applyCampaign(999, c.id, '2026-06-15')).rejects.toThrow(/Order/);
    });

    it('should reject when campaign is inactive', async () => {
      const orderId = await seedOrder(1000);
      const c = await createCampaign({
        name: 'Off',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        active: false,
      });
      await expect(applyCampaign(orderId, c.id, '2026-06-15')).rejects.toThrow(/not active/);
    });

    it('should reject when date is before start_date', async () => {
      const orderId = await seedOrder(1000);
      const c = await createCampaign({
        name: 'Future',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-07-01',
        end_date: '2026-12-31',
      });
      await expect(applyCampaign(orderId, c.id, '2026-06-15')).rejects.toThrow(/not valid/);
    });

    it('should reject when date is after end_date', async () => {
      const orderId = await seedOrder(1000);
      const c = await createCampaign({
        name: 'Past',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      });
      await expect(applyCampaign(orderId, c.id, '2026-06-15')).rejects.toThrow(/not valid/);
    });

    it('should accept date exactly on start_date boundary', async () => {
      const orderId = await seedOrder(1000);
      const c = await createCampaign({
        name: 'Start Edge',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: '2026-06-15',
        end_date: '2026-12-31',
      });
      const result = await applyCampaign(orderId, c.id, '2026-06-15');
      expect(result.discountAmount).toBe(100);
    });

    it('should accept date exactly on end_date boundary', async () => {
      const orderId = await seedOrder(1000);
      const c = await createCampaign({
        name: 'End Edge',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: '2026-01-01',
        end_date: '2026-06-15',
      });
      const result = await applyCampaign(orderId, c.id, '2026-06-15');
      expect(result.discountAmount).toBe(100);
    });

    it('should reject applying to non-pending order', async () => {
      const orderId = await seedOrder(1000, 'confirmed');
      const c = await createCampaign({
        name: 'X',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      await expect(applyCampaign(orderId, c.id, '2026-06-15')).rejects.toThrow(/status=confirmed/);
    });

    it('should not mutate order total when validation fails (rollback)', async () => {
      const orderId = await seedOrder(1000);
      const c = await createCampaign({
        name: 'Inactive',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        active: false,
      });
      await expect(applyCampaign(orderId, c.id, '2026-06-15')).rejects.toThrow();
      expect(await getOrderTotal(orderId)).toBe(1000);
    });
  });

  // ── listActiveCampaigns ──

  describe('listActiveCampaigns', () => {
    it('should return empty when no campaigns exist', async () => {
      const list = await listActiveCampaigns('2026-06-15');
      expect(list).toHaveLength(0);
    });

    it('should return only campaigns active on the given date', async () => {
      await createCampaign({
        name: 'Past',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      });
      await createCampaign({
        name: 'Current',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      await createCampaign({
        name: 'Future',
        discount_type: 'fixed',
        discount_value: 200,
        start_date: '2027-01-01',
        end_date: '2027-12-31',
      });

      const list = await listActiveCampaigns('2026-06-15');
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Current');
    });

    it('should exclude inactive campaigns', async () => {
      await createCampaign({
        name: 'Active',
        discount_type: 'percentage',
        discount_value: 10,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      await createCampaign({
        name: 'Paused',
        discount_type: 'percentage',
        discount_value: 20,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        active: false,
      });

      const list = await listActiveCampaigns('2026-06-15');
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Active');
    });

    it('should include campaign on its start_date', async () => {
      await createCampaign({
        name: 'Starts Today',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: '2026-06-15',
        end_date: '2026-12-31',
      });
      const list = await listActiveCampaigns('2026-06-15');
      expect(list).toHaveLength(1);
    });

    it('should include campaign on its end_date', async () => {
      await createCampaign({
        name: 'Ends Today',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: '2026-01-01',
        end_date: '2026-06-15',
      });
      const list = await listActiveCampaigns('2026-06-15');
      expect(list).toHaveLength(1);
    });

    it('should default to current date when asOfDate is omitted', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10);
      await createCampaign({
        name: 'Today Only',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: today,
        end_date: tomorrow,
      });

      const list = await listActiveCampaigns();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((c) => c.name === 'Today Only')).toBe(true);
    });
  });
});
