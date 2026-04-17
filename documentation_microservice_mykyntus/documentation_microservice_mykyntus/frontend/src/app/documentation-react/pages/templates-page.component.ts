import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import mammoth from 'mammoth';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { DocumentationDataApiService } from '../../core/services/documentation-data-api.service';
import { DocumentationNotificationService } from '../../core/services/documentation-notification.service';
import type {
  DocumentTemplateDetailDto,
  DocumentTemplateListItemDto,
  InternalEngineAnalysisDto,
  InternalEnginePlaceholderDto,
  TemplateVariableDto,
} from '../../shared/models/api.models';
import { formatDocumentationUxMessage } from '../../shared/utils/documentation-ux-messages';
import { DocIconComponent } from '../components/doc-icon/doc-icon.component';

@Component({
  standalone: true,
  selector: 'app-templates-page',
  imports: [CommonModule, FormsModule, DocIconComponent],
  templateUrl: './templates-page.component.html',
  styles: [`
    .template-action-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      align-items: stretch;
    }

    @media (min-width: 1536px) {
      .template-action-row {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }

    .template-action-button {
      position: relative;
      display: inline-flex;
      min-height: 2.75rem;
      width: 100%;
      min-width: 0;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      overflow: hidden;
      border-radius: 0.75rem;
      padding: 0.75rem 0.95rem;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.1;
      white-space: nowrap;
      text-overflow: ellipsis;
      transition:
        transform 160ms ease,
        box-shadow 160ms ease,
        filter 160ms ease,
        opacity 160ms ease,
        background-color 160ms ease;
    }

    .template-action-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(15, 23, 42, 0.22);
      filter: brightness(1.05);
    }

    .template-action-button:disabled {
      pointer-events: none;
      opacity: 0.6;
    }

    .template-action-button__label {
      display: inline-flex;
      min-width: 0;
      max-width: 100%;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .template-action-button__spinner {
      height: 1rem;
      width: 1rem;
      flex: 0 0 auto;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 9999px;
      animation: template-action-spin 0.75s linear infinite;
    }

    @keyframes template-action-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
})
export class TemplatesPageComponent implements OnInit, OnDestroy {
  readonly uploadPlaceholderHint = 'Contenu source avec placeholders {{nom}} ...';

  /** Exemple d’accolades affiché tel quel (éviter {{ … }} dans le HTML, le compilateur Angular les interprète). */
  readonly placeholderSyntaxExample = '{{nom}}';
  templates: DocumentTemplateListItemDto[] = [];
  selectedTemplate: DocumentTemplateDetailDto | null = null;
  loading = true;
  error: string | null = null;
  selectedTemplateId: string | null = null;
  lastMessage: string | null = null;
  newTemplateMode: 'upload' | 'rule' | 'ai' | 'internal' = 'upload';
  uploadFile: File | null = null;
  form = {
    code: '',
    name: '',
    documentTypeId: '',
    fileName: '',
    content: '',
    description: '',
  };
  /** Données fictives pour « Tester template » — généré à partir des variables du modèle sélectionné, pas extrait du Word. */
  sampleDataRaw = '{}';
  testRunRendered: string | null = null;
  missingVariables: string[] = [];
  internalEngineAnalysis: InternalEngineAnalysisDto | null = null;
  internalEngineBusy = false;

  /** Modale prévisualisation (PDF natif, DOCX → HTML via mammoth). */
  previewOpen = false;
  previewLoading = false;
  previewTitle = '';
  previewKind: 'pdf' | 'docx' | 'other' | null = null;
  previewPdfSafeUrl: SafeResourceUrl | null = null;
  previewDocxHtml: SafeHtml | null = null;
  previewFileName: string | null = null;
  /** URL blob pour iframe PDF / lien Télécharger — public pour le template. */
  previewBlobUrl: string | null = null;
  cleaningDrafts = false;
  creatingTemplate = false;
  private readonly templateActionLoading = new Map<string, TemplateAction>();

  private sub = new Subscription();

  constructor(
    private readonly data: DocumentationDataApiService,
    private readonly sanitizer: DomSanitizer,
    private readonly notify: DocumentationNotificationService,
  ) {}

  private debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>): void {
    fetch('http://127.0.0.1:7721/ingest/64a12fe4-8b14-42fa-b884-e01871ac05cf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4e1d33'},body:JSON.stringify({sessionId:'4e1d33',runId:'initial',hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
  }

  ngOnInit(): void {
    this.reloadTemplates();
  }

  private reloadTemplates(): void {
    this.loading = true;
    this.sub.add(
      this.data.getDocumentTemplates().subscribe({
        next: (rows) => {
          // #region agent log
          this.debugLog('H3', 'templates-page.component.ts:79', 'reloadTemplates next', {
            selectedTemplateId: this.selectedTemplateId,
            count: rows.length,
            ids: rows.slice(0, 10).map((row) => row.id),
            selectedExistsInList: !!this.selectedTemplateId && rows.some((row) => row.id === this.selectedTemplateId),
          });
          // #endregion
          this.templates = rows;
          this.loading = false;
          this.error = null;
        },
        error: () => {
          this.templates = [];
          this.loading = false;
          this.error = 'Impossible de charger les modèles (API /api/documentation/data/document-templates).';
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.closePreview();
    this.sub.unsubscribe();
  }

  generate(t: DocumentTemplateListItemDto): void {
    if (this.isTemplateActionLoading(t.id)) return;
    if (!t.isActive) {
      this.lastMessage = 'Activez le modèle (bouton Activer) avant de générer un PDF.';
      return;
    }
    this.setTemplateActionLoading(t.id, 'generate');
    this.lastMessage = null;
    const sample = this.parseSampleData() ?? {};
    const body: { documentTypeId?: string; variables: Record<string, string> } = { variables: sample };
    if (t.documentTypeId?.trim()) body.documentTypeId = t.documentTypeId.trim();
    this.sub.add(
      this.data.generateFromDocumentTemplate(t.id, body).subscribe({
        next: (res) => {
          this.clearTemplateActionLoading(t.id);
          this.lastMessage = `Généré : ${res.fileName} — ${res.storageUri}`;
          this.notify.showSuccess('Le document a ete genere avec succes.');
          this.reloadTemplates();
        },
        error: (err) => {
          this.clearTemplateActionLoading(t.id);
          this.lastMessage = this.apiErrorMessage(
            err,
            'Échec de la génération (vérifiez les en-têtes et la session).',
          );
          this.notify.showError(this.lastMessage);
        },
      }),
    );
  }

  createTemplate(): void {
    if (this.creatingTemplate) return;
    this.lastMessage = null;
    if (!this.form.name.trim()) {
      this.lastMessage = 'Le nom est obligatoire.';
      return;
    }

    const effectiveCode = this.resolveTemplateCode();
    if (!effectiveCode) {
      this.lastMessage = 'Impossible de générer un code template. Renseignez le nom ou le code.';
      return;
    }

    const documentTypeId = this.form.documentTypeId.trim() || null;
    const descriptionOpt = this.form.description.trim() || null;

    if (this.newTemplateMode === 'upload') {
      if (this.uploadFile) {
        this.creatingTemplate = true;
        this.sub.add(
          this.data
            .createTemplateFromUploadFile({
              code: effectiveCode,
              name: this.form.name.trim(),
              description: descriptionOpt,
              documentTypeId,
              file: this.uploadFile,
              kind: 'dynamic',
            })
            .subscribe({
              next: (res) => {
                this.creatingTemplate = false;
                this.lastMessage = `Le modèle « ${res.name} » a été créé avec succès.`;
                this.notify.showSuccess('Le modele a ete cree avec succes.');
                this.clearForm();
                this.reloadTemplates();
              },
              error: (err) => {
                this.creatingTemplate = false;
                this.lastMessage = this.apiErrorMessage(
                  err,
                  "Échec de l'import du modèle. Vérifiez le stockage des fichiers puis réessayez.",
                );
                this.notify.showError(this.lastMessage);
              },
            }),
        );
        return;
      }
      if (!this.form.content.trim()) {
        this.lastMessage = 'Choisissez un fichier ou collez du texte avec placeholders.';
        return;
      }
      this.creatingTemplate = true;
      this.sub.add(
        this.data
          .createTemplateFromUpload({
            code: effectiveCode,
            name: this.form.name,
            description: descriptionOpt,
            documentTypeId,
            fileName: this.form.fileName || 'upload.txt',
            content: this.form.content,
          })
          .subscribe({
            next: (res) => {
              this.creatingTemplate = false;
              this.lastMessage = `Le modèle « ${res.name} » a été créé avec succès.`;
              this.notify.showSuccess('Le modele a ete cree avec succes.');
              this.clearForm();
              this.reloadTemplates();
            },
            error: () => {
              this.creatingTemplate = false;
              this.lastMessage = 'Échec création template (texte).';
              this.notify.showError(this.lastMessage);
            },
          }),
      );
      return;
    }

    if (this.newTemplateMode === 'ai') {
      if (!this.form.description.trim()) {
        this.lastMessage = 'La description est obligatoire pour la génération IA.';
        return;
      }
      this.creatingTemplate = true;
      this.sub.add(
        this.data
          .createTemplateFromAi({
            description: this.form.description.trim(),
            name: this.form.name.trim(),
            code: effectiveCode,
            documentTypeId,
          })
          .subscribe({
            next: (res) => {
              this.creatingTemplate = false;
              this.lastMessage = `Le modèle « ${res.name} » a été généré avec succès.`;
              this.clearForm();
              this.reloadTemplates();
            },
            error: () => {
              this.creatingTemplate = false;
              this.lastMessage = 'La génération du modèle a échoué. Réessayez dans un instant.';
            },
          }),
      );
      return;
    }

    if (this.newTemplateMode === 'internal') {
      if (!this.form.content.trim()) {
        this.lastMessage = 'Le contenu du template est obligatoire pour le moteur interne.';
        return;
      }
      this.creatingTemplate = true;
      const createAfterAnalysis = (analysis: InternalEngineAnalysisDto) =>
        this.data
          .createTemplateFromInternalEngine({
            code: effectiveCode,
            name: this.form.name.trim(),
            description: descriptionOpt,
            documentTypeId,
            structuredContent: this.form.content,
            variables: analysis.variables,
          })
          .subscribe({
            next: (res) => {
              this.creatingTemplate = false;
              this.lastMessage = `Le modèle « ${res.name} » a été créé avec succès.`;
              this.clearForm();
              this.internalEngineAnalysis = null;
              this.reloadTemplates();
            },
            error: (err) => {
              this.creatingTemplate = false;
              this.lastMessage = this.apiErrorMessage(err, 'Échec création via le moteur interne.');
            },
          });

      if (this.internalEngineAnalysis?.structuredContent === this.form.content) {
        this.sub.add(createAfterAnalysis(this.internalEngineAnalysis));
      } else {
        this.sub.add(
          this.data
            .analyzeInternalEngineTemplate({
              code: effectiveCode,
              name: this.form.name.trim(),
              description: descriptionOpt,
              documentTypeId,
              structuredContent: this.form.content,
            })
            .subscribe({
              next: (analysis) => {
                this.internalEngineAnalysis = analysis;
                this.sub.add(createAfterAnalysis(analysis));
              },
              error: (err) => {
                this.creatingTemplate = false;
                this.lastMessage = this.apiErrorMessage(err, 'Échec analyse du moteur interne.');
              },
            }),
        );
      }
      return;
    }

    if (!this.form.description.trim()) {
      this.lastMessage = 'La description RH est obligatoire.';
      return;
    }
    this.creatingTemplate = true;
    this.sub.add(
      this.data
        .createTemplateRuleBased({
          code: effectiveCode,
          name: this.form.name,
          documentTypeId,
          description: this.form.description,
        })
        .subscribe({
          next: (res) => {
            this.creatingTemplate = false;
            this.lastMessage = `Le modèle « ${res.name} » a été généré avec succès.`;
            this.clearForm();
            this.reloadTemplates();
          },
          error: () => {
            this.creatingTemplate = false;
            this.lastMessage = 'Échec création template par règles.';
          },
        }),
    );
  }

  selectTemplate(templateId: string, afterLoad?: () => void): void {
    if (this.isTemplateActionLoading(templateId)) return;
    this.setTemplateActionLoading(templateId, 'detail');
    // #region agent log
    this.debugLog('H4', 'templates-page.component.ts:248', 'selectTemplate entry', {
      templateId,
      previousSelectedTemplateId: this.selectedTemplateId,
      previousSelectedTemplateCurrentVersion: !!this.selectedTemplate?.currentVersion,
      previousSelectedTemplateKind: this.selectedTemplate?.kind ?? null,
    });
    // #endregion
    this.selectedTemplateId = templateId;
    this.testRunRendered = null;
    this.missingVariables = [];
    this.sub.add(
      this.data.getDocumentTemplate(templateId).subscribe({
        next: (res) => {
          this.clearTemplateActionLoading(templateId);
          // #region agent log
          this.debugLog('H1', 'templates-page.component.ts:259', 'selectTemplate detail loaded', {
            templateId,
            responseId: res.id,
            kind: res.kind ?? null,
            source: res.source ?? null,
            hasCurrentVersion: !!res.currentVersion,
            currentVersionNumber: res.currentVersion?.versionNumber ?? null,
            variablesCount: res.currentVersion?.variables?.length ?? null,
            originalAssetUriPresent: !!res.currentVersion?.originalAssetUri,
          });
          // #endregion
          this.selectedTemplate = this.normalizeTemplateDetailScopes(res);
          this.sampleDataRaw = this.buildSampleJsonFromVariables(this.selectedTemplate.currentVersion?.variables ?? []);
          window.setTimeout(() => {
            const el = document.getElementById('template-detail-panel');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 0);
          afterLoad?.();
        },
        error: (err) => {
          this.clearTemplateActionLoading(templateId);
          // #region agent log
          this.debugLog('H2', 'templates-page.component.ts:276', 'selectTemplate detail error', {
            templateId,
            status: err?.status ?? null,
            statusText: err?.statusText ?? null,
            message: err?.message ?? null,
          });
          // #endregion
          this.lastMessage = 'Impossible de charger le détail du template.';
        },
      }),
    );
  }

  visualizeTemplate(t: DocumentTemplateListItemDto): void {
    if (this.isTemplateActionLoading(t.id)) return;
    this.setTemplateActionLoading(t.id, 'visualize');
    this.openTemplatePreview(t.id, t.name);
  }

  openSelectedTemplateFile(): void {
    if (!this.selectedTemplate) return;
    this.openTemplatePreview(this.selectedTemplate.id, this.selectedTemplate.name);
  }

  closePreview(): void {
    this.previewOpen = false;
    this.previewLoading = false;
    this.previewKind = null;
    this.previewPdfSafeUrl = null;
    this.previewDocxHtml = null;
    this.previewFileName = null;
    if (this.previewBlobUrl) {
      URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
    for (const [templateId, action] of this.templateActionLoading.entries()) {
      if (action === 'visualize') {
        this.templateActionLoading.delete(templateId);
      }
    }
  }

  private openTemplatePreview(templateId: string, title: string): void {
    this.lastMessage = null;
    this.closePreview();
    this.previewOpen = true;
    this.previewLoading = true;
    this.previewTitle = title;

    this.sub.add(
      this.data.getTemplateSourceFileBlob(templateId).subscribe({
        next: (resp) => {
          const blob = resp.body;
          if (!blob || blob.size === 0) {
            this.previewLoading = false;
            this.previewOpen = false;
            this.clearTemplateActionLoading(templateId);
            this.lastMessage = 'Fichier vide ou introuvable.';
            return;
          }
          const headerCt = resp.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
          const fn = this.fileNameFromContentDisposition(resp.headers.get('content-disposition')) ?? 'document';
          this.previewFileName = fn;
          void this.applyPreviewBlob(templateId, blob, headerCt, fn);
        },
        error: (err: HttpErrorResponse) => {
          void this.handlePreviewHttpError(err).then((msg) => {
            this.previewLoading = false;
            this.previewOpen = false;
            this.lastMessage = msg;
            this.clearTemplateActionLoading(templateId);
          });
        },
      }),
    );
  }

  private async applyPreviewBlob(
    templateId: string,
    blob: Blob,
    headerContentType: string,
    fileName: string,
  ): Promise<void> {
    const lower = fileName.toLowerCase();
    const ct = headerContentType.toLowerCase();

    if (ct === 'application/pdf' || lower.endsWith('.pdf')) {
      const url = URL.createObjectURL(blob);
      this.previewBlobUrl = url;
      this.previewPdfSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.previewKind = 'pdf';
      this.previewLoading = false;
      this.clearTemplateActionLoading(templateId);
      return;
    }

    if (
      ct.includes('wordprocessingml') ||
      ct === 'application/msword' ||
      lower.endsWith('.docx')
    ) {
      try {
        const buf = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        this.previewDocxHtml = this.sanitizer.bypassSecurityTrustHtml(result.value);
        this.previewKind = 'docx';
      } catch {
        const url = URL.createObjectURL(blob);
        this.previewBlobUrl = url;
        this.previewKind = 'other';
      }
      this.previewLoading = false;
      this.clearTemplateActionLoading(templateId);
      return;
    }

    const url = URL.createObjectURL(blob);
    this.previewBlobUrl = url;
    this.previewKind = 'other';
    this.previewLoading = false;
    this.clearTemplateActionLoading(templateId);
  }

  private async handlePreviewHttpError(err: HttpErrorResponse): Promise<string> {
    if (err.error instanceof Blob) {
      try {
        const t = await err.error.text();
        const j = JSON.parse(t) as { message?: unknown };
        if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
      } catch {
        /* ignore */
      }
    }
    return this.apiErrorMessage(err, 'Impossible de charger le fichier pour prévisualisation.');
  }

  private fileNameFromContentDisposition(cd: string | null): string | null {
    if (!cd) return null;
    const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
    if (star?.[1]) {
      try {
        return decodeURIComponent(star[1].trim().replace(/(^")|("$)/g, ''));
      } catch {
        return star[1].trim();
      }
    }
    const fn = /filename\s*=\s*"([^"]+)"/i.exec(cd);
    if (fn?.[1]) return fn[1];
    const fn2 = /filename\s*=\s*([^;\s]+)/i.exec(cd);
    return fn2?.[1]?.trim() ?? null;
  }

  /** Aperçu du texte issu de l’analyse DOCX (champ bodyText du JSON stocké côté API). */
  analyzedTextExcerpt(): string | null {
    const raw = this.selectedTemplate?.currentVersion?.structuredContent;
    if (!raw?.trim()) return null;
    try {
      const o = JSON.parse(raw) as { format?: string; bodyText?: string };
      if (typeof o.bodyText === 'string' && o.bodyText.trim()) {
        const t = o.bodyText.trim();
        return t.length > 2500 ? `${t.slice(0, 2500)}…` : t;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private buildSampleJsonFromVariables(vars: TemplateVariableDto[]): string {
    if (vars.length === 0) {
      return '{}';
    }
    const o: Record<string, string> = {};
    for (const v of vars) {
      o[v.name] = '';
    }
    return `${JSON.stringify(o, null, 2)}`;
  }

  toggleTemplateStatus(template: DocumentTemplateListItemDto): void {
    if (this.isTemplateActionLoading(template.id)) return;
    this.setTemplateActionLoading(template.id, 'toggle');
    this.sub.add(
      this.data.setTemplateStatus(template.id, !template.isActive).subscribe({
        next: () => {
          this.clearTemplateActionLoading(template.id);
          this.lastMessage = `Template ${template.code} ${template.isActive ? 'désactivé' : 'activé'}.`;
          this.notify.showSuccess(
            template.isActive ? 'Le modele a ete desactive.' : 'Le modele a ete active.',
          );
          this.reloadTemplates();
          if (this.selectedTemplateId === template.id) this.selectTemplate(template.id);
        },
        error: () => {
          this.clearTemplateActionLoading(template.id);
          this.lastMessage = 'Échec mise à jour du statut.';
          this.notify.showError(this.lastMessage);
        },
      }),
    );
  }

  pilotVarBusy = false;

  analyzeInternalEngine(): void {
    if (this.internalEngineBusy) return;
    if (!this.form.content.trim()) {
      this.lastMessage = 'Collez d’abord le contenu du template à analyser.';
      return;
    }
    this.internalEngineBusy = true;
    this.lastMessage = null;
    this.sub.add(
      this.data
        .analyzeInternalEngineTemplate({
          code: this.form.code.trim() || null,
          name: this.form.name.trim() || null,
          description: this.form.description.trim() || null,
          documentTypeId: this.form.documentTypeId.trim() || null,
          structuredContent: this.form.content,
        })
        .subscribe({
          next: (analysis) => {
            this.internalEngineBusy = false;
            this.internalEngineAnalysis = analysis;
            this.lastMessage = `Analyse interne terminée : ${analysis.placeholders.length} placeholder(s) détecté(s).`;
          },
          error: (err) => {
            this.internalEngineBusy = false;
            this.lastMessage = this.apiErrorMessage(err, 'Analyse interne impossible.');
          },
        }),
    );
  }

  addPilotVariable(formScope: 'pilot' | 'hr' | 'db' = 'pilot'): void {
    const vars = this.selectedTemplate?.currentVersion?.variables;
    if (!vars) return;
    const used = new Set(vars.map((v) => v.name.trim().toLowerCase()));
    let idx = vars.length + 1;
    let name = `champ_${idx}`;
    while (used.has(name.toLowerCase())) {
      idx += 1;
      name = `champ_${idx}`;
    }
    vars.push({
      id: `tmp-${Date.now()}-${idx}`,
      name,
      type: 'text',
      isRequired: false,
      defaultValue: null,
      validationRule: null,
      displayLabel: '',
      formScope,
      sourcePriority: formScope === 'hr' ? 30 : formScope === 'db' ? 10 : 20,
      normalizedName: name,
      rawPlaceholder: formScope === 'hr' ? null : `(${name})`,
      sortOrder: vars.length,
    });
  }

  removePilotVariable(index: number): void {
    const vars = this.selectedTemplate?.currentVersion?.variables;
    if (!vars) return;
    if (index < 0 || index >= vars.length) return;
    vars.splice(index, 1);
    vars.forEach((v, i) => (v.sortOrder = i));
  }

  private normalizeFormScope(scope: string | null | undefined): 'pilot' | 'hr' | 'db' {
    const normalized = (scope ?? 'pilot').trim().toLowerCase();
    if (normalized === 'hr' || normalized === 'both') return 'hr';
    if (normalized === 'db') return 'db';
    return 'pilot';
  }

  private normalizeTemplateVariableScopes(vars: TemplateVariableDto[]): TemplateVariableDto[] {
    return vars.map((v) => {
      const formScope = this.normalizeFormScope(v.formScope);
      return {
        ...v,
        formScope,
        sourcePriority: formScope === 'hr' ? 30 : formScope === 'db' ? 10 : 20,
      };
    });
  }

  private normalizeTemplateDetailScopes(detail: DocumentTemplateDetailDto): DocumentTemplateDetailDto {
    if (!detail.currentVersion?.variables?.length) return detail;
    return {
      ...detail,
      currentVersion: {
        ...detail.currentVersion,
        variables: this.normalizeTemplateVariableScopes(detail.currentVersion.variables),
      },
    };
  }

  pilotVariables(): TemplateVariableDto[] {
    return (this.selectedTemplate?.currentVersion?.variables ?? []).filter(
      (v) => this.normalizeFormScope(v.formScope) === 'pilot',
    );
  }

  hrVariables(): TemplateVariableDto[] {
    return (this.selectedTemplate?.currentVersion?.variables ?? []).filter(
      (v) => this.normalizeFormScope(v.formScope) === 'hr',
    );
  }

  dbVariables(): TemplateVariableDto[] {
    return (this.selectedTemplate?.currentVersion?.variables ?? []).filter(
      (v) => this.normalizeFormScope(v.formScope) === 'db',
    );
  }

  /** Enregistre la définition des formulaires Pilote / RH (version courante). */
  savePilotDefinitions(): void {
    if (!this.selectedTemplate?.currentVersion?.variables?.length) {
      this.lastMessage = 'Aucune variable à enregistrer.';
      return;
    }
    const names = new Set<string>();
    for (const v of this.selectedTemplate.currentVersion.variables) {
      const raw = v.name.trim();
      if (!raw) {
        this.lastMessage = 'Chaque donnée nécessaire doit avoir un nom technique (ex: cin, rib).';
        return;
      }
      const normalized = raw.toLowerCase();
      if (names.has(normalized)) {
        this.lastMessage = `Nom de variable en double: ${raw}`;
        return;
      }
      names.add(normalized);
    }
    const vars = this.selectedTemplate.currentVersion.variables.map((v) => {
      const formScope = this.normalizeFormScope(v.formScope);
      return {
        name: v.name.trim(),
        type: v.type,
        isRequired: v.isRequired,
        defaultValue: v.defaultValue,
        validationRule: v.validationRule,
        displayLabel: v.displayLabel,
        formScope,
        sourcePriority: v.sourcePriority ?? (formScope === 'hr' ? 30 : formScope === 'db' ? 10 : 20),
        normalizedName: v.normalizedName ?? v.name.trim(),
        rawPlaceholder: v.rawPlaceholder ?? null,
      };
    });
    this.pilotVarBusy = true;
    this.sub.add(
      this.data.putCurrentVersionTemplateVariables(this.selectedTemplate.id, vars).subscribe({
        next: (res) => {
          this.selectedTemplate = this.normalizeTemplateDetailScopes(res);
          this.pilotVarBusy = false;
          this.lastMessage = 'Formulaires Pilote / RH enregistrés.';
          this.sampleDataRaw = this.buildSampleJsonFromVariables(this.selectedTemplate.currentVersion?.variables ?? []);
        },
        error: (err) => {
          this.pilotVarBusy = false;
          this.lastMessage = this.apiErrorMessage(err, 'Échec enregistrement des formulaires.');
        },
      }),
    );
  }

  publishNewVersion(): void {
    if (!this.selectedTemplate) return;
    const currentVersion = this.selectedTemplate.currentVersion;
    const content = currentVersion?.structuredContent ?? '';
    const vars: TemplateVariableDto[] = currentVersion?.variables ?? [];
    // #region agent log
    this.debugLog('H5', 'templates-page.component.ts:671', 'publishNewVersion request prepared', {
      templateId: this.selectedTemplate.id,
      kind: this.selectedTemplate.kind ?? null,
      hasCurrentVersion: !!currentVersion,
      currentVersionNumber: currentVersion?.versionNumber ?? null,
      contentLength: content.length,
      variablesCount: vars.length,
      originalAssetUriPresent: !!currentVersion?.originalAssetUri,
      variableNames: vars.slice(0, 10).map((v) => v.name),
    });
    // #endregion
    this.sub.add(
      this.data
        .createTemplateVersion(this.selectedTemplate.id, {
          structuredContent: content,
          status: 'published',
          originalAssetUri: currentVersion?.originalAssetUri ?? null,
          variables: vars.map((v) => {
            const formScope = this.normalizeFormScope(v.formScope);
            return {
              name: v.name.trim(),
              type: v.type,
              isRequired: v.isRequired,
              defaultValue: v.defaultValue,
              validationRule: v.validationRule,
              displayLabel: v.displayLabel,
              formScope,
              sourcePriority: v.sourcePriority ?? (formScope === 'hr' ? 30 : formScope === 'db' ? 10 : 20),
              normalizedName: v.normalizedName ?? v.name.trim(),
              rawPlaceholder: v.rawPlaceholder ?? null,
            };
          }),
        })
        .subscribe({
          next: (res) => {
            // #region agent log
            this.debugLog('H5', 'templates-page.component.ts:696', 'publishNewVersion success', {
              templateId: this.selectedTemplate?.id ?? null,
              versionNumber: res.versionNumber,
            });
            // #endregion
            this.lastMessage = `Version ${res.versionNumber} publiée.`;
            this.selectTemplate(this.selectedTemplate!.id);
            this.reloadTemplates();
          },
          error: (err) => {
            // #region agent log
            this.debugLog('H5', 'templates-page.component.ts:704', 'publishNewVersion error', {
              templateId: this.selectedTemplate?.id ?? null,
              status: err?.status ?? null,
              statusText: err?.statusText ?? null,
              apiMessage:
                err?.error && typeof err.error === 'object' && typeof err.error.message === 'string'
                  ? err.error.message
                  : null,
            });
            // #endregion
            this.lastMessage = this.apiErrorMessage(err, 'Échec publication version.');
          },
        }),
    );
  }

  runTest(): void {
    if (!this.selectedTemplate) return;
    const sample = this.parseSampleData();
    if (!sample) {
      this.lastMessage = 'JSON de données fictives invalide.';
      return;
    }
    this.sub.add(
      this.data.testRunTemplate(this.selectedTemplate.id, sample).subscribe({
        next: (res) => {
          this.testRunRendered = res.renderedContent;
          this.missingVariables = res.missingVariables;
        },
        error: () => (this.lastMessage = 'Échec test-run template.'),
      }),
    );
  }

  private parseSampleData(): Record<string, string> | null {
    try {
      const raw = JSON.parse(this.sampleDataRaw) as Record<string, unknown>;
      const normalized: Record<string, string> = {};
      Object.keys(raw).forEach((k) => {
        normalized[k] = String(raw[k] ?? '');
      });
      return normalized;
    } catch {
      return null;
    }
  }

  onUploadFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    this.uploadFile = f ?? null;
  }

  onNameChanged(value: string): void {
    if (this.form.code.trim()) return;
    this.form.code = this.buildTemplateCodeFromName(value);
  }

  deleteTemplate(template: DocumentTemplateListItemDto): void {
    if (this.isTemplateActionLoading(template.id)) return;
    const ok = window.confirm(`Supprimer le template « ${template.name} » ?`);
    if (!ok) return;
    this.setTemplateActionLoading(template.id, 'delete');
    this.sub.add(
      this.data.deleteTemplate(template.id).subscribe({
        next: () => {
          this.clearTemplateActionLoading(template.id);
          if (this.selectedTemplateId === template.id) {
            this.selectedTemplateId = null;
            this.selectedTemplate = null;
          }
          this.lastMessage = `Template supprimé : ${template.code}`;
          this.notify.showSuccess('Le modele a ete supprime.');
          this.reloadTemplates();
        },
        error: (err) => {
          this.clearTemplateActionLoading(template.id);
          this.lastMessage = this.apiErrorMessage(err, 'Suppression refusée.');
          this.notify.showError(this.lastMessage);
        },
      }),
    );
  }

  cleanupDraftTemplates(): void {
    if (this.cleaningDrafts) return;
    const candidates = this.templates.filter((t) => !t.isActive);
    if (candidates.length === 0) {
      this.lastMessage = 'Aucun template inactif à nettoyer.';
      return;
    }
    const ok = window.confirm(
      `Nettoyer ${candidates.length} template(s) inactif(s) ? Les demandes actives empêcheront la suppression.`,
    );
    if (!ok) return;
    this.cleaningDrafts = true;
    const jobs = candidates.map((t) =>
      this.data.deleteTemplate(t.id).pipe(
        map(() => ({ ok: true as const, code: t.code })),
        catchError((err) =>
          of({
            ok: false as const,
            code: t.code,
            reason: this.apiErrorMessage(err, 'Suppression refusée'),
          }),
        ),
      ),
    );
    this.sub.add(
      forkJoin(jobs).subscribe({
        next: (results) => {
          this.cleaningDrafts = false;
          const success = results.filter((r) => r.ok).length;
          const fails = results.filter((r) => !r.ok);
          if (fails.length === 0) {
            this.lastMessage = `Nettoyage terminé : ${success} template(s) supprimé(s).`;
          } else {
            const sample = fails.slice(0, 3).map((f) => `${f.code}: ${f.reason}`).join(' | ');
            this.lastMessage = `Nettoyage partiel : ${success} supprimé(s), ${fails.length} bloqué(s). ${sample}`;
          }
          this.reloadTemplates();
        },
        error: () => {
          this.cleaningDrafts = false;
          this.lastMessage = 'Échec du nettoyage des brouillons.';
        },
      }),
    );
  }

  /** Affiche le champ message du JSON d’erreur API (503 MinIO, 409 code dupliqué, etc.). */
  private apiErrorMessage(err: unknown, fallback: string): string {
    return formatDocumentationUxMessage(err, fallback);
  }

  private clearForm(): void {
    this.uploadFile = null;
    this.form = { code: '', name: '', documentTypeId: '', fileName: '', content: '', description: '' };
    this.internalEngineAnalysis = null;
  }

  isTemplateActionLoading(templateId: string, action?: TemplateAction): boolean {
    const current = this.templateActionLoading.get(templateId);
    return action ? current === action : !!current;
  }

  private setTemplateActionLoading(templateId: string, action: TemplateAction): void {
    this.templateActionLoading.set(templateId, action);
  }

  private clearTemplateActionLoading(templateId: string): void {
    this.templateActionLoading.delete(templateId);
  }

  private resolveTemplateCode(): string {
    const explicit = this.form.code.trim().toUpperCase();
    if (explicit) return explicit;
    const generated = this.buildTemplateCodeFromName(this.form.name);
    this.form.code = generated;
    return generated;
  }

  private buildTemplateCodeFromName(name: string): string {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 44);
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 14);
    return (base ? `${base}_${stamp}` : `TEMPLATE_${stamp}`).slice(0, 64);
  }
}

type TemplateAction = 'detail' | 'visualize' | 'toggle' | 'delete' | 'generate';
