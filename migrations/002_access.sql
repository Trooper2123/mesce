CREATE TABLE IF NOT EXISTS mesce_access (
 id uuid PRIMARY KEY,
 email_hmac char(64) UNIQUE,
 email_ciphertext text,
 auth0_sub text UNIQUE,
 minister_id uuid UNIQUE NOT NULL,
 status text NOT NULL CHECK(status IN ('PENDING','ACTIVE','REVOKED')),
 role text NOT NULL DEFAULT 'MINISTER' CHECK(role IN ('MINISTER','COORDINATOR')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mesce_attempts (
 fingerprint text PRIMARY KEY,
 window_start timestamptz NOT NULL DEFAULT now(),
 count integer NOT NULL DEFAULT 1
);
-- Additive: preserve all legacy tables and IDs. No provider secrets in SQL.

CREATE TABLE IF NOT EXISTS mesce_responses (
 id uuid PRIMARY KEY,
 minister_id uuid NOT NULL,
 month char(7) NOT NULL,
 payload text NOT NULL,
 UNIQUE(minister_id,month)
);

CREATE TABLE IF NOT EXISTS mesce_settings (id integer PRIMARY KEY CHECK(id=1),payload text NOT NULL);
