import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { DocumentationDataApiService } from '../../core/services/documentation-data-api.service';
import { DocumentationIdentityService } from '../../core/services/documentation-identity.service';
import { DocumentationNotificationService } from '../../core/services/documentation-notification.service';
import { switchMapOnDocumentationContext } from '../lib/documentation-context-refresh';
import { DocumentationNavigationService } from '../services/documentation-navigation.service';
import type { DocumentationRole } from '../interfaces/documentation-role';

@Component({
  standalone: true,
  selector: 'app-hr-doc-review-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './hr-doc-review-page.component.html',
})
export class HrDocReviewPageComponent implements OnInit, OnDestroy {
  readonly role$ = this.nav.role$;

  generatedDocumentId = '';
  loading = true;
  error: string | null = null;
  busySave = false;
  busyFinalize = false;
  contentEditable = '';
  contentGenerated = '';
  missingVariables: string[] = [];
  status = '';

  private sub = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly data: DocumentationDataApiService,
    private readonly identity: DocumentationIdentityService,
    private readonly nav: DocumentationNavigationService,
    private readonly notify: DocumentationNotificationService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.route.paramMap.subscribe((pm) => {
        this.generatedDocumentId = pm.get('generatedDocumentId')?.trim() ?? '';
        if (!this.generatedDocumentId) {
          this.loading = false;
          this.error = 'Identifiant de document manquant.';
          return;
        }
        this.reload();
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  canUse(role: DocumentationRole): boolean {
    return role === 'RH' || role === 'Admin';
  }

  reload(): void {
    if (!this.generatedDocumentId) return;
    this.loading = true;
    this.error = null;
    this.sub.add(
      switchMapOnDocumentationContext(this.identity, () =>
        this.data.getRhGeneratedDocumentEditor(this.generatedDocumentId),
      ).subscribe({
        next: (dto) => {
          this.contentGenerated = dto.contentGenerated ?? '';
          this.contentEditable = dto.contentEditable ?? '';
          this.missingVariables = dto.missingVariables ?? [];
          this.status = dto.status ?? '';
          this.loading = false;
          this.error = null;
        },
        error: (e: unknown) => {
          this.loading = false;
          this.error = this.formatHttpError(e);
        },
      }),
    );
  }

  save(): void {
    if (!this.generatedDocumentId || this.busySave) return;
    this.busySave = true;
    this.error = null;
    this.sub.add(
      switchMapOnDocumentationContext(this.identity, () =>
        this.data.putRhGeneratedDocumentEditor(this.generatedDocumentId, this.contentEditable),
      ).subscribe({
        next: () => {
          this.busySave = false;
          this.notify.showSuccess('Texte enregistré.');
        },
        error: (e: unknown) => {
          this.busySave = false;
          this.error = this.formatHttpError(e);
        },
      }),
    );
  }

  finalizePdf(): void {
    if (!this.generatedDocumentId || this.busyFinalize) return;
    this.busyFinalize = true;
    this.error = null;
    this.sub.add(
      switchMapOnDocumentationContext(this.identity, () =>
        this.data.putRhGeneratedDocumentEditor(this.generatedDocumentId, this.contentEditable).pipe(
          switchMap(() => this.data.finalizeRhGeneratedDocument(this.generatedDocumentId)),
        ),
      ).subscribe({
        next: (res) => {
          this.busyFinalize = false;
          this.notify.showSuccess(`PDF généré : ${res.fileName}`);
          void this.router.navigate(['/dashboard', 'doc-gen']);
        },
        error: (e: unknown) => {
          this.busyFinalize = false;
          this.error = this.formatHttpError(e);
        },
      }),
    );
  }

  private formatHttpError(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const body = e.error;
      if (body && typeof body === 'object' && 'message' in body) {
        return String((body as { message?: string }).message);
      }
      return e.message || 'Action refusée par le serveur.';
    }
    return 'Erreur réseau ou serveur.';
  }
}
