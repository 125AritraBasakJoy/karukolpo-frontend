import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

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

  get<T>(endpoint: string, options: { skipAuth?: boolean } = {}): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { headers: this.getHeaders(options.skipAuth) });
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

    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, { headers: this.getHeaders(options.skipAuth, contentType) });
  }

  put<T>(endpoint: string, body: any, options: { skipAuth?: boolean } = {}): Observable<T> {
    const isFormData = body instanceof FormData;
    const contentType = isFormData ? null : 'application/json';

    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, { headers: this.getHeaders(options.skipAuth, contentType) });
  }

  patch<T>(endpoint: string, body: any, options: { skipAuth?: boolean } = {}): Observable<T> {
    const isFormData = body instanceof FormData;
    const contentType = isFormData ? null : 'application/json';

    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, body, { headers: this.getHeaders(options.skipAuth, contentType) });
  }

  delete<T>(endpoint: string, options: { skipAuth?: boolean } = {}): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, { headers: this.getHeaders(options.skipAuth) });
  }
}
