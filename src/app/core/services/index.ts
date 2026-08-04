// Services
export * from './api/api.service';
export * from './analytics/analytics.service';
export * from './product/product.service';
export * from './category/category.service';
export * from './order/order.service';
export * from './payment/payment.service';
export * from './auth/auth.service';
export * from './notification/notification.service';
export * from './cart/cart.service';
export * from './contact/contact.service';
export * from './delivery/delivery.service';
export * from './loading/loading.service';
export * from './site-config/site-config.service';
export * from './theme/theme.service';
export * from './version/version.service';

// APIs & Helpers
export * from './api/api-config';
export * from './api/helpers';
export * from './product/product.api';
export * from './category/category.api';
export * from './order/order.api';
export * from './payment/payment.api';
export * from './auth/admin.api';
export * from './notification/notification.api';
export * from './analytics/analytics.api';

// Aggregate Endpoint Mapping (for compatibility/convenience)
import { PRODUCTS_API } from './product/product.api';
import { CATEGORIES_API } from './category/category.api';
import { ORDERS_API } from './order/order.api';
import { PAYMENTS_API } from './payment/payment.api';
import { ADMIN_API } from './auth/admin.api';
import { NOTIFICATIONS_API } from './notification/notification.api';
import { ANALYTICS_API } from './analytics/analytics.api';

export const API_ENDPOINTS = {
    PRODUCTS: PRODUCTS_API,
    CATEGORIES: CATEGORIES_API,
    ORDERS: ORDERS_API,
    PAYMENTS: PAYMENTS_API,
    ADMIN: ADMIN_API,
    NOTIFICATIONS: NOTIFICATIONS_API,
    ANALYTICS: ANALYTICS_API,
} as const;
