import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { DocumentationIdentityService } from '../../core/services/documentation-identity.service';
import type { DocumentationDocument } from '../interfaces/documentation-entities';
import { switchMapOnDocumentationContext } from '../lib/documentation-context-refresh';
import { mapAssignedRequestToDocument, mapDocumentRequestDto } from '../lib/documentation-dto-mappers';
import { DocumentationApiService } from '../services/documentation-api.service';
import { DocIconComponent } from '../components/doc-icon/doc-icon.component';
import { GeneratedDocumentFormatMenuComponent } from '../components/generated-document-format-menu/generated-document-format-menu.component';
import { GeneratedDocumentPreviewModalComponent } from '../components/generated-document-preview-modal/generated-document-preview-modal.component';
import { StatusBadgeComponent } from '../components/status-badge/status-badge.component';

@Component({
  standalone: true,
  selector: 'app-my-documents-page',
  imports: [
    CommonModule,
    FormsModule,
    DocIconComponent,
    StatusBadgeComponent,
    GeneratedDocumentFormatMenuComponent,
    GeneratedDocumentPreviewModalComponent,
  ],
  templateUrl: './my-documents-page.component.html',
})
export class MyDocumentsPageComponent implements OnInit, OnDestroy {
  search = '';

  private documents: DocumentationDocument[] = [];
  loading = true;
  error: string | null = null;
  previewOpen = false;
  previewGeneratedId: string | null = null;
  previewTitle = '';
  previewSubtitle: string | null = null;
  private sub = new Subscription();

  constructor(
    private readonly api: DocumentationApiService,
    private readonly identity: DocumentationIdentityService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      switchMapOnDocumentationContext(this.identity, () => this.api.getAllAssignedDocumentRequests()).subscribe({
        next: (rows) => {
          const ui = rows.map(mapDocumentRequestDto);
          this.documents = ui
            .filter((r) => (r.status ?? '').trim().toLowerCase() === 'generated' || !!r.generatedDocumentId?.trim())
            .map(mapAssignedRequestToDocument);
          this.loading = false;
          this.error = null;
        },
        error: () => {
          this.documents = [];
          this.loading = false;
          this.error = 'Impossible de charger les documents.';
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  filtered() {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.documents;
    return this.documents.filter(
      (doc) => doc.name.toLowerCase().includes(q) || doc.type.toLowerCase().includes(q),
    );
  }

  canOpenOrDownload(doc: DocumentationDocument): boolean {
    return !!(doc.generatedDocumentId?.trim() || doc.status === 'Generated');
  }

  openPreview(doc: DocumentationDocument): void {
    const id = doc.generatedDocumentId?.trim();
    if (!id) return;
    this.previewGeneratedId = id;
    this.previewTitle = doc.name?.trim() || 'Document généré';
    this.previewSubtitle = doc.type;
    this.previewOpen = true;
  }

  closePreview(): void {
    this.previewOpen = false;
    this.previewGeneratedId = null;
  }
}
