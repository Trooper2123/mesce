CREATE TABLE IF NOT EXISTS mesce_coordinator_profiles (
 auth0_sub text PRIMARY KEY,
 payload text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
