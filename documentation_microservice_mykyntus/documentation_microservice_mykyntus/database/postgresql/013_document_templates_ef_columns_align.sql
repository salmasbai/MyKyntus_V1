-- =============================================================================
-- Alignement document_templates avec l’entité EF (évite 500 / 42703 sur GET …/document-templates).
-- À exécuter si des migrations partielles ont été appliquées (ex. source ajouté sans description, etc.).
-- Idempotent : ADD COLUMN IF NOT EXISTS + backfill tenant_id.
-- Prérequis : schéma documentation, tables document_types et document_templates (001).
-- =============================================================================
SET search_path TO documentation, public;

-- Multi-tenant (010)
ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);

UPDATE documentation.document_templates
SET tenant_id = 'atlas-tech-demo'
WHERE tenant_id IS NULL OR TRIM(tenant_id) = '';

ALTER TABLE documentation.document_templates
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'UPLOAD';

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS current_version_id UUID;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Lien type documentaire (011_document_templates_document_type)
ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS document_type_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'documentation'
      AND table_name = 'document_templates'
      AND constraint_name = 'document_templates_document_type_id_fkey'
  ) THEN
    ALTER TABLE documentation.document_templates
      ADD CONSTRAINT document_templates_document_type_id_fkey
      FOREIGN KEY (document_type_id)
      REFERENCES documentation.document_types (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_templates_document_type_id
  ON documentation.document_templates (document_type_id)
  WHERE document_type_id IS NOT NULL;

COMMENT ON COLUMN documentation.document_templates.description IS 'Description métier optionnelle (RH).';
COMMENT ON COLUMN documentation.document_templates.source IS 'UPLOAD = fichier, AI_GENERATED = IA, RULE_BASED = règles locales.';

SET search_path TO public;
