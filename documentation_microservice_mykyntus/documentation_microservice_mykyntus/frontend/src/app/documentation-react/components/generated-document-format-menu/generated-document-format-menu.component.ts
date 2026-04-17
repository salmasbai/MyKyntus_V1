import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { Component, HostListener, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { DocumentationDataApiService } from '../../../core/services/documentation-data-api.service';
import { DocumentationNotificationService } from '../../../core/services/documentation-notification.service';
import {
  formatDocumentationHttpError,
  triggerDownloadFromHttpResponse,
} from '../../lib/documentation-download.util';
export type GeneratedExportFormat = 'pdf' | 'docx' | 'txt' | 'html';

@Component({
  standalone: true,
  selector: 'app-generated-document-format-menu',
  imports: [CommonModule],
  templateUrl: './generated-document-format-menu.component.html',
})
export class GeneratedDocumentFormatMenuComponent implements OnDestroy {
  /** Document généré cible (export multi-format). */
  @Input() generatedDocumentId: string | null = null;
  /**
   * <c>button</c> / <c>standard</c> : libellé « ⬇ Télécharger » (<c>.btn-download</c>).
   * <c>icon</c> : bouton compact même style (liste étroite).
   */
  @Input() appearance: 'button' | 'icon' | 'standard' = 'button';
  menuOpen = false;
  busyFormat: GeneratedExportFormat | null = null;
  private sub = new Subscription();

  constructor(
    private readonly data: DocumentationDataApiService,
    private readonly notify: DocumentationNotificationService,
  ) {}

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuOpen = false;
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.generatedDocumentId?.trim() || this.busyFormat) return;
    this.menuOpen = !this.menuOpen;
  }

  downloadAs(format: GeneratedExportFormat, event: MouseEvent): void {
    event.stopPropagation();
    const id = this.generatedDocumentId?.trim();
    if (!id || this.busyFormat) return;
    this.busyFormat = format;
    this.menuOpen = false;
    const fallback = `document.${format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : format === 'html' ? 'html' : 'txt'}`;
    this.sub.add(
      this.data.exportGeneratedDocument(id, format).subscribe({
        next: (resp: HttpResponse<Blob>) => {
          this.busyFormat = null;
          triggerDownloadFromHttpResponse(resp, fallback);
          this.notify.showSuccess('Téléchargement démarré.');
        },
        error: (e: unknown) => {
          this.busyFormat = null;
          void formatDocumentationHttpError(e).then((m) => this.notify.showError(m));
        },
      }),
    );
  }
}
