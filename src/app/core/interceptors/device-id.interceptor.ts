import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { getDeviceId } from '../../utils/device-id';

export const deviceIdInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.startsWith(environment.baseUrl) && !req.url.startsWith('/api')) {
        return next(req);
    }

    return next(req.clone({
        setHeaders: {
            'X-Device-Id': getDeviceId()
        }
    }));
};
