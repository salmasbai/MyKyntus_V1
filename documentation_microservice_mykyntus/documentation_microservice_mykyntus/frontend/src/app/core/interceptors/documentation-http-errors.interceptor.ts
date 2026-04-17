import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { DocumentationNotificationService } from '../services/documentation-notification.service';
import { formatDocumentationUxMessage } from '../../shared/utils/documentation-ux-messages';

const DataApiSegment = '/api/documentation/data';

/**
 * Messages utilisateur pour les erreurs HTTP du microservice Documentation (sans altérer le corps des erreurs).
 */
@Injectable()
export class DocumentationHttpErrorsInterceptor implements HttpInterceptor {
  constructor(private readonly notify: DocumentationNotificationService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      tap({
        error: (err: unknown) => {
          if (!(err instanceof HttpErrorResponse)) {
            return;
          }
          if (!req.url.includes(DataApiSegment)) {
            return;
          }
          if (err.status === 401) {
            const msg = formatDocumentationUxMessage(
              err,
              'Votre session n’a pas pu être vérifiée. Rechargez la page puis réessayez.',
            );
            this.notify.showError(msg);
          }
        },
      }),
    );
  }
}
