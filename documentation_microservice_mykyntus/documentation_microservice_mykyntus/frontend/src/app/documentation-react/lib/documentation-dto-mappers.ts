import type { AuditLogDto, DocumentRequestDto, DocumentTypeDto } from '../../shared/models/api.models';
import type { DocumentationDocument, DocumentationRequest, DocumentationTemplate } from '../interfaces/documentation-entities';

function normalizeRequestStatus(raw: string): DocumentationRequest['status'] {
  const key = raw.trim().toLowerCase();
  const map: Record<string, DocumentationRequest['status']> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    generated: 'Generated',
    cancelled: 'Cancelled',
  };
  return map[key] ?? (raw as DocumentationRequest['status']);
}

export function mapDocumentRequestDto(d: DocumentRequestDto): DocumentationRequest {
  let status = normalizeRequestStatus(String(d.status ?? ''));
  if (d.generatedDocumentId?.trim()) {
    status = 'Generated';
  }
  return {
    id: d.id,
    internalId: d.internalId,
    type: d.type,
    requestDate: d.requestDate,
    status,
    employeeName: d.employeeName,
    employeeId: d.employeeId ?? undefined,
    reason: d.reason ?? undefined,
    rejectionReason: d.rejectionReason ?? undefined,
    allowedActions: d.allowedActions ?? [],
    generatedDocumentId: d.generatedDocumentId?.trim() || undefined,
    generatedAt: d.generatedAt?.trim() || undefined,
    documentUrl: d.documentUrl?.trim() || undefined,
  };
}

export function mapRequestToGeneratedDocument(r: DocumentationRequest): DocumentationDocument | null {
  if (r.status !== 'Generated') return null;
  return {
    id: r.id,
    name: `${r.type} (${r.id})`,
    type: r.type,
    dateCreated: r.requestDate,
    status: 'Generated',
    employeeName: r.employeeName,
    employeeId: r.employeeId,
  };
}

/** Liste « Mes documents » : toutes les demandes assignées à l’utilisateur (tous statuts). */
export function mapAssignedRequestToDocument(r: DocumentationRequest): DocumentationDocument {
  const hasPdf = !!r.generatedDocumentId?.trim();
  return {
    id: r.id,
    name: `${r.type} (${r.id})`,
    type: r.type,
    dateCreated: r.requestDate,
    status: hasPdf ? 'Generated' : r.status,
    employeeName: r.employeeName,
    employeeId: r.employeeId,
    generatedDocumentId: r.generatedDocumentId?.trim(),
  };
}

export function mapDocumentTypeDtoToTemplate(t: DocumentTypeDto): DocumentationTemplate {
  return {
    id: t.id,
    name: t.name,
    lastModified: '',
    variables: [],
  };
}
