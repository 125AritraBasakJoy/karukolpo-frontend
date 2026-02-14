import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private authService: AuthService) { }

  // Helper to get headers with JWT token if available
  private getHeaders(skipAuth = false, contentType: string | null = 'application/json'): HttpHeaders {
    const token = this.authService.getAccessToken();
    let headers = new HttpHeaders();

    if (contentType) {
      headers = headers.set('Content-Type', contentType);
    }

    if (token && !skipAuth) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private handleError(error: HttpErrorResponse, requestFn: () => Observable<any>): Observable<any> {
    if (error.status === 401) {
      return this.handle401Error(requestFn);
    }
    return throwError(() => error);
  }

  /**
   * Step 3: When the access token expires, automatically refresh it.
   * Delegates the actual refresh call to AuthService.refreshAccessToken().
   * Queues concurrent requests while a refresh is in progress.
   */
  private handle401Error(requestFn: () => Observable<any>): Observable<any> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshAccessToken().pipe(
        switchMap((token: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token.access_token);
          return requestFn();
        }),
        catchError((err) => {
          this.isRefreshing = false;
          return throwError(() => err);
        })
      );
    } else {
      // Another refresh is already in progress — wait for it, then retry
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(() => requestFn())
      );
    }
  }

  get<T>(endpoint: string, options: { skipAuth?: boolean } = {}): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { headers: this.getHeaders(options.skipAuth) })
      .pipe(catchError(error => this.handleError(error, () => this.get<T>(endpoint, options))));
  }

  post<T>(endpoint: string, body: any, options: { skipAuth?: boolean } = {}): Observable<T> {
    const isFormData = body instanceof FormData;
    const contentType = isFormData ? null : 'application/json';

    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, { headers: this.getHeaders(options.skipAuth, contentType) })
      .pipe(catchError(error => this.handleError(error, () => this.post<T>(endpoint, body, options))));
  }

  put<T>(endpoint: string, body: any, options: { skipAuth?: boolean } = {}): Observable<T> {
    const isFormData = body instanceof FormData;
    const contentType = isFormData ? null : 'application/json';

    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, { headers: this.getHeaders(options.skipAuth, contentType) })
      .pipe(catchError(error => this.handleError(error, () => this.put<T>(endpoint, body, options))));
  }

  patch<T>(endpoint: string, body: any, options: { skipAuth?: boolean } = {}): Observable<T> {
    const isFormData = body instanceof FormData;
    const contentType = isFormData ? null : 'application/json';

    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, body, { headers: this.getHeaders(options.skipAuth, contentType) })
      .pipe(catchError(error => this.handleError(error, () => this.patch<T>(endpoint, body, options))));
  }

  delete<T>(endpoint: string, options: { skipAuth?: boolean, body?: any } = {}): Observable<T> {
    const contentType = options.body ? 'application/json' : null;
    const requestOptions: any = {
      headers: this.getHeaders(options.skipAuth, contentType)
    };

    if (options.body) {
      requestOptions.body = options.body;
    }

    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, requestOptions)
      .pipe(catchError(error => this.handleError(error, () => this.delete<T>(endpoint, options))));
  }
}
