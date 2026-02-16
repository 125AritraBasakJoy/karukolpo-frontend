# Karukolpo Backend API Endpoints

**Base URL:** `https://api.karukolpocrafts.com`

## Products

| Method | Endpoint | Description | Auth Required | Request Body | Response |
|--------|----------|-------------|---------------|--------------|----------|
| GET | `/products` | List all products | No | Query: `skip` (default: 0), `limit` (default: 100) | `ProductRead[]` |
| POST | `/products` | Create new product | Yes | `ProductCreate` | `ProductRead` |
| GET | `/products/{product_id}` | Get product by ID | No | - | `ProductRead` |
| PATCH | `/products/{product_id}` | Update product | Yes | `ProductUpdate` | `ProductRead` |
| DELETE | `/products/{product_id}` | Delete product | Yes | - | 204 No Content |
| GET | `/products/{product_id}/categories` | List product categories | No | - | `CategoryRead[]` |
| POST | `/products/{product_id}/categories/{category_id}` | Add category to product | Yes | - | `CategoryRead[]` |
| DELETE | `/products/{product_id}/categories/{category_id}` | Remove category from product | Yes | - | `CategoryRead[]` |
| GET | `/products/{product_id}/inventory` | Get product inventory | Yes | - | `InventoryRead` |
| PATCH | `/products/{product_id}/inventory` | Update product inventory | Yes | `InventoryUpdate` | `InventoryRead` |

## Categories

| Method | Endpoint | Description | Auth Required | Request Body | Response |
|--------|----------|-------------|---------------|--------------|----------|
| GET | `/categories` | List all categories | No | Query: `skip` (default: 0), `limit` (default: 100) | `CategoryRead[]` |
| POST | `/categories` | Create new category | Yes | `CategoryCreate` | `CategoryRead` |
| GET | `/categories/{category_id}` | Get category by ID | No | - | `CategoryRead` |
| PATCH | `/categories/{category_id}` | Update category | Yes | `CategoryUpdate` | `CategoryRead` |
| DELETE | `/categories/{category_id}` | Delete category | Yes | - | 204 No Content |

## Orders

| Method | Endpoint | Description | Auth Required | Request Body | Response |
|--------|----------|-------------|---------------|--------------|----------|
| GET | `/orders` | List all orders | No | Query: `skip` (default: 0), `limit` (default: 100) | `OrderRead[]` |
| POST | `/orders` | Create new order | No | `OrderCreate` | `OrderRead` |
| GET | `/orders/{order_id}` | Get order by ID | No | - | `OrderRead` |
| PATCH | `/orders/{order_id}/cancel` | Cancel an order | No | - | `OrderRead` |

## Payments

| Method | Endpoint | Description | Auth Required | Request Body | Response |
|--------|----------|-------------|---------------|--------------|----------|
| POST | `/orders/{order_id}/payments` | Create payment for order | No | `PaymentCreate` | `PaymentRead` |
| PATCH | `/orders/{order_id}/payments/{payment_id}/confirm` | Confirm payment | No | `PaymentConfirm` | `PaymentRead` |
| POST | `/orders/{order_id}/payments/payments/webhook` | Payment webhook | No | `PaymentWebhook` | Object |

## Admin Authentication

| Method | Endpoint | Description | Auth Required | Request Body | Response |
|--------|----------|-------------|---------------|--------------|----------|
| POST | `/admin/login` | Admin login | No | `AdminLogin` | `Token` |
| POST | `/admin/refresh` | Refresh access token | No | `{refresh_token: string}` | `Token` |
| POST | `/admin/forgot-password` | Request password reset | No | `ForgotPasswordRequest` | Object |
| POST | `/admin/reset-password` | Reset password with token | No | `ResetPasswordRequest` | Object |

---

## Schema Definitions

### ProductCreate
```json
{
  "name": "string",
  "price": "number | string (decimal)",
  "description": "string | null"
}
```

### ProductRead
```json
{
  "id": "integer",
  "name": "string",
  "price": "string (decimal)",
  "description": "string | null"
}
```

### ProductUpdate
```json
{
  "name": "string | null",
  "price": "number | string (decimal) | null",
  "description": "string | null"
}
```

### CategoryCreate
```json
{
  "name": "string"
}
```

### CategoryRead
```json
{
  "id": "integer",
  "name": "string"
}
```

### CategoryUpdate
```json
{
  "name": "string | null"
}
```

### InventoryRead
```json
{
  "product_id": "integer",
  "quantity": "integer"
}
```

### InventoryUpdate
```json
{
  "quantity": "integer" // minimum: 0
}
```

### OrderCreate
```json
{
  "address": {
    "full_name": "string",
    "phone": "string",
    "district": "string",
    "subdistrict": "string",
    "address_line": "string",
    "additional_info": "string | null"
  },
  "items": [
    {
      "product_id": "integer",
      "quantity": "integer" // must be > 0
    }
  ]
}
```

### OrderRead
```json
{
  "id": "integer",
  "status": "string",
  "created_at": "datetime (ISO 8601)",
  "address": {
    "id": "integer",
    "full_name": "string",
    "phone": "string",
    "district": "string",
    "subdistrict": "string",
    "address_line": "string",
    "additional_info": "string | null"
  },
  "items": [
    {
      "product_id": "integer",
      "quantity": "integer",
      "price_at_purchase": "number"
    }
  ]
}
```

### PaymentCreate
```json
{
  "payment_method": "string"
}
```

### PaymentRead
```json
{
  "id": "integer",
  "order_id": "integer",
  "status": "string",
  "payment_method": "string",
  "transaction_id": "string | null"
}
```

### PaymentConfirm
```json
{
  "transaction_id": "string"
}
```

### AdminLogin
```json
{
  "email": "string (email format)",
  "password": "string"
}
```

### Token
```json
{
  "access_token": "string",
  "refresh_token": "string | null",
  "token_type": "string" // default: "bearer"
}
```

### ForgotPasswordRequest
```json
{
  "email": "string (email format)"
}
```

### ResetPasswordRequest
```json
{
  "token": "string",
  "new_password": "string"
}
```

---

## Authentication

Endpoints marked with **Auth Required: Yes** require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

The token can be obtained from the `/admin/login` endpoint.

---

## Notes

1. **Product IDs and Category IDs** are integers, not strings
2. **PATCH** method is used for partial updates (not PUT)
3. **Price** is returned as a decimal string in ProductRead
4. **Query parameters** for list endpoints: `skip` (offset) and `limit` (max items)
5. **Order status** and **Payment status** are string enums (refer to backend docs for valid values)
6. **Inventory** is a separate resource linked to products
