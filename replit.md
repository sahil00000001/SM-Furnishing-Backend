# SM Furnishing Products API

## Project Overview
This is a Node.js Express API backend for managing products and categories. It connects to MongoDB for data storage and provides REST endpoints for product operations.

## Setup Status
- ✅ Dependencies installed (Express, MongoDB, CORS, Nodemon)
- ✅ Server configured for Replit environment (0.0.0.0:5000)
- ✅ Workflow configured for development server
- ✅ MongoDB connection established (2 products found)
- ✅ API endpoints tested and working
- ✅ Deployment configured for VM target
- ✅ GitHub import completed and project ready for use

## API Endpoints

### Authentication
- `POST /api/signup` - User registration (name, email, password) - Returns JWT token + user info
- `POST /api/login` - User authentication (email, password) - Returns JWT token + user info
- `POST /api/send-otp` - Send OTP to email for verification (email) - Returns success message
- `POST /api/verify-otp` - Verify OTP code (email, otp) - Returns verification confirmation

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get single product by ID
- `DELETE /api/products/:id` - Delete product by ID

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create new category
- `GET /api/categories/:id` - Get single category by ID
- `DELETE /api/categories/:id` - Delete category by ID

### Cart Management (Requires JWT Authentication)
- `GET /api/cart` - Get user's cart or create empty one if doesn't exist
- `POST /api/cart/add` - Add item to cart (productId, quantity)
- `PUT /api/cart/update` - Update item quantity (productId, quantity)
- `DELETE /api/cart/item/:productId` - Remove single item from cart
- `DELETE /api/cart/clear` - Clear entire cart

### Form Data
- `POST /api/form-data` - Store form submission (name, email, phoneNumber, orderDescription)

### Newsletter
- `POST /api/newsletter-emails` - Store email subscription (email)

### System
- `GET /` - API information and available endpoints
- `GET /health` - Health check and database status

## Required Environment Variables
- `MONGODB_URI` - MongoDB connection string (needed to start server)
- `JWT_SECRET` - JWT secret key for token generation (optional, has fallback)

## Database Schema
- Database: `smFurnishing`
- Collections: `products`, `categories`, `users`, `otps`, `cart`, `form-data`, `newsletter-emails`

### Users Collection
- Required fields: name, email, password
- Email validation with regex pattern
- Password minimum length: 6 characters
- Unique index on email field
- Additional fields: createdAt, updatedAt

### Products Collection
- Product fields: name, description, price, stock, categoryId, createdAt, updatedAt

### Categories Collection  
- Category fields: name, description, createdAt, updatedAt

### OTPs Collection
- OTP fields: email, otp, createdAt, verified, verifiedAt
- TTL index: expires after 10 minutes (600 seconds)
- Email service: Replit Mail integration

### Form-data Collection
- Required fields: name, email, phoneNumber, orderDescription
- Name validation: 2-100 characters
- Email validation: regex pattern
- Phone validation: international format with country code (e.g., +91-9876543210)
- Order description: 10-10000 characters (supports large text)
- Status field: new, contacted, in-progress, completed
- Indexes: email+submittedAt, status, submittedAt
- Additional fields: submittedAt, status, createdAt, updatedAt

### Cart Collection
- Required fields: userId, items, totalAmount, totalItems, status
- userId: ObjectId reference to users collection
- items: Array of cart items with productId, productName, productImage, quantity, priceAtTime, addedAt
- totalAmount: Calculated total price of all items
- totalItems: Calculated total quantity of all items
- status: Enum values - active, abandoned, converted
- Unique index on userId (one cart per user)
- Indexes: userId (unique), items.productId, status, updatedAt
- Additional fields: createdAt, updatedAt

### Newsletter-emails Collection
- Required fields: email
- Email validation with regex pattern
- Unique index on email field to prevent duplicates
- Optional fields: subscribedAt, isActive, source
- Source options: website, mobile, admin, import, campaign
- Indexes: email (unique), subscribedAt, isActive
- Additional fields: createdAt, updatedAt

## Recent Changes
- 2025-09-21: Implemented complete cart management system with 5 API endpoints and JWT authentication
- 2025-09-21: Added cart collection with MongoDB schema validation and proper indexes
- 2025-09-21: Created JWT authentication middleware for secure cart operations
- 2025-09-21: Cart system includes stock validation, price-at-time storage, and automatic total calculations
- 2025-09-21: Added comprehensive API documentation for all cart endpoints
- 2025-09-21: Added form-data and newsletter-emails API endpoints with MongoDB collections
- 2025-09-21: Implemented form submission API with validation for name, email, phone, and large order descriptions
- 2025-09-21: Created newsletter subscription API with duplicate email prevention
- 2025-09-21: Added MongoDB schema validation and performance indexes for new collections
- 2025-09-21: Updated API documentation to include new endpoints
- 2025-09-21: Completed GitHub import setup - all dependencies installed and verified working
- 2025-09-21: Confirmed MongoDB Atlas connection and API endpoints functionality
- 2025-09-21: Verified deployment configuration for VM target deployment
- 2025-09-19: Implemented email OTP verification system with send-otp and verify-otp endpoints
- 2025-09-19: Added Replit Mail integration for sending OTP emails with HTML formatting
- 2025-09-19: Created OTPs collection with TTL index for automatic expiration
- 2025-09-19: Implemented JWT authentication system with signup and login endpoints
- 2025-09-19: Added users collection with schema validation and unique email index
- 2025-09-19: Added bcryptjs for password hashing and jsonwebtoken for JWT generation
- 2025-09-19: Updated API documentation to include authentication endpoints
- 2025-09-18: Configured server to bind to 0.0.0.0:5000 for Replit environment  
- 2025-09-18: Set up development workflow with nodemon