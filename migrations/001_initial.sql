CREATE TABLE IF NOT EXISTS mesce_records (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('minister','assisted','event','absence','schedule')),
 payload text NOT NULL,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mesce_records_kind ON mesce_records(kind);
CREATE TABLE IF NOT EXISTS mesce_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor text NOT NULL,
 action text NOT NULL,
 record_id uuid,
 details text,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- O payload completo é cifrado na aplicação com AES-256-GCM.
-- A role da aplicação deve ter acesso apenas a estas tabelas, sem DDL em produção.
