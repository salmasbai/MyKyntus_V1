/**
 * Libellés d’affichage pour les demandes de documents (sans toucher aux données API).
 */

/** Type de document lisible, sans code modèle / suffixe technique. */
export function cleanDocumentRequestTypeLabel(raw: string | null | undefined): string {
  let s = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return 'Document';

  const pipeIdx = s.indexOf('|');
  if (pipeIdx !== -1) {
    s = s.slice(0, pipeIdx).trim();
  }

  s = s
    .replace(/\s*\([^)]*mod[eè]le[^)]*\)/gi, '')
    .replace(/\s*\([^)]*template[^)]*\)/gi, '')
    .replace(/\s*\([^)]*code[^)]*\)/gi, '')
    .replace(/\s*[-:–—]\s*mod[eè]le.*$/gi, '')
    .replace(/\s*[-:–—]\s*template.*$/gi, '')
    .replace(/\s*\(mod[eè]le.*?\)/gi, '')
    .trim();

  s = s.replace(/\s*[–—]\s*[A-Z0-9][A-Z0-9_\-.]{2,}\s*$/i, '').trim();

  return s || 'Document';
}

/**
 * Champ `employeeName` côté API : souvent « pilote vers bénéficiaire ».
 * Pour les listes RH, on n’affiche que le pilote (demandeur).
 */
export function pilotDisplayNameFromEmployeeName(
  raw: string | null | undefined,
  emptyLabel = 'Collaborateur',
): string {
  const t = (raw ?? '').trim();
  if (!t) return emptyLabel;
  const parts = t.split(/\s+vers\s+/i);
  if (parts.length >= 2) {
    const pilot = parts[0].trim();
    if (pilot) return pilot;
  }
  return t;
}
