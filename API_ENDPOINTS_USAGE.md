# Using Centralized API Endpoints

The file `src/core/api-endpoints.ts` provides a centralized location for all API endpoint configurations.

## Quick Start

### Import the endpoints
```typescript
import { API_ENDPOINTS } from '@core/api-endpoints';
```

### Example Usage in Services

#### Products Service
```typescript
// List all products
this.apiService.get(API_ENDPOINTS.PRODUCTS.LIST);

// Get product by ID
this.apiService.get(API_ENDPOINTS.PRODUCTS.GET_BY_ID(123));

// Create new product
this.apiService.post(API_ENDPOINTS.PRODUCTS.CREATE, productData);

// Update product
this.apiService.patch(API_ENDPOINTS.PRODUCTS.UPDATE(123), updateData);

// Delete product
this.apiService.delete(API_ENDPOINTS.PRODUCTS.DELETE(123));

// Get product inventory
this.apiService.get(API_ENDPOINTS.PRODUCTS.GET_INVENTORY(123));

// Update product inventory
this.apiService.patch(API_ENDPOINTS.PRODUCTS.UPDATE_INVENTORY(123), { quantity: 50 });
```

#### Categories Service
```typescript
// List all categories
this.apiService.get(API_ENDPOINTS.CATEGORIES.LIST);

// Get category by ID
this.apiService.get(API_ENDPOINTS.CATEGORIES.GET_BY_ID(5));

// Create category
this.apiService.post(API_ENDPOINTS.CATEGORIES.CREATE, { name: 'New Category' });

// Update category
this.apiService.patch(API_ENDPOINTS.CATEGORIES.UPDATE(5), { name: 'Updated Name' });

// Delete category
this.apiService.delete(API_ENDPOINTS.CATEGORIES.DELETE(5));
```

#### Orders Service
```typescript
// List all orders
this.apiService.get(API_ENDPOINTS.ORDERS.LIST);

// Get order by ID
this.apiService.get(API_ENDPOINTS.ORDERS.GET_BY_ID(100));

// Create new order
this.apiService.post(API_ENDPOINTS.ORDERS.CREATE, orderData);

// Cancel order
this.apiService.patch(API_ENDPOINTS.ORDERS.CANCEL(100), {});
```

#### Payments Service
```typescript
// Create payment for order
this.apiService.post(API_ENDPOINTS.PAYMENTS.CREATE(100), { payment_method: 'bKash' });

// Confirm payment
this.apiService.patch(API_ENDPOINTS.PAYMENTS.CONFIRM(100, 5), { transaction_id: 'TXN123' });
```

#### Admin Authentication
```typescript
// Login
this.apiService.post(API_ENDPOINTS.ADMIN.LOGIN, { email: 'admin@example.com', password: 'pass' });

// Refresh token
this.apiService.post(API_ENDPOINTS.ADMIN.REFRESH, { refresh_token: 'token' });

// Forgot password
this.apiService.post(API_ENDPOINTS.ADMIN.FORGOT_PASSWORD, { email: 'admin@example.com' });

// Reset password
this.apiService.post(API_ENDPOINTS.ADMIN.RESET_PASSWORD, { token: 'reset-token', new_password: 'newpass' });
```

### Using Query Parameters
```typescript
import { buildListQuery } from '@core/api-endpoints';

// Get products with pagination
const query = buildListQuery(0, 20); // skip=0, limit=20
this.apiService.get(`${API_ENDPOINTS.PRODUCTS.LIST}${query}`);
```

## Benefits

✅ **Single source of truth** - All endpoints defined in one place  
✅ **Type safety** - TypeScript autocomplete for all endpoints  
✅ **Easy refactoring** - Change endpoint in one place, updates everywhere  
✅ **No typos** - No more string typos in endpoint paths  
✅ **Better maintainability** - Easy to see all available endpoints  

## Structure

```typescript
API_ENDPOINTS = {
  PRODUCTS: {
    LIST, CREATE, GET_BY_ID(id), UPDATE(id), DELETE(id),
    LIST_CATEGORIES(id), ADD_CATEGORY(id, catId), REMOVE_CATEGORY(id, catId),
    GET_INVENTORY(id), UPDATE_INVENTORY(id)
  },
  CATEGORIES: {
    LIST, CREATE, GET_BY_ID(id), UPDATE(id), DELETE(id)
  },
  ORDERS: {
    LIST, CREATE, GET_BY_ID(id), CANCEL(id)
  },
  PAYMENTS: {
    CREATE(orderId), CONFIRM(orderId, paymentId), WEBHOOK(orderId)
  },
  ADMIN: {
    LOGIN, REFRESH, FORGOT_PASSWORD, RESET_PASSWORD
  }
}
```
