-- =============================================================================
-- Fix PostgreSQL 42703 : column "source" of relation "document_templates" does not exist
-- Cause fréquente : migration 010 (template_management_v1) non appliquée, ou 011 exécuté
-- sans que source n'existe encore (ALTER TYPE échoue si la colonne est absente).
-- Idempotent : safe à relancer.
-- =============================================================================
SET search_path TO documentation, public;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'UPLOAD';

COMMENT ON COLUMN documentation.document_templates.source IS 'UPLOAD = fichier, AI_GENERATED = IA, RULE_BASED = règles locales.';
