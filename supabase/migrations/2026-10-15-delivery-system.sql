-- CashSkillBD Manual Delivery System — migration
-- Run in Supabase SQL Editor (project sfkwnvekataedjqrsykn).
-- SAFE / ADDITIVE: creates one new table + adds three nullable columns to
-- cashskillbd_orders. No existing data is deleted or altered, except the
-- backfill of the NEW delivery_status column below.
-- The delivery API + UI degrade gracefully until this migration is applied
-- (delivery actions return a clear "migration not run" error).

-- 1) Fulfillment state on the order (separate from payment `status`).
ALTER TABLE cashskillbd_orders
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;

-- Backfill the NEW column from the existing payment status (existing rows only).
UPDATE cashskillbd_orders SET delivery_status = 'awaiting'
  WHERE delivery_status = 'pending_payment' AND status = 'confirmed';
UPDATE cashskillbd_orders SET delivery_status = 'cancelled'
  WHERE delivery_status = 'pending_payment' AND status = 'rejected';

-- 2) Delivery records — one row per delivery attempt; history is preserved.
--    status: draft | delivered | failed | superseded
--    A correction marks the old row 'superseded' and inserts a new row, so
--    previous delivery history is never silently overwritten.
CREATE TABLE IF NOT EXISTS cashskillbd_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES cashskillbd_orders (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('vps', 'ip', 'number', 'dollar', 'course', 'other')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'delivered', 'failed', 'superseded')),
  -- Service-specific fields (see api/admin.js DELIVERY_FIELDS). Secret values
  -- (passwords, phone numbers, payout details) live ONLY in this JSONB column.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  correction_of bigint REFERENCES cashskillbd_deliveries (id) ON DELETE SET NULL,
  correction_reason text,
  delivered_by uuid,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON cashskillbd_deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON cashskillbd_deliveries (status);
-- Concurrency guard: at most ONE delivered delivery per order at the DB level.
-- (delivery.correct supersedes the old row before inserting the replacement.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_one_delivered
  ON cashskillbd_deliveries (order_id) WHERE status = 'delivered';

-- 3) Lockdown: NO direct client access. All reads/writes go through the
--    API endpoints (admin api/admin.js with the service role, customer
--    api/delivery.js with server-side ownership checks). The service role
--    bypasses RLS; the anon/authenticated keys can read/write nothing here.
ALTER TABLE cashskillbd_deliveries ENABLE ROW LEVEL SECURITY;
-- (No policies: only the service role may access this table.)
