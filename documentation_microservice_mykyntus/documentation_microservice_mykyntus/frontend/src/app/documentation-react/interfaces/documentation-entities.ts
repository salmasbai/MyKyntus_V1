export interface DocumentationDocument {
  id: string;
  name: string;
  type: string;
  dateCreated: string;
  status: 'Generated' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  employeeName?: string;
  department?: string;
  employeeId?: string;
  /** UUID du PDF (GET …/generated-documents/{id}/file). */
  generatedDocumentId?: string;
}

export interface DocumentationRequest {
  /** Numéro affiché (ex. REQ-2026-000001). */
  id: string;
  /** UUID pour les appels workflow (approve / reject). */
  internalId: string;
  type: string;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Generated' | 'Cancelled';
  employeeName: string;
  employeeId?: string;
  reason?: string;
  rejectionReason?: string;
  /** Actions renvoyées par l’API selon le rôle (ex. approve, reject). */
  allowedActions: string[];
  generatedDocumentId?: string;
  generatedAt?: string;
  documentUrl?: string;
}

export interface DocumentationTemplate {
  id: string;
  name: string;
  lastModified: string;
  variables: string[];
}

export interface DocumentationAuditLog {
  id: string;
  action: string;
  documentName: string;
  user: string;
  timestamp: string;
}
