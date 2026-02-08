# API Endpoints Migration Summary

## Key Changes from Old (`api_endpoints.csv`) to New (Actual Backend)

### Authentication Changes
**OLD:**
- `POST /api/auth/login` → `{"username": "string", "password": "string"}`
- `POST /api/auth/logout`
- `PUT /api/auth/credentials`

**NEW:**
- `POST /admin/login` → `{"email": "string", "password": "string"}`
- `POST /admin/refresh` → Refresh access token
- `POST /admin/forgot-password` → Password recovery
- `POST /admin/reset-password` → Password reset with token

### Products Changes
**OLD:**
- All endpoints under `/api/products`
- IDs as strings (`:id`)
- Used PUT for updates

**NEW:**
- Endpoints under `/products` (no `/api` prefix)
- IDs as integers (`{product_id}`)
- Uses **PATCH** for partial updates
- Additional inventory management: `GET/PATCH /products/{product_id}/inventory`
- Category relationships: `/products/{product_id}/categories/{category_id}`

### Orders Changes
**OLD:**
- `POST /api/orders` with simple structure
- `PUT /api/orders/:id/status`
- `PUT /api/orders/:id/payment`

**NEW:**
- `POST /orders` with structured address object
- `PATCH /orders/{order_id}/cancel` to cancel orders
- Separate payment endpoints:
  - `POST /orders/{order_id}/payments`
  - `PATCH /orders/{order_id}/payments/{payment_id}/confirm`
  - `POST /orders/{order_id}/payments/payments/webhook`

### New Endpoints Not in Old CSV
1. **Categories** - Full CRUD operations:
   - `GET/POST /categories`
   - `GET/PATCH/DELETE /categories/{category_id}`

2. **Inventory Management**:
   - `GET/PATCH /products/{product_id}/inventory`

3. **Product-Category Relationships**:
   - `POST/DELETE /products/{product_id}/categories/{category_id}`

4. **Admin Password Management**:
   - `POST /admin/forgot-password`
   - `POST /admin/reset-password`
   - `POST /admin/refresh` (token refresh)

### Removed Endpoints (Were in Old CSV, Not in New API)
1. `POST /api/auth/logout` - No server-side logout endpoint
2. `PUT /api/auth/credentials` - No credential update endpoint
3. `PUT /api/products/stock` - Replaced by inventory endpoints
4. `GET/PUT /api/admin/content/contact` - Not in OpenAPI spec
5. `GET/PUT /api/admin/content/site-config` - Not in OpenAPI spec
6. `GET/PUT /api/admin/config/payment/bkash-qr` - Not in OpenAPI spec
7. `GET/PUT /api/admin/config/delivery-charges` - Not in OpenAPI spec
8. `GET/PUT /api/admin/config/landing-page` - Not in OpenAPI spec
9. `GET/DELETE /api/admin/notifications` - Not in OpenAPI spec

### Important Type Changes
1. **Product/Order IDs**: Changed from strings to integers
2. **HTTP Methods**: `PUT` → `PATCH` for updates
3. **Authentication**: `username` → `email` for login
4. **Token Response**: Returns `{access_token, refresh_token?, token_type}` instead of `{token}`
5. **Price**: Returned as decimal string in responses
6. **Pagination**: All list endpoints support `skip` and `limit` query parameters

## Action Items for Frontend

✅ Created `API_ENDPOINTS.md` with complete documentation
✅ Added `patch()` method to `ApiService`
🔄 Need to update `AuthService.login()` to use `email` instead of `username`
⚠️ Services using localStorage need to be migrated to actual backend API calls
⚠️ ID fields need to be changed from string to number in many places
⚠️ Admin config services (contact, site-config, delivery, etc.) need backend endpoints added

