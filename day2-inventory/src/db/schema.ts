export const SCHEMA = [
  // ── マスタ ──

  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL CHECK(price >= 0),
    cost REAL NOT NULL CHECK(cost >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 在庫 ──

  `CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id, warehouse_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id)`,

  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    type TEXT NOT NULL CHECK(type IN ('in', 'out')),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    reference_type TEXT,
    reference_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON stock_movements(warehouse_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movements_type ON stock_movements(type)`,
  `CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at)`,

  // ── 受注 ──

  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    customer_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    total_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    subtotal REAL NOT NULL CHECK(subtotal >= 0)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,

  // ── 発送 ──

  `CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
    tracking_number TEXT,
    carrier TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'shipped', 'in_transit', 'delivered')),
    shipped_at TEXT,
    delivered_at TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number)`,

  // ── キャンペーン ──

  `CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
    discount_value REAL NOT NULL CHECK(discount_value > 0),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    CHECK(end_date > start_date)
  )`,

  // ── 会計 ──

  `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_ref ON transactions(reference_type, reference_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at)`,
];
