import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class TrackingService {
  constructor(private apiService: ApiService) {}

  getVisits(limit = 200): Observable<any[]> {
    return this.apiService.get<any[]>(`track/visits?limit=${limit}`);
  }

  trackVisit(): void {
    // Only track once per session
    if (sessionStorage.getItem('tracked_session')) {
      return;
    }

    const visitor_id = this.getOrCreateVisitorId();
    const landing_path = window.location.pathname;
    const referrer = document.referrer || null;

    // Parse UTM parameters
    const urlParams = new URLSearchParams(window.location.search);
    const utm_source = urlParams.get('utm_source');
    const utm_medium = urlParams.get('utm_medium');
    const utm_campaign = urlParams.get('utm_campaign');

    const payload = {
      visitor_id,
      landing_path,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign
    };

    this.apiService.post('track/visit', payload).subscribe({
      next: () => {
        sessionStorage.setItem('tracked_session', 'true');
      },
      error: (err) => {
        console.error('Failed to track visit:', err);
      }
    });
  }

  private getOrCreateVisitorId(): string {
    let visitorId = localStorage.getItem('visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('visitor_id', visitorId);
    }
    return visitorId;
  }
}
