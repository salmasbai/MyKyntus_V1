-- Brouillon RH : statut enum + textes (généré machine vs contenu édité avant PDF final).
-- Exécuter sur la base documentation (schéma documentation).

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'documentation'
      AND t.typname = 'generated_document_status'
      AND e.enumlabel = 'draft_pending_rh'
  ) THEN
    ALTER TYPE documentation.generated_document_status ADD VALUE 'draft_pending_rh';
  END IF;
END;
$migration$;

ALTER TABLE documentation.generated_documents
  ADD COLUMN IF NOT EXISTS content_generated text NULL,
  ADD COLUMN IF NOT EXISTS content_final text NULL,
  ADD COLUMN IF NOT EXISTS rh_missing_variables text NULL;
