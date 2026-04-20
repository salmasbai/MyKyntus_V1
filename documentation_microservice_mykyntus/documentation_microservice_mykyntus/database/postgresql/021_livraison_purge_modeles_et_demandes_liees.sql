-- =============================================================================
-- MyKyntus Documentation — Livraison : purge des modèles RH et des demandes liées
--
-- Effet :
--   1) Supprime les entrées d’audit dont entity_id pointe vers une demande ayant
--      un document_template_id renseigné.
--   2) Supprime les generated_documents dont document_request_id est une telle demande.
--   3) Supprime les document_request_field_values associés.
--   4) Supprime les document_requests avec document_template_id non NULL.
--   5) Supprime toutes les lignes de documentation.document_templates (cascade /
--      set null sur versions, variables, etc. selon les migrations déjà appliquées).
--
-- Prérequis : schéma à jour (001 → 020), notamment colonne document_template_id.
--
-- Multi-tenant : pour limiter aux demandes / modèles d’un tenant, dupliquer ce
-- fichier ou ajouter manuellement « AND dr.tenant_id = 'votre-tenant' » dans
-- chaque requête qui utilise l’alias « dr », et « WHERE tenant_id = '…' » sur
-- la suppression des modèles à la place du DELETE sans filtre.
--
-- MinIO / S3 : ce script ne supprime pas les objets distants (orphelins possibles).
--
-- Exemple :
--   psql -h HOST -U USER -d mykyntus_documentation -v ON_ERROR_STOP=1 -f 021_livraison_purge_modeles_et_demandes_liees.sql
-- =============================================================================

SET search_path TO documentation, public;

BEGIN;

DELETE FROM documentation.audit_logs al
USING documentation.document_requests dr
WHERE al.entity_id = dr.id
  AND dr.document_template_id IS NOT NULL
  AND (
    lower(coalesce(al.entity_type, '')) LIKE '%document_request%'
    OR lower(coalesce(al.entity_type, '')) LIKE '%documentrequest%'
  );

DELETE FROM documentation.generated_documents gd
USING documentation.document_requests dr
WHERE gd.document_request_id = dr.id
  AND dr.document_template_id IS NOT NULL;

DELETE FROM documentation.document_request_field_values fv
USING documentation.document_requests dr
WHERE fv.document_request_id = dr.id
  AND dr.document_template_id IS NOT NULL;

DELETE FROM documentation.document_requests dr
WHERE dr.document_template_id IS NOT NULL;

-- Évite les erreurs de FK circulaire (current_version_id → document_template_versions).
UPDATE documentation.document_templates
SET current_version_id = NULL
WHERE current_version_id IS NOT NULL;

DELETE FROM documentation.document_templates;

COMMIT;

SET search_path TO public;
