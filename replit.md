# SM Furnishing Products API

## Project Overview
This is a Node.js Express API backend for managing products and categories. It connects to MongoDB for data storage and provides REST endpoints for product operations.

## Setup Status
- ✅ Dependencies installed (Express, MongoDB, CORS, Nodemon)
- ✅ Server configured for Replit environment (0.0.0.0:5000)
- ✅ Workflow configured for development server
- ⏳ MongoDB connection string needed

## API Endpoints
- `GET /` - API information and available endpoints
- `GET /health` - Health check and database status
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get single product by ID
- `DELETE /api/products/:id` - Delete product by ID
- `GET /api/categories` - Get all categories

## Required Environment Variables
- `MONGODB_URI` - MongoDB connection string (needed to start server)

## Database Schema
- Database: `smFurnishing`
- Collections: `products`, `categories`
- Product fields: name, description, price, stock, categoryId, createdAt, updatedAt

## Recent Changes
- 2025-09-18: Configured server to bind to 0.0.0.0:5000 for Replit environment
- 2025-09-18: Set up development workflow with nodemon