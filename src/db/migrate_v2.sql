-- =============================================================
-- Migration v2 — Pricing optimizations
-- Run: psql -U postgres -d shieldpay -f src/db/migrate_v2.sql
-- =============================================================

-- Store seasonal multiplier on every quote for full auditability
ALTER TABLE pricing_quotes
  ADD COLUMN IF NOT EXISTS seasonal_multiplier NUMERIC(4,3) NOT NULL DEFAULT 1.00;

-- Add lat/lng columns to zones for future proximity lookups
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

-- City alias lookup table (normalized → canonical city name in zones)
CREATE TABLE IF NOT EXISTS city_aliases (
  alias       VARCHAR(100) PRIMARY KEY,
  canonical   VARCHAR(100) NOT NULL
);

INSERT INTO city_aliases (alias, canonical) VALUES
  ('bombay',      'Mumbai'),
  ('bengaluru',   'Bangalore'),
  ('calcutta',    'Kolkata'),
  ('madras',      'Chennai'),
  ('new delhi',   'Delhi'),
  ('ncr',         'Delhi'),
  ('gurugram',    'Delhi'),
  ('gurgaon',     'Delhi'),
  ('noida',       'Delhi'),
  ('navi mumbai', 'Mumbai'),
  ('thane',       'Mumbai')
ON CONFLICT (alias) DO NOTHING;

-- Prevent duplicate ACTIVE policies for same user + work_type
-- (allows multiple if one is cancelled/expired)
CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_one_active_per_worktype
  ON policies (user_id, plan_tier)
  WHERE status = 'active';
