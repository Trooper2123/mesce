-- Personal calendar subscriptions. The bearer credential is never stored in
-- plaintext; only its SHA-256 digest is persisted.
CREATE TABLE IF NOT EXISTS mesce_calendar_feeds (
 minister_id uuid PRIMARY KEY,
 auth0_sub text NOT NULL,
 owner_email_hmac char(64) NOT NULL CHECK (owner_email_hmac ~ '^[a-f0-9]{64}$'),
 token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mesce_calendar_feeds_owner
 ON mesce_calendar_feeds(auth0_sub, minister_id) WHERE revoked_at IS NULL;
