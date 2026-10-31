import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) { }

  get<T>(endpoint: string, options?: { context?: any; params?: any; headers?: any }): Observable<T> {
    return this.http.get<T>(endpoint, options);
  }

  getResponse<T>(endpoint: string, options?: { context?: any; params?: any; headers?: any }): Observable<HttpResponse<T>> {
    return this.http.get<T>(endpoint, { ...options, observe: 'response' });
  }

  getBlob(endpoint: string, options?: { context?: any; params?: any; headers?: any }): Observable<HttpResponse<Blob>> {
    return this.http.get(endpoint, {
      ...options,
      observe: 'response',
      responseType: 'blob'
    });
  }

  post<T>(endpoint: string, body: any, options?: { context?: any; params?: any; headers?: any }): Observable<T> {
    return this.http.post<T>(endpoint, body, options);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(endpoint, body);
  }

  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(endpoint, body);
  }

  delete<T>(endpoint: string, options: { body?: any; params?: any; headers?: any } = {}): Observable<T> {
    return this.http.delete<T>(endpoint, { body: options.body, params: options.params, headers: options.headers });
  }
}
