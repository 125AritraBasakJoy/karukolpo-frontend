import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private router: Router) { }

  // Helper to get headers with JWT token if available
  private getHeaders(skipAuth = false, contentType: string | null = 'application/json'): HttpHeaders {
    const token = localStorage.getItem('adminToken');
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

  private handle401Error(requestFn: () => Observable<any>): Observable<any> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = localStorage.getItem('adminRefreshToken');

      if (refreshToken) {
        return this.http.post<any>(`${this.baseUrl}/admin/refresh`, { refresh_token: refreshToken }).pipe(
          switchMap((token: any) => {
            this.isRefreshing = false;
            localStorage.setItem('adminToken', token.access_token);
            if (token.refresh_token) {
              localStorage.setItem('adminRefreshToken', token.refresh_token);
            }
            this.refreshTokenSubject.next(token.access_token);
            return requestFn();
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this.logout();
            return throwError(() => err);
          })
        );
      } else {
        this.isRefreshing = false;
        this.logout();
        return throwError(() => new Error('No refresh token available'));
      }
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(() => requestFn())
      );
    }
  }

  private logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    this.router.navigate(['/admin/login']);
  }

  get<T>(endpoint: string, options: { skipAuth?: boolean } = {}): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { headers: this.getHeaders(options.skipAuth) })
      .pipe(catchError(error => this.handleError(error, () => this.get<T>(endpoint, options))));
  }

  post<T>(endpoint: string, body: any, options: { skipAuth?: boolean } = {}): Observable<T> {
    const isFormData = body instanceof FormData;
    const contentType = isFormData ? null : 'application/json';

    console.log('API POST Request:', {
      url: `${this.baseUrl}/${endpoint}`,
      body,
      isFormData,
      skipAuth: options.skipAuth
    });

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

    console.log('API DELETE Request:', {
      url: `${this.baseUrl}/${endpoint}`,
      body: options.body,
      contentType
    });

    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, requestOptions)
      .pipe(catchError(error => this.handleError(error, () => this.delete<T>(endpoint, options))));
  }
}
