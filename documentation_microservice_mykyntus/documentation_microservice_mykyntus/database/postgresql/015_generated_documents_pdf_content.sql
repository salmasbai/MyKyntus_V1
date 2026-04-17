-- PDF binaire en base lorsque MinIO n'est pas utilisé (complément à storage_uri).
ALTER TABLE documentation.generated_documents
  ADD COLUMN IF NOT EXISTS pdf_content BYTEA NULL;

COMMENT ON COLUMN documentation.generated_documents.pdf_content IS 'Octets PDF si stockage objet désactivé; NULL si fichier uniquement sur MinIO/S3.';
