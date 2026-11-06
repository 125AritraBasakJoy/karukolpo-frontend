import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService, SessionExpiredError } from '../services/auth/auth.service';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH_BEARER } from './http-context-tokens';

// No module-level state: the single in-flight refresh lives in AuthService as a Promise.

const AUTH_ENDPOINT = /\/admin\/(login|refresh|logout)(\?|$)/;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH_BEARER)) return next(req);
  if (!req.url.startsWith(environment.baseUrl) && !req.url.startsWith('/api')) return next(req);

  const auth = inject(AuthService);
  const sentWith = auth.getAccessToken();
  const withToken = (token: string | null): HttpRequest<unknown> =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(sentWith)).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only a request that carried a token can be fixed by refreshing it.
      if (error.status !== 401 || !sentWith || AUTH_ENDPOINT.test(req.url)) {
        return throwError(() => error);
      }
      return from(auth.ensureFreshAccessToken(sentWith)).pipe(
        // This catchError sits BEFORE switchMap on purpose: it handles a failed
        // refresh only, never an error from the retried request.
        catchError(refreshError => {
          if (refreshError instanceof SessionExpiredError) auth.logout();
          return throwError(() => error);   // the caller sees the original 401
        }),
        switchMap(token => next(withToken(token)))
      );
    })
  );
};
