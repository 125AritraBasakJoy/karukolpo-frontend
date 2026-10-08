import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';
import { SKIP_GLOBAL_LOADER } from './http-context-tokens';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
    if (req.context.get(SKIP_GLOBAL_LOADER)) {
        return next(req);
    }

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
