import { getClient } from '../db/client.js';

export async function getSalesReport(startDate: string, endDate: string) {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT
            COUNT(*) as total_orders,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(discount_amount), 0) as total_discounts,
            COALESCE(AVG(total_amount), 0) as avg_order_value
          FROM orders
          WHERE status IN ('confirmed', 'shipped', 'delivered')
            AND created_at >= ? AND created_at <= ?`,
    args: [startDate, endDate],
  });

  const topProducts = await client.execute({
    sql: `SELECT p.id, p.name, p.sku,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.line_total) as total_revenue
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status IN ('confirmed', 'shipped', 'delivered')
            AND o.created_at >= ? AND o.created_at <= ?
          GROUP BY p.id
          ORDER BY total_revenue DESC
          LIMIT 10`,
    args: [startDate, endDate],
  });

  return {
    summary: result.rows[0],
    top_products: topProducts.rows,
  };
}

export async function getInventoryValuation() {
  const client = getClient();
  const result = await client.execute(
    `SELECT p.id, p.name, p.sku, p.cost_price,
            COALESCE(SUM(CASE WHEN sm.direction='IN' THEN sm.quantity ELSE -sm.quantity END), 0) as current_stock,
            COALESCE(SUM(CASE WHEN sm.direction='IN' THEN sm.quantity ELSE -sm.quantity END), 0) * p.cost_price as valuation
     FROM products p
     LEFT JOIN stock_movements sm ON p.id = sm.product_id
     GROUP BY p.id
     ORDER BY valuation DESC`,
  );

  const totalValuation = result.rows.reduce((sum, row) => sum + Number(row.valuation), 0);
  return { items: result.rows, total_valuation: totalValuation };
}

export async function getMovementSummary(startDate: string, endDate: string) {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT direction, reason,
            COUNT(*) as count,
            SUM(quantity) as total_quantity,
            SUM(quantity * unit_cost) as total_value
          FROM stock_movements
          WHERE created_at >= ? AND created_at <= ?
          GROUP BY direction, reason
          ORDER BY direction, reason`,
    args: [startDate, endDate],
  });
  return result.rows;
}
