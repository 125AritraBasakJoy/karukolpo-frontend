import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
    const loadingService = inject(LoadingService);

    loadingService.setLoading(true);

    try {
        return next(req).pipe(
            finalize(() => {
                loadingService.setLoading(false);
            })
        );
    } catch (error) {
        loadingService.setLoading(false);
        throw error;
    }
};
