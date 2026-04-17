-- =============================================================================
-- Fix PostgreSQL 42P01 : relation "documentation.document_template_versions" does not exist
-- Extrait de 010_template_management_v1.sql — à exécuter si la migration 010 complète n’a pas été jouée.
-- Idempotent (CREATE TABLE IF NOT EXISTS, contraintes conditionnelles).
-- Prérequis : documentation.document_templates existe (001).
-- =============================================================================
SET search_path TO documentation, public;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS current_version_id UUID;

CREATE TABLE IF NOT EXISTS documentation.document_template_versions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        UUID NOT NULL REFERENCES documentation.document_templates (id) ON DELETE CASCADE,
  tenant_id          VARCHAR(64) NOT NULL,
  version_number     INTEGER NOT NULL CHECK (version_number >= 1),
  status             VARCHAR(16) NOT NULL,
  structured_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_asset_uri TEXT,
  created_by_user_id UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_template_versions_template_version
  ON documentation.document_template_versions (template_id, version_number);

CREATE INDEX IF NOT EXISTS idx_template_versions_tenant_template_status
  ON documentation.document_template_versions (tenant_id, template_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'documentation'
      AND table_name = 'document_templates'
      AND constraint_name = 'fk_document_templates_current_version'
  ) THEN
    ALTER TABLE documentation.document_templates
      ADD CONSTRAINT fk_document_templates_current_version
      FOREIGN KEY (current_version_id)
      REFERENCES documentation.document_template_versions (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Colonnes attendues par l’API (suite logique de 010)
ALTER TABLE documentation.document_template_variables
  ADD COLUMN IF NOT EXISTS template_version_id UUID REFERENCES documentation.document_template_versions (id) ON DELETE CASCADE;

ALTER TABLE documentation.document_template_variables
  ADD COLUMN IF NOT EXISTS variable_type VARCHAR(16) NOT NULL DEFAULT 'text';

ALTER TABLE documentation.document_template_variables
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE documentation.document_template_variables
  ADD COLUMN IF NOT EXISTS default_value TEXT;

ALTER TABLE documentation.document_template_variables
  ADD COLUMN IF NOT EXISTS validation_rule TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_template_variable_by_version
  ON documentation.document_template_variables (template_version_id, variable_name)
  WHERE template_version_id IS NOT NULL;

ALTER TABLE documentation.generated_documents
  ADD COLUMN IF NOT EXISTS template_version_id UUID REFERENCES documentation.document_template_versions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_generated_documents_template_version
  ON documentation.generated_documents (template_version_id);

SET search_path TO public;
