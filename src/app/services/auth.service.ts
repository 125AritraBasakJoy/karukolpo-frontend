import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '../../core/api-endpoints';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAdminLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  isAdminLoggedIn$ = this.isAdminLoggedInSubject.asObservable();

  constructor(
    private router: Router,
    private apiService: ApiService
  ) { }

  private hasToken(): boolean {
    return !!localStorage.getItem('adminToken');
  }

  login(email: string, password: string): Observable<any> {
    // Send both email and username to cover different backend expectations
    const payload = { 
      email, 
      username: email,
      password 
    };

    return this.apiService.post<{ access_token: string; refresh_token?: string; token_type: string }>(
      API_ENDPOINTS.ADMIN.LOGIN,
      payload,
      { skipAuth: true }
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

  logout() {
    localStorage.removeItem('adminToken');
    this.isAdminLoggedInSubject.next(false);
    this.router.navigate(['/admin/login']);
  }

  isAuthenticated(): boolean {
    return this.isAdminLoggedInSubject.value;
  }

  // Update credentials (currently localStorage-based)
  // TODO: Connect to backend endpoint when available
  updateCredentials(email: string, password: string): void {
    // This is a placeholder for credential update functionality
    // In a real app, this would call a backend endpoint
    console.log('Credentials update requested for:', email);
    // For now, just store in localStorage as a demo
    localStorage.setItem('adminEmail', email);
  }
}
