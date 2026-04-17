ALTER TABLE documentation.document_template_variables
    ADD COLUMN IF NOT EXISTS form_scope VARCHAR(16) NOT NULL DEFAULT 'pilot',
    ADD COLUMN IF NOT EXISTS source_priority INTEGER NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS raw_placeholder VARCHAR(255) NULL;

UPDATE documentation.document_template_variables
SET form_scope = COALESCE(NULLIF(trim(form_scope), ''), 'pilot'),
    source_priority = COALESCE(source_priority, 20)
WHERE true;
