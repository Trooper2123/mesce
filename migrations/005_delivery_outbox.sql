-- Explicit channel preferences and push subscriptions. Push credentials and
-- recipient/content snapshots are encrypted by the server application.
CREATE TABLE IF NOT EXISTS mesce_delivery_preferences (
 minister_id uuid PRIMARY KEY,
 auth0_sub text NOT NULL,
 email_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mesce_push_subscriptions (
 id uuid PRIMARY KEY,
 minister_id uuid NOT NULL,
 auth0_sub text NOT NULL,
 endpoint_hash char(64) NOT NULL UNIQUE CHECK (endpoint_hash ~ '^[a-f0-9]{64}$'),
 payload text NOT NULL,
 revoked_at timestamptz,
 last_accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mesce_push_subscriptions_owner
 ON mesce_push_subscriptions(minister_id, auth0_sub) WHERE revoked_at IS NULL;

-- Snapshot contains only the email invite target and minimized event fields;
-- the complete payload is AES-GCM encrypted in the application.
CREATE TABLE IF NOT EXISTS mesce_calendar_delivery_state (
 minister_id uuid NOT NULL,
 event_id uuid NOT NULL,
 month char(7) NOT NULL,
 sequence integer NOT NULL CHECK (sequence > 0),
 fingerprint char(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('ACTIVE','CANCELLED')),
 mail_status text NOT NULL CHECK (mail_status IN ('PENDING','ACCEPTED_SMTP','FAILED','CANCEL_PENDING','CANCEL_ACCEPTED_SMTP','CANCEL_FAILED','NONE')),
 payload text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(minister_id,event_id)
);
CREATE INDEX IF NOT EXISTS mesce_calendar_delivery_state_month
 ON mesce_calendar_delivery_state(month, state);

CREATE TABLE IF NOT EXISTS mesce_push_month_state (
 minister_id uuid NOT NULL,
 month char(7) NOT NULL,
 fingerprint char(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(minister_id,month)
);

CREATE TABLE IF NOT EXISTS mesce_outbox (
 id uuid PRIMARY KEY,
 dedupe_key char(64) NOT NULL UNIQUE CHECK (dedupe_key ~ '^[a-f0-9]{64}$'),
 delivery_key char(64) NOT NULL CHECK (delivery_key ~ '^[a-f0-9]{64}$'),
 channel text NOT NULL CHECK (channel IN ('EMAIL','PUSH')),
 method text CHECK (method IN ('REQUEST','CANCEL')),
 minister_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 sequence integer NOT NULL DEFAULT 0,
 payload text NOT NULL,
 status text NOT NULL CHECK (status IN ('PENDING','PROCESSING','RETRY','ACCEPTED_SMTP','ACCEPTED_PUSH','FAILED','OBSOLETE')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_owner text,
 lease_until timestamptz,
 result_code text,
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mesce_outbox_ready
 ON mesce_outbox(status, available_at, created_at)
 WHERE status IN ('PENDING','RETRY','PROCESSING');
CREATE INDEX IF NOT EXISTS mesce_outbox_delivery_order
 ON mesce_outbox(delivery_key, sequence, created_at)
 WHERE status IN ('PENDING','RETRY','PROCESSING');
