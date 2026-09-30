-- Monetary hard limits for paid requests (ADR-015, M0.3b). Nothing here approves any spending:
-- every table starts empty and an empty table refuses. Approval columns are written only by the
-- admin action that records the acting owner in audit_log; no seed fills them.

-- A price takes part in a release decision only when it is approved, not suspended, and bound to the
-- provider host it was checked against. Rows are exact: (service, model) for model services,
-- (service, endpoint) for the rest; there is no service-level fallback.
ALTER TABLE service_prices
  ADD COLUMN base_host text,
  ADD COLUMN per_unit numeric(14, 6) CHECK (per_unit >= 0),
  ADD COLUMN unit text,
  ADD COLUMN max_units_per_request integer CHECK (max_units_per_request > 0),
  ADD COLUMN overhead_tokens integer NOT NULL DEFAULT 0 CHECK (overhead_tokens >= 0),
  ADD COLUMN output_cap_includes_reasoning boolean,
  ADD COLUMN reasoning_off text CHECK (reasoning_off IN ('thinking.type=disabled', 'enable_thinking=false')),
  ADD COLUMN approved_by text,
  ADD COLUMN approved_on date,
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN suspended_reason text,
  ADD CONSTRAINT service_prices_approval_pair CHECK ((approved_by IS NULL) = (approved_on IS NULL));

-- Monthly limits per currency. scope 'global' (key ''), 'capability' (key = capability) and
-- 'subject' (key = subject kind such as article or story: the limit of each single subject of that kind).
CREATE TABLE money_budgets (
  scope          text NOT NULL CHECK (scope IN ('global', 'capability', 'subject')),
  key            text NOT NULL,
  currency       text NOT NULL CHECK (currency IN ('CNY', 'USD')),
  monthly_limit  numeric(14, 6) NOT NULL CHECK (monthly_limit >= 0),
  approved_by    text,
  approved_on    date,
  note           text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key, currency),
  CONSTRAINT money_budgets_global_key CHECK (scope <> 'global' OR key = ''),
  CONSTRAINT money_budgets_approval_pair CHECK ((approved_by IS NULL) = (approved_on IS NULL))
);

-- The ledger: what each limit row has taken in a budget month. For scope 'subject' the key is the
-- subject itself (article:123), while its limit is looked up by kind. Kept in step with
-- receipt_attempts inside the same transactions; reconcileMoneyLedger compares the two.
CREATE TABLE money_usage (
  scope     text NOT NULL CHECK (scope IN ('global', 'capability', 'subject')),
  key       text NOT NULL,
  currency  text NOT NULL CHECK (currency IN ('CNY', 'USD')),
  month     date NOT NULL CHECK (extract(day FROM month) = 1),
  -- Never negative: a release that would take a row below zero is a bug and must fail, not widen the limit.
  amount    numeric(16, 6) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (scope, key, currency, month)
);

-- What an attempt holds against the limits. settled_amount is in reserved_currency; while it is NULL
-- the reservation itself counts. holds_reservation decides, never status (a released receipt's
-- attempt is marked failed and may still hold its money).
ALTER TABLE receipt_attempts
  ADD COLUMN capability text,
  ADD COLUMN price_service text,
  ADD COLUMN price_key text,
  ADD COLUMN subject_keys text[] NOT NULL DEFAULT '{}',
  ADD COLUMN budget_month date,
  ADD COLUMN reserved_amount numeric(14, 6) CHECK (reserved_amount >= 0),
  ADD COLUMN reserved_currency text CHECK (reserved_currency IN ('CNY', 'USD')),
  ADD COLUMN settled_amount numeric(14, 6) CHECK (settled_amount >= 0),
  ADD COLUMN holds_reservation boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT receipt_attempts_reservation_complete CHECK (
    NOT holds_reservation OR (capability IS NOT NULL AND price_service IS NOT NULL AND price_key IS NOT NULL AND budget_month IS NOT NULL
      AND reserved_amount IS NOT NULL AND reserved_currency IS NOT NULL));

CREATE INDEX receipt_attempts_money_idx ON receipt_attempts (reserved_currency, budget_month) WHERE holds_reservation;
