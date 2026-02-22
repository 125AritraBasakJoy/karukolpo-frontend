import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../core/api-endpoints';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAdminLoggedInSubject = new BehaviorSubject<boolean>(false);
  isAdminLoggedIn$ = this.isAdminLoggedInSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.isAdminLoggedInSubject.next(this.hasToken());
    }
  }

  private hasToken(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return !!localStorage.getItem('adminToken');
    }
    return false;
  }

  /** Get the current access token from storage */
  getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('adminToken');
    }
    return null;
  }

  /** Get the current refresh token from storage */
  getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('adminRefreshToken');
    }
    return null;
  }

  /**
   * Step 1: Login
   * Sends credentials to /admin/login and stores both tokens on success.
   * Uses HttpClient directly (no ApiService) to avoid circular dependency.
   */
  login(email: string, password: string): Observable<any> {
    const payload = {
      email,
      username: email,
      password
    };

    return this.http.post<{ access_token: string; refresh_token?: string; token_type: string }>(
      `${environment.apiUrl}/${API_ENDPOINTS.ADMIN.LOGIN}`,
      payload,
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    ).pipe(
      tap(response => {
        if (response && response.access_token && isPlatformBrowser(this.platformId)) {
          localStorage.setItem('adminToken', response.access_token);
          if (response.refresh_token) {
            localStorage.setItem('adminRefreshToken', response.refresh_token);
          }
          this.isAdminLoggedInSubject.next(true);
        }
      })
    );
  }

  /**
   * Step 3: Refresh the access token using the refresh token.
   * Called automatically by ApiService when a 401 is encountered.
   */
  refreshAccessToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<any>(
      `${environment.apiUrl}/${API_ENDPOINTS.ADMIN.REFRESH}`,
      { refresh_token: refreshToken }
    ).pipe(
      tap(response => {
        if (response && response.access_token && isPlatformBrowser(this.platformId)) {
          localStorage.setItem('adminToken', response.access_token);
          if (response.refresh_token) {
            localStorage.setItem('adminRefreshToken', response.refresh_token);
          }
        }
      }),
      catchError(err => {
        // Step 4: Refresh failed — force logout
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /**
   * Step 5: Logout
   * Clears both tokens from storage and redirects to login.
   */
  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminRefreshToken');
    }
    this.isAdminLoggedInSubject.next(false);
    this.router.navigate(['/admin/login']);
  }

  isAuthenticated(): boolean {
    return this.isAdminLoggedInSubject.value;
  }

  /**
   * Forgot Password — sends a reset link to the admin's email.
   * POST /admin/forgot-password  { email }
   */
  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/${API_ENDPOINTS.ADMIN.FORGOT_PASSWORD}`,
      { email },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }

  /**
   * Reset Password — sets a new password using the token from the email link.
   * POST /admin/reset-password  { token, new_password }
   */
  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post<any>(
      `${environment.apiUrl}/${API_ENDPOINTS.ADMIN.RESET_PASSWORD}`,
      { token, new_password: newPassword },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }
}
