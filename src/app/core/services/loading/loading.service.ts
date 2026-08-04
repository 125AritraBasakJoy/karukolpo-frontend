import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class LoadingService {
    private activeRequests = 0;
    loading = signal(false);

    setLoading(isLoading: boolean) {
        if (isLoading) {
            this.activeRequests++;
        } else {
            this.activeRequests--;
        }

        this.loading.set(this.activeRequests > 0);
    }
}
