import { HttpInterceptorFn, HttpErrorResponse, HttpEvent, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, throwError, Observable } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
    const authService = inject(AuthService);
    const baseUrl = environment.baseUrl;

    // Only intercept requests to our API
    if (!req.url.startsWith(baseUrl) && !req.url.startsWith('/api')) {
        return next(req);
    }

    const token = authService.getAccessToken();
    let authReq = req;

    // 1. Add Token to Headers
    if (token) {
        authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
    }

    // 2. Handle Response and Errors
    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401 && !authReq.url.includes('/admin/login') && !authReq.url.includes('/admin/refresh')) {
                return handle401Error(authReq, next, authService);
            }
            return throwError(() => error);
        })
    );
};

function handle401Error(req: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService): Observable<HttpEvent<any>> {
    if (!isRefreshing) {
        isRefreshing = true;
        refreshTokenSubject.next(null);

        return authService.refreshAccessToken().pipe(
            switchMap((response: any) => {
                isRefreshing = false;
                const newToken = response.access_token;
                refreshTokenSubject.next(newToken);

                return next(req.clone({
                    setHeaders: {
                        Authorization: `Bearer ${newToken}`
                    }
                }));
            }),
            catchError((err) => {
                isRefreshing = false;
                authService.logout();
                return throwError(() => err);
            })
        );
    } else {
        return refreshTokenSubject.pipe(
            filter(token => token != null),
            take(1),
            switchMap((token) => {
                return next(req.clone({
                    setHeaders: {
                        Authorization: `Bearer ${token}`
                    }
                }));
            })
        );
    }
}
