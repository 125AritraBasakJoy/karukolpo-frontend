import { Injectable, Inject, PLATFORM_ID, Injector } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom, timeout } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ADMIN_API } from './admin.api';
import { CategoryService } from '../category/category.service';
import { SKIP_AUTH_BEARER, SKIP_GLOBAL_LOADER } from '../../interceptors/http-context-tokens';

/** The session is over: the refresh token was rejected, or there is none. */
export class SessionExpiredError extends Error {
  constructor() { super('Session expired'); }
}

const REFRESH_LOCK = 'karukolpo-admin-refresh';
const REFRESH_TIMEOUT_MS = 20_000;

const API_ENDPOINTS = {
  ADMIN: ADMIN_API
} as const;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAdminLoggedInSubject = new BehaviorSubject<boolean>(false);
  isAdminLoggedIn$ = this.isAdminLoggedInSubject.asObservable();
  private refreshInFlight: Promise<string> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private injector: Injector,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.isAdminLoggedInSubject.next(this.hasToken());
      // Another tab logged out (or storage was cleared): follow it.
      window.addEventListener('storage', e => {
        if ((e.key === 'adminToken' || e.key === null) && !localStorage.getItem('adminToken')
            && this.isAdminLoggedInSubject.value) {
          this.isAdminLoggedInSubject.next(false);
          this.router.navigate(['/admin/login']);
        }
      });
      // Optional: coming back to a tab/PWA after a long idle, refresh BEFORE the
      // first request fails instead of after.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !this.isAuthenticated()) return;
        const token = this.getAccessToken();
        const exp = token ? jwtExpiry(token) : null;
        if (exp !== null && exp - Date.now() < 60_000) {
          this.ensureFreshAccessToken(token).catch(err => {
            if (err instanceof SessionExpiredError) this.logout();
          });
        }
      });
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
      API_ENDPOINTS.ADMIN.LOGIN,
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
          // Clear caches to ensure fresh data for the newly logged-in admin
          // Use injector to get CategoryService to avoid circular dependency
          const categoryService = this.injector.get(CategoryService);
          categoryService.clearCache();
        }
      })
    );
  }

  /**
   * A valid access token, refreshing only if needed. `staleToken` is the token the
   * failed request carried: when storage already holds a different one, another
   * request or tab refreshed and that one is returned without a network call.
   * A Promise on purpose: nothing a caller does (unsubscribe, navigate away) can
   * cancel it, so the shared state below can never be left half-done.
   */
  ensureFreshAccessToken(staleToken: string | null): Promise<string> {
    const current = this.getAccessToken();
    if (current && current !== staleToken) return Promise.resolve(current);
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.withRefreshLock(() => this.refreshUnderLock(staleToken))
        .finally(() => { this.refreshInFlight = null; });
    }
    return this.refreshInFlight;
  }

  private withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined' ? (navigator as any).locks : undefined;
    return locks?.request ? locks.request(REFRESH_LOCK, run) : run();
  }

  private async refreshUnderLock(staleToken: string | null): Promise<string> {
    // While this tab waited for the lock, another tab may have refreshed.
    const current = this.getAccessToken();
    if (current && current !== staleToken) return current;

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new SessionExpiredError();

    try {
      const res = await firstValueFrom(
        this.http.post<{ access_token: string; refresh_token: string }>(
          API_ENDPOINTS.ADMIN.REFRESH,
          { refresh_token: refreshToken },
          // No expired Bearer on the refresh call, and never 401-handled by the interceptor.
          { context: new HttpContext().set(SKIP_AUTH_BEARER, true) }
        ).pipe(timeout(REFRESH_TIMEOUT_MS))
      );
      localStorage.setItem('adminToken', res.access_token);
      localStorage.setItem('adminRefreshToken', res.refresh_token);
      return res.access_token;
    } catch (err) {
      // 401 = the session is over (expired, revoked, logged out elsewhere).
      if (err instanceof HttpErrorResponse && err.status === 401) throw new SessionExpiredError();
      // Network error, timeout, 429, 5xx: this request fails, the session stays.
      throw err;
    }
  }

  /** Kept for any old caller; prefer ensureFreshAccessToken. */
  refreshAccessToken(): Promise<string> {
    return this.ensureFreshAccessToken(this.getAccessToken());
  }

  /**
   * Step 5: Logout
   * Clears both tokens from storage and redirects to login.
   */
  logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Best effort: end the session on the server too. Never blocks or fails the logout.
      this.http.post(API_ENDPOINTS.ADMIN.LOGOUT, { refresh_token: refreshToken }, {
        context: new HttpContext().set(SKIP_AUTH_BEARER, true).set(SKIP_GLOBAL_LOADER, true)
      }).subscribe({ error: () => {} });
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminRefreshToken');
    }
    this.isAdminLoggedInSubject.next(false);
    // Clear caches when logging out
    // Use injector to get CategoryService to avoid circular dependency
    const categoryService = this.injector.get(CategoryService);
    categoryService.clearCache();
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
      API_ENDPOINTS.ADMIN.FORGOT_PASSWORD,
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
      API_ENDPOINTS.ADMIN.RESET_PASSWORD,
      { token, new_password: newPassword },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
    );
  }
}

/** The JWT `exp` claim in ms, or null if it can't be read. */
function jwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
