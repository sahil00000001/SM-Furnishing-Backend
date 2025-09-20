require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('./utils/replitmail');

const app = express();

// JWT Secret configuration
const JWT_SECRET = process.env.JWT_SECRET || 'sm-furnishing-jwt-secret-2024';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;
let productsCollection;
let categoriesCollection;
let usersCollection;
let otpCollection;
let latestproductsCollection;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    // Connect to the database and collections
    db = client.db('smFurnishing');
    productsCollection = db.collection('products');
    categoriesCollection = db.collection('categories');
    usersCollection = db.collection('users');
    otpCollection = db.collection('otps');
    latestproductsCollection = db.collection('latestproducts');
    
    // Create users collection with schema validation
    try {
      await db.createCollection("users", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["name", "email", "password"],
            properties: {
              name: {
                bsonType: "string",
                description: "must be a string and is required"
              },
              email: {
                bsonType: "string",
                pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                description: "must be a valid email and is required"
              },
              password: {
                bsonType: "string",
                minLength: 6,
                description: "must be a string of at least 6 characters and is required"
              }
            }
          }
        }
      });
      console.log('✅ Users collection created with validation');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️ Users collection already exists');
      } else {
        console.log('⚠️ Error creating users collection:', error.message);
      }
    }
    
    // Create unique index for email
    try {
      await usersCollection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Unique index created for user emails');
    } catch (error) {
      console.log('ℹ️ Email index already exists');
    }
    
    // Create OTP collection with TTL index (expires after 10 minutes)
    try {
      await otpCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });
      console.log('✅ OTP collection configured with TTL index');
    } catch (error) {
      console.log('ℹ️ OTP TTL index already exists');
    }
    
    // Verify connection by counting documents
    const count = await productsCollection.countDocuments();
    const userCount = await usersCollection.countDocuments();
    const otpCount = await otpCollection.countDocuments();
    console.log(`📦 Found ${count} products in the database`);
    console.log(`👥 Found ${userCount} users in the database`);
    console.log(`📧 Found ${otpCount} active OTPs in the database`);
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// POST /api/signup - User registration
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields'
      });
    }
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }
    
    // Check if email already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Encrypt password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create new user object
    const newUser = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save user to database
    const result = await usersCollection.insertOne(newUser);
    
    // Get the inserted user (without password)
    const insertedUser = await usersCollection.findOne(
      { _id: result.insertedId },
      { projection: { password: 0 } }
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: insertedUser._id,
        email: insertedUser.email,
        name: insertedUser.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token: token,
      user: insertedUser
    });
    
    console.log(`✅ New user registered: ${email}`);
    
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
});

// POST /api/login - User authentication
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Remove password from user object
    const userWithoutPassword = {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Send success response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token,
      user: userWithoutPassword
    });
    
    console.log(`✅ User logged in: ${email}`);
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
});

// POST /api/send-otp - Send OTP to email
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Delete any existing OTPs for this email
    await otpCollection.deleteMany({ email: email.toLowerCase() });
    
    // Store OTP in database
    const otpRecord = {
      email: email.toLowerCase(),
      otp: otp,
      createdAt: new Date(),
      verified: false
    };
    
    await otpCollection.insertOne(otpRecord);
    
    // Send OTP email
    const emailResult = await sendEmail({
      to: email,
      subject: 'SM Furnishing - Email Verification Code',
      text: `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Email Verification</h2>
          <p>Your verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; background: #f0f0f0; padding: 15px 30px; border-radius: 5px; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="color: #666;">This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });
    
    console.log(`📧 OTP sent to ${email}: ${otp}`);
    
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
      email: email
    });
    
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
});

// POST /api/verify-otp - Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }
    
    // Find OTP record
    const otpRecord = await otpCollection.findOne({
      email: email.toLowerCase(),
      otp: otp.toString(),
      verified: false
    });
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }
    
    // Check if OTP is expired (10 minutes)
    const now = new Date();
    const otpAge = (now - otpRecord.createdAt) / 1000 / 60; // minutes
    
    if (otpAge > 10) {
      // Clean up expired OTP
      await otpCollection.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }
    
    // Mark OTP as verified
    await otpCollection.updateOne(
      { _id: otpRecord._id },
      { $set: { verified: true, verifiedAt: new Date() } }
    );
    
    console.log(`✅ OTP verified for ${email}`);
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      email: email,
      verifiedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message
    });
  }
});

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
    const { categoryId, name, description, price, stock, status, imageUrl } = req.body;
    
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
      status: status || "Active",
      imageUrl: imageUrl || "",
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

// GET /api/latestproducts - Fetch all latest products
app.get('/api/latestproducts', async (req, res) => {
  try {
    // Fetch all latest products from the collection
    const latestproducts = await latestproductsCollection.find({}).toArray();
    
    // Send successful response
    res.status(200).json({
      success: true,
      count: latestproducts.length,
      data: latestproducts
    });
    
  } catch (error) {
    console.error('Error fetching latest products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest products',
      error: error.message
    });
  }
});

// GET /api/latestproducts/:id - Get single latest product by ID
app.get('/api/latestproducts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latest product ID format'
      });
    }
    
    const latestproduct = await latestproductsCollection.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!latestproduct) {
      return res.status(404).json({
        success: false,
        message: 'Latest product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: latestproduct
    });
    
  } catch (error) {
    console.error('Error fetching latest product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest product',
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

// POST /api/categories - Add a new category
app.post('/api/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required field'
      });
    }
    
    // Check if category name already exists
    const existingCategory = await categoriesCollection.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    
    // Create new category object
    const newCategory = {
      name: name.trim(),
      description: description ? description.trim() : "",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the category into database
    const result = await categoriesCollection.insertOne(newCategory);
    
    // Get the inserted category
    const insertedCategory = await categoriesCollection.findOne({ 
      _id: result.insertedId 
    });
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: insertedCategory
    });
    
    console.log(`✅ New category added: ${name}`);
    
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
});

// GET /api/categories/:id - Get single category by ID
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }
    
    const category = await categoriesCollection.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: category
    });
    
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
});

// DELETE /api/categories/:id - Delete a category
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }
    
    // Check if there are products using this category
    const productsWithCategory = await productsCollection.countDocuments({ 
      categoryId: id 
    });
    
    if (productsWithCategory > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. ${productsWithCategory} product(s) are using this category`
      });
    }
    
    const result = await categoriesCollection.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
    
    console.log(`🗑️ Category deleted: ${id}`);
    
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
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
      'POST /api/signup': 'User registration (name, email, password)',
      'POST /api/login': 'User authentication (email, password)',
      'POST /api/send-otp': 'Send OTP to email for verification (email)',
      'POST /api/verify-otp': 'Verify OTP code (email, otp)',
      'GET /api/products': 'Get all products',
      'POST /api/products': 'Create new product',
      'GET /api/products/:id': 'Get single product',
      'DELETE /api/products/:id': 'Delete product',
      'GET /api/categories': 'Get all categories',
      'POST /api/categories': 'Create new category',
      'GET /api/categories/:id': 'Get single category',
      'DELETE /api/categories/:id': 'Delete category',
      'GET /health': 'Health check'
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectToMongoDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
    console.log(`📍 Products endpoint: http://0.0.0.0:${PORT}/api/products`);
    console.log(`➕ Add product: POST http://0.0.0.0:${PORT}/api/products`);
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