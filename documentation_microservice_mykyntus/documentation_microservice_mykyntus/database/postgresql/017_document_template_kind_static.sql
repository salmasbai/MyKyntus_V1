-- =============================================================================
-- Type de modèle : dynamique (contenu structuré + variables) vs statique (fichier prêt).
-- requires_pilot_upload : le pilote doit joindre un fichier (ex. scan CIN).
-- Idempotent. Schéma : documentation
-- =============================================================================
SET search_path TO documentation, public;

DO $$
BEGIN
  CREATE TYPE documentation.document_template_kind AS ENUM ('dynamic', 'static');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS kind documentation.document_template_kind NOT NULL DEFAULT 'dynamic';

ALTER TABLE documentation.document_templates
  ADD COLUMN IF NOT EXISTS requires_pilot_upload BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN documentation.document_templates.kind IS
  'dynamic = génération / variables ; static = fichier MinIO (original_asset_uri) à télécharger ou recopier.';
COMMENT ON COLUMN documentation.document_templates.requires_pilot_upload IS
  'Si true (souvent avec static) : le pilote doit fournir un fichier (workflow métier côté UI).';

SET search_path TO public;
