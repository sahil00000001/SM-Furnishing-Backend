# Cart API Documentation

## Overview
This cart system allows authenticated users to manage their shopping cart with full CRUD operations. All cart endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Authentication
Get a JWT token by calling:
- `POST /api/signup` - Register new user
- `POST /api/login` - Login existing user

Use the returned token in all cart requests:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Available Products
- Product ID: `68cd63fefb7a3a513f2f1a8d` - DEMO1 (Price: ₹123, Stock: 2)
- Product ID: `68cdb2db20a6483bbe6e9518` - Hi Akshita (Price: ₹12, Stock: 12)

---

## 1. GET /api/cart - Get User's Cart

**Description:** Retrieve the user's active cart or create an empty one if it doesn't exist.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Example Request:**
```bash
curl -X GET http://localhost:5000/api/cart \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "cart": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "items": [],
    "totalAmount": 0,
    "totalItems": 0,
    "status": "active",
    "createdAt": "2025-09-21T08:30:00.000Z",
    "updatedAt": "2025-09-21T08:30:00.000Z"
  }
}
```

---

## 2. POST /api/cart/add - Add Item to Cart

**Description:** Add a product to the cart or increase quantity if it already exists. Validates product existence and stock availability.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": "68cd63fefb7a3a513f2f1a8d",
  "quantity": 1
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/cart/add \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "68cd63fefb7a3a513f2f1a8d",
    "quantity": 1
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "cart": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "items": [
      {
        "productId": "68cd63fefb7a3a513f2f1a8d",
        "productName": "DEMO1",
        "productImage": "",
        "quantity": 1,
        "priceAtTime": 123,
        "addedAt": "2025-09-21T08:30:00.000Z"
      }
    ],
    "totalAmount": 123,
    "totalItems": 1,
    "status": "active",
    "updatedAt": "2025-09-21T08:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing productId or quantity
- `400` - Quantity must be greater than 0
- `404` - Product not found
- `400` - Insufficient stock

---

## 3. PUT /api/cart/update - Update Item Quantity

**Description:** Update the quantity of an existing cart item. Set quantity to 0 to remove the item.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": "68cd63fefb7a3a513f2f1a8d",
  "quantity": 2
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:5000/api/cart/update \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "68cd63fefb7a3a513f2f1a8d",
    "quantity": 2
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Cart updated successfully",
  "cart": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "items": [
      {
        "productId": "68cd63fefb7a3a513f2f1a8d",
        "productName": "DEMO1",
        "productImage": "",
        "quantity": 2,
        "priceAtTime": 123,
        "addedAt": "2025-09-21T08:30:00.000Z"
      }
    ],
    "totalAmount": 246,
    "totalItems": 2,
    "status": "active",
    "updatedAt": "2025-09-21T08:31:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing productId or quantity
- `400` - Quantity cannot be negative
- `404` - Cart not found
- `404` - Item not found in cart
- `400` - Insufficient stock

---

## 4. DELETE /api/cart/item/:productId - Remove Single Item

**Description:** Remove a specific product from the cart completely.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Example Request:**
```bash
curl -X DELETE http://localhost:5000/api/cart/item/68cd63fefb7a3a513f2f1a8d \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "cart": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "items": [],
    "totalAmount": 0,
    "totalItems": 0,
    "status": "active",
    "updatedAt": "2025-09-21T08:32:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Invalid product ID format
- `404` - Cart not found
- `404` - Item not found in cart

---

## 5. DELETE /api/cart/clear - Clear Entire Cart

**Description:** Remove all items from the user's cart.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Example Request:**
```bash
curl -X DELETE http://localhost:5000/api/cart/clear \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "cart": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "items": [],
    "totalAmount": 0,
    "totalItems": 0,
    "status": "active",
    "updatedAt": "2025-09-21T08:33:00.000Z"
  }
}
```

**Error Responses:**
- `404` - Cart not found

---

## Authentication Errors

All cart endpoints may return:
- `401` - No token provided
- `403` - Invalid or expired token

## Response Format

All responses follow this consistent format:
```json
{
  "success": true/false,
  "message": "Success message",
  "cart": { /* full cart object */ },
  "error": "Error message if any"
}
```

## Base URL
- **Development:** `http://localhost:5000`
- **Production:** Will be provided after deployment

## Notes
- Product prices are stored in the cart when added (not live prices)
- Stock availability is checked on add/update operations
- Cart totals (totalAmount, totalItems) are automatically calculated
- All cart operations are atomic and handle errors properly
- Each user can have only one active cart at a time