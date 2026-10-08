import { HttpContextToken } from '@angular/common/http';

export const SKIP_GLOBAL_LOADER = new HttpContextToken<boolean>(() => false);
export const SKIP_AUTH_BEARER = new HttpContextToken<boolean>(() => false);
