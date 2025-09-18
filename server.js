require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;
let productsCollection;
let categoriesCollection;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    // Connect to the database and collections
    db = client.db('smFurnishing');
    productsCollection = db.collection('products');
    categoriesCollection = db.collection('categories');
    
    // Verify connection by counting documents
    const count = await productsCollection.countDocuments();
    console.log(`📦 Found ${count} products in the database`);
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// GET /api/products - Fetch all products
app.get('/api/products', async (req, res) => {
  try {
    // Fetch all products from the collection
    const products = await productsCollection.find({}).toArray();
    
    // Send successful response
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// POST /api/products - Add a new product
app.post('/api/products', async (req, res) => {
  try {
    const { categoryId, name, description, price, stock } = req.body;
    
    // Validation
    if (!name || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and price are required fields'
      });
    }
    
    // Validate price is a positive number
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number'
      });
    }
    
    // Validate stock if provided
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Stock must be a non-negative number'
      });
    }
    
    // If categoryId is provided, validate it exists (optional)
    if (categoryId) {
      try {
        const categoryExists = await categoriesCollection.findOne({ 
          _id: new ObjectId(categoryId) 
        });
        
        if (!categoryExists) {
          return res.status(400).json({
            success: false,
            message: 'Invalid category ID'
          });
        }
      } catch (error) {
        // If categoryId is not a valid ObjectId format
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID format'
        });
      }
    }
    
    // Create new product object
    const newProduct = {
      categoryId: categoryId || null,
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      stock: stock !== undefined ? Number(stock) : 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the product into database
    const result = await productsCollection.insertOne(newProduct);
    
    // Get the inserted product
    const insertedProduct = await productsCollection.findOne({ 
      _id: result.insertedId 
    });
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: insertedProduct
    });
    
    console.log(`✅ New product added: ${name}`);
    
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// GET /api/products/:id - Get single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    const product = await productsCollection.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: product
    });
    
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    const result = await productsCollection.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
    
    console.log(`🗑️ Product deleted: ${id}`);
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// GET /api/categories - Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await categoriesCollection.find({}).toArray();
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    message: 'Server is running',
    database: db ? 'Connected' : 'Disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SM Furnishing Products API',
    endpoints: {
      'GET /api/products': 'Get all products',
      'POST /api/products': 'Create new product',
      'GET /api/products/:id': 'Get single product',
      'DELETE /api/products/:id': 'Delete product',
      'GET /api/categories': 'Get all categories',
      'GET /health': 'Health check'
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectToMongoDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📍 Products endpoint: http://localhost:${PORT}/api/products`);
    console.log(`➕ Add product: POST http://localhost:${PORT}/api/products`);
  });
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Closing MongoDB connection...');
  await client.close();
  console.log('👋 Server shutdown complete');
  process.exit(0);
});