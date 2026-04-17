-- =============================================================
-- ShieldPay AI Pricing Engine — PostgreSQL Schema
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  phone         VARCHAR(15),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ──────────────────────────────────────────────────────────────
-- USER SETTINGS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  city                  VARCHAR(100),
  zone                  VARCHAR(100),
  connected_platform    VARCHAR(60),
  active_plan           VARCHAR(120),
  auto_renewal          VARCHAR(20)  NOT NULL DEFAULT 'Enabled'
                          CHECK (auto_renewal IN ('Enabled', 'Disabled')),
  primary_upi_id        VARCHAR(120),
  backup_bank_account   VARCHAR(120),
  payout_frequency      VARCHAR(40)  NOT NULL DEFAULT 'Not set',
  weather_warnings      VARCHAR(60)  NOT NULL DEFAULT 'SMS Only',
  claim_updates         VARCHAR(60)  NOT NULL DEFAULT 'SMS Only',
  weekly_summary        VARCHAR(60)  NOT NULL DEFAULT 'Email Only',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ──────────────────────────────────────────────────────────────
-- WORKER PROFILES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_type           VARCHAR(60)   NOT NULL
                        CHECK (work_type IN (
                          'construction', 'domestic', 'delivery',
                          'factory', 'agriculture', 'retail', 'other'
                        )),
  years_experience    SMALLINT      NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  avg_weekly_income   NUMERIC(10,2) NOT NULL CHECK (avg_weekly_income > 0),
  daily_hours         SMALLINT      NOT NULL CHECK (daily_hours BETWEEN 1 AND 16),
  weekly_active_hours SMALLINT      NOT NULL DEFAULT 42 CHECK (weekly_active_hours BETWEEN 1 AND 112),
  preferred_work_start TIME,
  preferred_work_end   TIME,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS weekly_active_hours SMALLINT NOT NULL DEFAULT 42,
  ADD COLUMN IF NOT EXISTS preferred_work_start TIME,
  ADD COLUMN IF NOT EXISTS preferred_work_end TIME;

CREATE INDEX IF NOT EXISTS idx_worker_profiles_user_id ON worker_profiles(user_id);

-- ──────────────────────────────────────────────────────────────
-- ZONES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name     VARCHAR(100)  NOT NULL UNIQUE,
  zone_code     VARCHAR(20)   NOT NULL UNIQUE,
  city          VARCHAR(100)  NOT NULL,
  state         VARCHAR(100)  NOT NULL,
  risk_level    VARCHAR(10)   NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  risk_factor   NUMERIC(4,3)  NOT NULL CHECK (risk_factor BETWEEN 0.8 AND 2.0),
  base_premium  NUMERIC(10,2) NOT NULL CHECK (base_premium > 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_city ON zones(city);
CREATE INDEX IF NOT EXISTS idx_zones_risk_level ON zones(risk_level);

-- ──────────────────────────────────────────────────────────────
-- PINCODE → ZONE MAP
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pincode_zone_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode     VARCHAR(10)   NOT NULL UNIQUE,
  zone_id     UUID          NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  city        VARCHAR(100),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pincode_zone_map_pincode  ON pincode_zone_map(pincode);
CREATE INDEX IF NOT EXISTS idx_pincode_zone_map_zone_id  ON pincode_zone_map(zone_id);

-- ──────────────────────────────────────────────────────────────
-- PRICING QUOTES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_quotes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          REFERENCES users(id) ON DELETE SET NULL,
  zone_id             UUID          NOT NULL REFERENCES zones(id),
  city                VARCHAR(100)  NOT NULL,
  pincode             VARCHAR(10),
  work_type           VARCHAR(60)   NOT NULL,
  daily_hours         SMALLINT      NOT NULL,
  avg_weekly_income   NUMERIC(10,2) NOT NULL,
  plan_tier           VARCHAR(20)   NOT NULL
                        CHECK (plan_tier IN ('basic', 'standard', 'premium')),

  -- Breakdown (stored for audit / policy reference)
  base_premium        NUMERIC(10,2) NOT NULL,
  loc_risk_surcharge  NUMERIC(10,2) NOT NULL,
  worker_exp_factor   NUMERIC(10,2) NOT NULL,
  plan_surcharge      NUMERIC(10,2) NOT NULL,
  discount_applied    NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_premium       NUMERIC(10,2) NOT NULL,
  coverage_amount     NUMERIC(12,2) NOT NULL,

  risk_band           VARCHAR(20)   NOT NULL,
  expires_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_quotes_user_id   ON pricing_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_expires_at ON pricing_quotes(expires_at);

-- ──────────────────────────────────────────────────────────────
-- POLICIES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id        UUID          NOT NULL REFERENCES pricing_quotes(id),
  policy_number   VARCHAR(30)   NOT NULL UNIQUE DEFAULT 'SP-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  plan_tier       VARCHAR(20)   NOT NULL CHECK (plan_tier IN ('basic', 'standard', 'premium')),
  status          VARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'cancelled')),
  final_premium   NUMERIC(10,2) NOT NULL,
  coverage_amount NUMERIC(12,2) NOT NULL,
  coverage_triggers TEXT[]       NOT NULL DEFAULT ARRAY['HEAVY_RAIN', 'FLOOD']::TEXT[],
  valid_from      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  valid_until     TIMESTAMPTZ   NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS coverage_triggers TEXT[] NOT NULL DEFAULT ARRAY['HEAVY_RAIN', 'FLOOD']::TEXT[];

