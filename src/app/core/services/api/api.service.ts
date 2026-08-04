import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) { }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(endpoint);
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(endpoint, body);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(endpoint, body);
  }

  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(endpoint, body);
  }

  delete<T>(endpoint: string, options: { body?: any } = {}): Observable<T> {
    return this.http.delete<T>(endpoint, { body: options.body });
  }
}
