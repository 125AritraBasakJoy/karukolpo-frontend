import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { getDeviceId } from '../../utils/device-id';

// X-Device-Id is not CORS-safelisted: on a cross-origin GET it makes the browser send an
// OPTIONS preflight first, once per URL. Send it only where the backend reads it.
const DEVICE_READING_GETS = [
    /^\/products\/(?!hot-deals$|best-sellers$)[^/]+$/,  // product detail: records the view
    /^\/track\/offers$/,                                 // targeted offer: required
];

export const deviceIdInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.startsWith(environment.baseUrl) && !req.url.startsWith('/api')) {
        return next(req);
    }
    if (!needsDeviceId(req)) {
        return next(req);
    }
    return next(req.clone({ setHeaders: { 'X-Device-Id': getDeviceId() } }));
};

function needsDeviceId(req: HttpRequest<unknown>): boolean {
    // Writes carry a JSON body, so they are preflighted anyway.
    if (req.method !== 'GET' && req.method !== 'HEAD') return true;
    // Admin sessions are bound to the device.
    if (req.headers.has('Authorization')) return true;
    const path = apiPath(req.url);
    return path.startsWith('/admin') || DEVICE_READING_GETS.some(re => re.test(path));
}

function apiPath(url: string): string {
    const rest = url.startsWith(environment.baseUrl)
        ? url.slice(environment.baseUrl.length)
        : url.replace(/^\/api/, '');
    return rest.split('?')[0] || '/';
}
