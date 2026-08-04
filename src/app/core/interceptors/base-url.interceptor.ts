import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Interceptor to automatically prepend the environment's base URL
 * to relative API request paths.
 */
export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
    // Skip absolute URLs and local asset requests
    if (
        req.url.startsWith('http://') ||
        req.url.startsWith('https://') ||
        req.url.startsWith('assets/') ||
        req.url.startsWith('/assets/')
    ) {
        return next(req);
    }

    const baseUrl = environment.baseUrl;
    
    // Ensure clean joining of baseUrl and path
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;

    const apiReq = req.clone({
        url: `${cleanBase}/${cleanPath}`
    });

    return next(apiReq);
};
