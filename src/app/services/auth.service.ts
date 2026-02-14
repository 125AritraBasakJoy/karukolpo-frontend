import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../core/api-endpoints';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAdminLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  isAdminLoggedIn$ = this.isAdminLoggedInSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  private hasToken(): boolean {
    return !!localStorage.getItem('adminToken');
  }

  /** Get the current access token from storage */
  getAccessToken(): string | null {
    return localStorage.getItem('adminToken');
  }

  /** Get the current refresh token from storage */
  getRefreshToken(): string | null {
    return localStorage.getItem('adminRefreshToken');
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
        if (response && response.access_token) {
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
        if (response && response.access_token) {
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
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    this.isAdminLoggedInSubject.next(false);
    this.router.navigate(['/admin/login']);
  }

  isAuthenticated(): boolean {
    return this.isAdminLoggedInSubject.value;
  }

  // Update credentials (currently localStorage-based)
  // TODO: Connect to backend endpoint when available
  updateCredentials(email: string, password: string): void {
    localStorage.setItem('adminEmail', email);
  }
}