CREATE INDEX IF NOT EXISTS idx_policies_user_id     ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_status      ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_valid_until ON policies(valid_until);
CREATE INDEX IF NOT EXISTS idx_policies_quote_id    ON policies(quote_id);

-- ──────────────────────────────────────────────────────────────
-- WEATHER SNAPSHOTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id              UUID          NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  rainfall_mm_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
  heat_index           NUMERIC(10,2) NOT NULL DEFAULT 0,
  weather_status       VARCHAR(50)   NOT NULL,
  source               VARCHAR(120)  NOT NULL,
  recorded_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  raw_payload          JSONB         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_zone_recorded_at ON weather_snapshots(zone_id, recorded_at DESC);

-- ──────────────────────────────────────────────────────────────
-- AQI SNAPSHOTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aqi_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id      UUID          NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  aqi          INTEGER       NOT NULL CHECK (aqi >= 0),
  source       VARCHAR(120)  NOT NULL,
  recorded_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  raw_payload  JSONB         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_aqi_snapshots_zone_recorded_at ON aqi_snapshots(zone_id, recorded_at DESC);

-- ──────────────────────────────────────────────────────────────
-- TRIGGER EVENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trigger_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id       UUID          NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  trigger_type  VARCHAR(40)   NOT NULL CHECK (trigger_type IN (
                  'HEAVY_RAIN', 'FLOOD', 'SEVERE_AQI', 'HEATWAVE', 'ZONE_SHUTDOWN'
                )),
  severity      NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_time    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  end_time      TIMESTAMPTZ,
  status        VARCHAR(20)   NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'resolved')),
  source        VARCHAR(120)  NOT NULL,
  raw_payload   JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trigger_events_active_unique
  ON trigger_events(zone_id, trigger_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_trigger_events_zone_status ON trigger_events(zone_id, status, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- CLAIMS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id             UUID          NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  trigger_event_id      UUID          NOT NULL REFERENCES trigger_events(id) ON DELETE CASCADE,
  claim_status          VARCHAR(30)   NOT NULL DEFAULT 'pending'
                          CHECK (claim_status IN ('pending', 'approved', 'under_review', 'soft_verification', 'rejected', 'paid')),
  estimated_income_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  trust_score           NUMERIC(5,2),
  fraud_score           NUMERIC(5,2),
  review_reason         TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_policy_trigger_unique ON claims(policy_id, trigger_event_id);
CREATE INDEX IF NOT EXISTS idx_claims_user_status ON claims(user_id, claim_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_trigger_status ON claims(trigger_event_id, claim_status);

-- ──────────────────────────────────────────────────────────────
-- SEED: Zone + Pincode data (sample — extend as needed)
-- ──────────────────────────────────────────────────────────────
INSERT INTO zones (zone_name, zone_code, city, state, risk_level, risk_factor, base_premium)
VALUES
  ('Mumbai Central',   'MUM-C',   'Mumbai',    'Maharashtra', 'high',      1.50, 120.00),
  ('Mumbai Suburbs',   'MUM-S',   'Mumbai',    'Maharashtra', 'medium',    1.20, 100.00),
  ('Delhi NCR Core',   'DEL-C',   'Delhi',     'Delhi',       'very_high', 1.80, 150.00),
  ('Delhi Outer Ring', 'DEL-O',   'Delhi',     'Delhi',       'high',      1.45, 130.00),
  ('Bangalore Urban',  'BLR-U',   'Bangalore', 'Karnataka',   'medium',    1.15,  95.00),
  ('Bangalore Rural',  'BLR-R',   'Bangalore', 'Karnataka',   'low',       0.90,  80.00),
  ('Pune Central',     'PUN-C',   'Pune',      'Maharashtra', 'medium',    1.10,  90.00),
  ('Chennai Central',  'CHN-C',   'Chennai',   'Tamil Nadu',  'medium',    1.20, 100.00),
  ('Default Zone',     'DEFAULT', 'Unknown',   'Unknown',     'medium',    1.00,  95.00)
ON CONFLICT (zone_code) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '400001', id, 'Mumbai' FROM zones WHERE zone_code = 'MUM-C'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '400068', id, 'Mumbai' FROM zones WHERE zone_code = 'MUM-S'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '110001', id, 'Delhi' FROM zones WHERE zone_code = 'DEL-C'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '110044', id, 'Delhi' FROM zones WHERE zone_code = 'DEL-O'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '560001', id, 'Bangalore' FROM zones WHERE zone_code = 'BLR-U'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '560083', id, 'Bangalore' FROM zones WHERE zone_code = 'BLR-R'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '411001', id, 'Pune' FROM zones WHERE zone_code = 'PUN-C'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '600001', id, 'Chennai' FROM zones WHERE zone_code = 'CHN-C'
ON CONFLICT (pincode) DO NOTHING;

INSERT INTO zones (zone_name, zone_code, city, state, risk_level, risk_factor, base_premium)
VALUES
  ('Chennai Velachery', 'CHN-VEL', 'Chennai', 'Tamil Nadu', 'high', 1.35, 112.00)
ON CONFLICT (zone_code) DO NOTHING;

INSERT INTO pincode_zone_map (pincode, zone_id, city)
SELECT '600042', id, 'Chennai' FROM zones WHERE zone_code = 'CHN-VEL'
ON CONFLICT (pincode) DO NOTHING;
