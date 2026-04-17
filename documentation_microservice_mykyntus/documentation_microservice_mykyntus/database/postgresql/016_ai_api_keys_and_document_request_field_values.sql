-- =============================================================================
-- Clés API IA par tenant + valeurs de champs par demande document (pilote/RH).
-- Idempotent. Schéma : documentation
-- =============================================================================
SET search_path TO documentation, public;

CREATE TABLE IF NOT EXISTS documentation.ai_api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(64) NOT NULL,
  provider    VARCHAR(32) NOT NULL DEFAULT 'openai',
  label       VARCHAR(128),
  api_key     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_api_keys_tenant
  ON documentation.ai_api_keys (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_api_keys_one_active_per_tenant
  ON documentation.ai_api_keys (tenant_id)
  WHERE is_active = TRUE;

COMMENT ON TABLE documentation.ai_api_keys IS
  'Clés API pour appels OpenAI-compatibles. Une seule entrée active par tenant. Ne pas exposer api_key en clair côté API liste.';

CREATE TABLE IF NOT EXISTS documentation.document_request_field_values (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            VARCHAR(64) NOT NULL,
  document_request_id  UUID NOT NULL REFERENCES documentation.document_requests (id) ON DELETE CASCADE,
  field_name           VARCHAR(128) NOT NULL,
  field_value          TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_request_field_values_request_name
    UNIQUE (document_request_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_document_request_field_values_tenant_request
  ON documentation.document_request_field_values (tenant_id, document_request_id);

ALTER TABLE documentation.document_template_variables
  ADD COLUMN IF NOT EXISTS display_label VARCHAR(255);

SET search_path TO public;
