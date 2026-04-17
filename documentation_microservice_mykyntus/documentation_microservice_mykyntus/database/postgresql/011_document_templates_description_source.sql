-- Description RH + source étendue (UPLOAD | AI_GENERATED | RULE_BASED)
-- Crée aussi source si la migration 010 n'a pas été appliquée (évite 42703 sur ALTER TYPE).
SET search_path TO documentation, public;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'UPLOAD';

ALTER TABLE documentation.document_templates
  ALTER COLUMN source TYPE VARCHAR(32);

COMMENT ON COLUMN documentation.document_templates.description IS 'Description métier optionnelle (RH).';
COMMENT ON COLUMN documentation.document_templates.source IS 'UPLOAD = fichier, AI_GENERATED = IA, RULE_BASED = règles locales.';
