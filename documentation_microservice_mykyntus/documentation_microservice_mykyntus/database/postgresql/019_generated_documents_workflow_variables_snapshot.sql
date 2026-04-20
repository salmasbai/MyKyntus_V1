-- Instantané des variables fusionnées au moment de la création du brouillon RH
-- (même dictionnaire que l’aperçu / la génération), pour rejouer le DOCX Word à l’identique à la finalisation.

ALTER TABLE documentation.generated_documents
    ADD COLUMN IF NOT EXISTS workflow_variables_snapshot jsonb;

COMMENT ON COLUMN documentation.generated_documents.workflow_variables_snapshot IS
    'JSON : copie de la fusion variables (annuaire + demande + payload formulaire) au moment du brouillon ; utilisée pour le rendu DOCX final aligné sur l’aperçu.';
