# SM Furnishing Products API

## Project Overview
This is a Node.js Express API backend for managing products and categories. It connects to MongoDB for data storage and provides REST endpoints for product operations.

## Setup Status
- ✅ Dependencies installed (Express, MongoDB, CORS, Nodemon)
- ✅ Server configured for Replit environment (0.0.0.0:5000)
- ✅ Workflow configured for development server
- ✅ MongoDB connection established (6 products found)
- ✅ API endpoints tested and working
- ✅ Deployment configured for VM target

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

### System
- `GET /` - API information and available endpoints
- `GET /health` - Health check and database status

## Required Environment Variables
- `MONGODB_URI` - MongoDB connection string (needed to start server)
- `JWT_SECRET` - JWT secret key for token generation (optional, has fallback)

## Database Schema
- Database: `smFurnishing`
- Collections: `products`, `categories`, `users`, `otps`

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

## Recent Changes
- 2025-09-19: Implemented email OTP verification system with send-otp and verify-otp endpoints
- 2025-09-19: Added Replit Mail integration for sending OTP emails with HTML formatting
- 2025-09-19: Created OTPs collection with TTL index for automatic expiration
- 2025-09-19: Implemented JWT authentication system with signup and login endpoints
- 2025-09-19: Added users collection with schema validation and unique email index
- 2025-09-19: Added bcryptjs for password hashing and jsonwebtoken for JWT generation
- 2025-09-19: Updated API documentation to include authentication endpoints
- 2025-09-18: Configured server to bind to 0.0.0.0:5000 for Replit environment  
- 2025-09-18: Set up development workflow with nodemon