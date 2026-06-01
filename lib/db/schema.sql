-- ============================================================================
-- unethicaltools — database schema
--
-- Exactly one table. It records entitlement (who has paid) keyed by a stable
-- identity. NOTHING about a user's quizzes is stored here — quiz content lives
-- in the browser. Apply with:  npm run db:setup
-- (idempotent: safe to run repeatedly and on a fresh production database).
-- ============================================================================

create table if not exists entitlements (
  -- Stable identity key. For Google sign-in this is the OAuth subject id
  -- (`token.sub`), which never changes for a given Google account.
  user_key                text         primary key,

  -- Convenience copy of the email at purchase time (for support / receipts).
  email                   text,

  -- The thing we actually gate on.
  pro                     boolean      not null default false,

  -- Stripe linkage, so a later subscription event can find this row.
  stripe_customer_id      text,
  stripe_subscription_id  text,

  -- Last subscription status we saw from Stripe (active, canceled, …).
  status                  text,

  updated_at              timestamptz  not null default now()
);

-- Look up a row by the Stripe customer when a subscription event arrives
-- without our identity key in the payload.
create index if not exists entitlements_stripe_customer_idx
  on entitlements (stripe_customer_id);

-- ============================================================================
-- usage_events — one row per billable LLM call, for cost instrumentation.
-- Records ONLY usage metadata (token counts, computed cost, which feature /
-- model / user) so margins can be measured rather than guessed, and the p95
-- heavy-user tail is visible. No quiz content is ever stored. Idempotent.
-- ============================================================================
create table if not exists usage_events (
  id              text         primary key,
  user_key        text         not null,
  feature         text         not null,   -- "answer-solve", "explain", …
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        double precision,
  created_at      timestamptz  not null default now()
);

-- Sum cost per user (fair-use ceilings, per-account billing insight).
create index if not exists usage_events_user_key_idx
  on usage_events (user_key);

-- Time-window rollups (daily/monthly spend).
create index if not exists usage_events_created_at_idx
  on usage_events (created_at);
