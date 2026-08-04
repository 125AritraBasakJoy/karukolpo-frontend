import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class VersionService {
    private currentVersion = '1.0.1';
    private versionUrl = '/assets/version.json?t=' + new Date().getTime();

    constructor(
        private http: HttpClient,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    checkForUpdates() {
        if (!isPlatformBrowser(this.platformId)) return;

        this.http.get<{ version: string }>(this.versionUrl).pipe(
            tap(data => {
                const localVersion = localStorage.getItem('app_version');

                if (localVersion && localVersion !== data.version) {
                    console.log(`New version detected: ${data.version}. Local: ${localVersion}. Reloading...`);
                    localStorage.setItem('app_version', data.version);
                    // Small delay before reload to ensure storage is committed
                    setTimeout(() => location.reload(), 500);
                } else if (!localVersion) {
                    localStorage.setItem('app_version', data.version);
                }
            }),
            catchError(err => {
                console.error('Failed to check for updates', err);
                return of(null);
            })
        ).subscribe();
    }
}
