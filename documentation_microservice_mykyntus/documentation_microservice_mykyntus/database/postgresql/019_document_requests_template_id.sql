-- Lien optionnel demande → modèle choisi par le pilote (pour traçabilité et génération RH).
ALTER TABLE documentation.document_requests
  ADD COLUMN IF NOT EXISTS document_template_id uuid NULL;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_requests_document_template_id_fkey'
  ) THEN
    ALTER TABLE documentation.document_requests
      ADD CONSTRAINT document_requests_document_template_id_fkey
      FOREIGN KEY (document_template_id)
      REFERENCES documentation.document_templates(id)
      ON DELETE SET NULL;
  END IF;
END;
$fk$;

CREATE INDEX IF NOT EXISTS ix_document_requests_document_template_id
  ON documentation.document_requests(document_template_id);
