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

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      error: 'Authentication required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token.',
        error: 'Authentication failed'
      });
    }
    req.user = decoded;
    next();
  });
};

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;
let productsCollection;
let categoriesCollection;
let usersCollection;
let otpCollection;
let latestproductsCollection;
let formDataCollection;
let newsletterEmailsCollection;
let cartCollection;
let newOrdersCollection;

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
    formDataCollection = db.collection('form-data');
    newsletterEmailsCollection = db.collection('newsletter-emails');
    cartCollection = db.collection('cart');
    newOrdersCollection = db.collection('new_orders');
    
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
    
    // Create form-data collection with schema validation
    try {
      await db.createCollection("form-data", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["name", "email", "phoneNumber", "orderDescription"],
            properties: {
              name: {
                bsonType: "string",
                minLength: 2,
                maxLength: 100,
                description: "Name must be a string between 2 and 100 characters and is required"
              },
              email: {
                bsonType: "string",
                pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                description: "Must be a valid email address and is required"
              },
              phoneNumber: {
                bsonType: "string",
                pattern: "^\\+[1-9]\\d{0,3}[-\\.\\s]?\\(?\\d{1,4}\\)?[-\\.\\s]?\\d{1,4}[-\\.\\s]?\\d{1,9}$",
                description: "Must be a valid international phone number with country code and is required"
              },
              orderDescription: {
                bsonType: "string",
                minLength: 10,
                maxLength: 10000,
                description: "Order description must be between 10 and 10000 characters and is required"
              },
              submittedAt: {
                bsonType: "date",
                description: "Submission timestamp"
              },
              status: {
                bsonType: "string",
                enum: ["new", "contacted", "in-progress", "completed"],
                description: "Status must be one of the allowed values"
              },
              createdAt: {
                bsonType: "date",
                description: "Creation timestamp"
              },
              updatedAt: {
                bsonType: "date",
                description: "Last update timestamp"
              }
            }
          }
        }
      });
      console.log('✅ Form-data collection created with validation');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️ Form-data collection already exists');
      } else {
        console.log('⚠️ Error creating form-data collection:', error.message);
      }
    }
    
    // Create indexes for form-data collection
    try {
      await formDataCollection.createIndex({ email: 1, submittedAt: -1 });
      await formDataCollection.createIndex({ status: 1 });
      await formDataCollection.createIndex({ submittedAt: -1 });
      console.log('✅ Form-data indexes created');
    } catch (error) {
      console.log('ℹ️ Form-data indexes already exist');
    }
    
    // Create newsletter-emails collection with schema validation
    try {
      await db.createCollection("newsletter-emails", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["email"],
            properties: {
              email: {
                bsonType: "string",
                pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                description: "Must be a valid email address and is required"
              },
              subscribedAt: {
                bsonType: "date",
                description: "Subscription timestamp"
              },
              isActive: {
                bsonType: "bool",
                description: "Subscription status"
              },
              source: {
                bsonType: "string",
                enum: ["website", "mobile", "admin", "import", "campaign"],
                description: "Source of subscription"
              },
              createdAt: {
                bsonType: "date",
                description: "Creation timestamp"
              },
              updatedAt: {
                bsonType: "date",
                description: "Last update timestamp"
              }
            }
          }
        }
      });
      console.log('✅ Newsletter-emails collection created with validation');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️ Newsletter-emails collection already exists');
      } else {
        console.log('⚠️ Error creating newsletter-emails collection:', error.message);
      }
    }
    
    // Create indexes for newsletter-emails collection
    try {
      await newsletterEmailsCollection.createIndex({ email: 1 }, { unique: true });
      await newsletterEmailsCollection.createIndex({ subscribedAt: -1 });
      await newsletterEmailsCollection.createIndex({ isActive: 1 });
      console.log('✅ Newsletter-emails indexes created');
    } catch (error) {
      console.log('ℹ️ Newsletter-emails indexes already exist');
    }
    
    // Create cart collection with schema validation
    try {
      await db.createCollection("cart", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["userId", "items", "totalAmount", "totalItems", "status"],
            properties: {
              userId: {
                bsonType: "objectId",
                description: "must be an ObjectId and is required"
              },
              items: {
                bsonType: "array",
                description: "must be an array of cart items",
                items: {
                  bsonType: "object",
                  required: ["productId", "productName", "productImage", "quantity", "priceAtTime", "addedAt"],
                  properties: {
                    productId: {
                      bsonType: "objectId",
                      description: "must be an ObjectId and is required"
                    },
                    productName: {
                      bsonType: "string",
                      description: "must be a string and is required"
                    },
                    productImage: {
                      bsonType: "string",
                      description: "must be a string and is required"
                    },
                    quantity: {
                      bsonType: "int",
                      minimum: 1,
                      description: "must be an integer >= 1 and is required"
                    },
                    priceAtTime: {
                      bsonType: "number",
                      minimum: 0,
                      description: "must be a number >= 0 and is required"
                    },
                    addedAt: {
                      bsonType: "date",
                      description: "must be a date and is required"
                    }
                  }
                }
              },
              totalAmount: {
                bsonType: "number",
                minimum: 0,
                description: "must be a number >= 0 and is required"
              },
              totalItems: {
                bsonType: "int",
                minimum: 0,
                description: "must be an integer >= 0 and is required"
              },
              createdAt: {
                bsonType: "date",
                description: "must be a date"
              },
              updatedAt: {
                bsonType: "date",
                description: "must be a date"
              },
              status: {
                bsonType: "string",
                enum: ["active", "abandoned", "converted"],
                description: "must be one of: active, abandoned, converted and is required"
              }
            }
          }
        }
      });
      console.log('✅ Cart collection created with validation');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️ Cart collection already exists');
      } else {
        console.log('⚠️ Error creating cart collection:', error.message);
      }
    }
    
    // Create indexes for cart collection
    try {
      await cartCollection.createIndex({ userId: 1 }, { unique: true });
      await cartCollection.createIndex({ "items.productId": 1 });
      await cartCollection.createIndex({ status: 1 });
      await cartCollection.createIndex({ updatedAt: -1 });
      console.log('✅ Cart collection indexes created');
    } catch (error) {
      console.log('ℹ️ Cart collection indexes already exist');
    }
    
    // Create new_orders collection with schema validation
    try {
      await db.createCollection("new_orders", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["order_id", "order_date", "status", "user", "items", "customer", "pricing", "payment"],
            properties: {
              order_id: {
                bsonType: "string",
                description: "Unique order identifier - required"
              },
              order_date: {
                bsonType: "date",
                description: "Order creation date - required"
              },
              status: {
                bsonType: "string",
                enum: ["pending", "processing", "shipped", "completed", "cancelled", "refunded"],
                description: "Order status - required"
              },
              user: {
                bsonType: "object",
                required: ["username", "user_email"],
                properties: {
                  user_id: {
                    bsonType: ["objectId", "null"],
                    description: "Reference to User collection - optional"
                  },
                  username: {
                    bsonType: "string",
                    description: "Username - required"
                  },
                  user_email: {
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                    description: "User email - required"
                  }
                }
              },
              items: {
                bsonType: "array",
                minItems: 1,
                items: {
                  bsonType: "object",
                  required: ["product_id", "product_name", "quantity", "price"],
                  properties: {
                    product_id: {
                      bsonType: "string",
                      description: "Product ID - required"
                    },
                    product_name: {
                      bsonType: "string",
                      description: "Product name - required"
                    },
                    quantity: {
                      bsonType: "int",
                      minimum: 1,
                      description: "Quantity - minimum 1"
                    },
                    price: {
                      bsonType: "number",
                      minimum: 0,
                      description: "Price at time of order"
                    }
                  }
                }
              },
              customer: {
                bsonType: "object",
                required: ["name", "email", "phone", "address", "city", "state", "pin_code", "country"],
                properties: {
                  name: {
                    bsonType: "string"
                  },
                  email: {
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                  },
                  phone: {
                    bsonType: "string"
                  },
                  address: {
                    bsonType: "string"
                  },
                  city: {
                    bsonType: "string"
                  },
                  state: {
                    bsonType: "string"
                  },
                  pin_code: {
                    bsonType: "string"
                  },
                  country: {
                    bsonType: "string"
                  }
                }
              },
              pricing: {
                bsonType: "object",
                required: ["subtotal", "tax", "shipping", "total"],
                properties: {
                  subtotal: {
                    bsonType: "number",
                    minimum: 0
                  },
                  tax: {
                    bsonType: "number",
                    minimum: 0
                  },
                  shipping: {
                    bsonType: "number",
                    minimum: 0
                  },
                  discount: {
                    bsonType: ["number", "null"],
                    minimum: 0
                  },
                  total: {
                    bsonType: "number",
                    minimum: 0
                  }
                }
              },
              payment: {
                bsonType: "object",
                required: ["method", "status"],
                properties: {
                  method: {
                    bsonType: "string",
                    enum: ["razorpay", "stripe", "paypal", "cod", "bank_transfer"]
                  },
                  status: {
                    bsonType: "string",
                    enum: ["pending", "processing", "verified", "failed", "refunded"]
                  },
                  razorpay_order_id: {
                    bsonType: ["string", "null"]
                  },
                  razorpay_payment_id: {
                    bsonType: ["string", "null"]
                  },
                  razorpay_signature: {
                    bsonType: ["string", "null"]
                  },
                  transaction_id: {
                    bsonType: ["string", "null"]
                  },
                  payment_date: {
                    bsonType: ["date", "null"]
                  }
                }
              },
              shipping: {
                bsonType: ["object", "null"],
                properties: {
                  carrier: {
                    bsonType: ["string", "null"]
                  },
                  tracking_number: {
                    bsonType: ["string", "null"]
                  },
                  shipped_date: {
                    bsonType: ["date", "null"]
                  },
                  delivered_date: {
                    bsonType: ["date", "null"]
                  }
                }
              },
              notes: {
                bsonType: ["string", "null"]
              },
              invoice_number: {
                bsonType: ["string", "null"]
              },
              is_deleted: {
                bsonType: ["bool", "null"]
              },
              createdAt: {
                bsonType: ["date", "null"]
              },
              updatedAt: {
                bsonType: ["date", "null"]
              }
            }
          }
        }
      });
      console.log('✅ New_orders collection created with validation');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️ New_orders collection already exists');
      } else {
        console.log('⚠️ Error creating new_orders collection:', error.message);
      }
    }
    
    // Create indexes for new_orders collection
    try {
      await newOrdersCollection.createIndex({ "order_id": 1 }, { unique: true });
      await newOrdersCollection.createIndex({ "order_date": -1 });
      await newOrdersCollection.createIndex({ "status": 1 });
      await newOrdersCollection.createIndex({ "user.user_email": 1 });
      await newOrdersCollection.createIndex({ "customer.email": 1 });
      await newOrdersCollection.createIndex({ "payment.status": 1 });
      await newOrdersCollection.createIndex({ "status": 1, "order_date": -1 });
      await newOrdersCollection.createIndex({ "payment.status": 1, "order_date": -1 });
      await newOrdersCollection.createIndex({ "payment.razorpay_order_id": 1 }, { sparse: true });
      await newOrdersCollection.createIndex({ "payment.razorpay_payment_id": 1 }, { sparse: true });
      await newOrdersCollection.createIndex({ "invoice_number": 1 }, { sparse: true });
      console.log('✅ New_orders collection indexes created');
    } catch (error) {
      console.log('ℹ️ New_orders collection indexes already exist');
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

// POST /api/form-data - Store form submission
app.post('/api/form-data', async (req, res) => {
  try {
    const { name, email, phoneNumber, orderDescription } = req.body;
    
    // Validation
    if (!name || !email || !phoneNumber || !orderDescription) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, and order description are required fields'
      });
    }
    
    // Validate name length
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 100 characters'
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
    
    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{0,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid international phone number with country code (e.g., +91-9876543210)'
      });
    }
    
    // Validate order description length
    if (orderDescription.length < 10 || orderDescription.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Order description must be between 10 and 10000 characters'
      });
    }
    
    // Create new form submission object
    const newFormData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      orderDescription: orderDescription.trim(),
      submittedAt: new Date(),
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the form data into database
    const result = await formDataCollection.insertOne(newFormData);
    
    // Get the inserted form data
    const insertedFormData = await formDataCollection.findOne({ 
      _id: result.insertedId 
    });
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Form data submitted successfully',
      data: insertedFormData
    });
    
    console.log(`✅ New form submission from: ${email}`);
    
  } catch (error) {
    console.error('Error storing form data:', error);
    res.status(500).json({
      success: false,
      message: 'Error storing form data',
      error: error.message
    });
  }
});

// POST /api/newsletter-emails - Store email subscription
app.post('/api/newsletter-emails', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
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
    
    // Check if email already exists
    const existingEmail = await newsletterEmailsCollection.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already subscribed to our newsletter'
      });
    }
    
    // Create new email subscription object
    const newEmailSubscription = {
      email: email.toLowerCase().trim(),
      subscribedAt: new Date(),
      isActive: true,
      source: "website",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the email subscription into database
    const result = await newsletterEmailsCollection.insertOne(newEmailSubscription);
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Email address has been added successfully'
    });
    
    console.log(`✅ New newsletter subscription: ${email}`);
    
  } catch (error) {
    console.error('Error storing newsletter email:', error);
    
    // Handle duplicate email error from unique index
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already subscribed to our newsletter'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error storing email address',
      error: error.message
    });
  }
});

// ===========================================
// CART API ENDPOINTS
// ===========================================

// GET /api/cart - Get user's cart
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    
    // Find user's cart
    let cart = await cartCollection.findOne({ userId, status: 'active' });
    
    // If no cart exists, create an empty one
    if (!cart) {
      cart = {
        userId,
        items: [],
        totalAmount: 0,
        totalItems: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await cartCollection.insertOne(cart);
      cart._id = result.insertedId;
    }
    
    res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      cart: cart
    });
    
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving cart',
      error: error.message
    });
  }
});

// POST /api/cart/add - Add item to cart
app.post('/api/cart/add', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = new ObjectId(req.user.userId);
    
    // Validation
    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required',
        error: 'Missing required fields'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
        error: 'Invalid quantity'
      });
    }
    
    // Check if product exists
    const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Product does not exist'
      });
    }
    
    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`,
        error: 'Insufficient stock'
      });
    }
    
    // Find or create cart
    let cart = await cartCollection.findOne({ userId, status: 'active' });
    
    if (!cart) {
      // Create new cart
      cart = {
        userId,
        items: [],
        totalAmount: 0,
        totalItems: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId
    );
    
    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      // Check total stock for updated quantity
      if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} items. Only ${product.stock - cart.items[existingItemIndex].quantity} more available`,
          error: 'Insufficient stock for total quantity'
        });
      }
      
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].addedAt = new Date();
    } else {
      // Add new item to cart
      const cartItem = {
        productId: new ObjectId(productId),
        productName: product.name,
        productImage: product.imageUrl || '',
        quantity: quantity,
        priceAtTime: product.price,
        addedAt: new Date()
      };
      cart.items.push(cartItem);
    }
    
    // Recalculate totals
    cart.totalAmount = cart.items.reduce((total, item) => 
      total + (item.priceAtTime * item.quantity), 0
    );
    cart.totalItems = cart.items.reduce((total, item) => 
      total + item.quantity, 0
    );
    cart.updatedAt = new Date();
    
    // Save cart
    if (cart._id) {
      await cartCollection.replaceOne({ _id: cart._id }, cart);
    } else {
      const result = await cartCollection.insertOne(cart);
      cart._id = result.insertedId;
    }
    
    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      cart: cart
    });
    
    console.log(`✅ Item added to cart - User: ${req.user.email}, Product: ${product.name}`);
    
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart',
      error: error.message
    });
  }
});

// PUT /api/cart/update - Update item quantity
app.put('/api/cart/update', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = new ObjectId(req.user.userId);
    
    // Validation
    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required',
        error: 'Missing required fields'
      });
    }
    
    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative',
        error: 'Invalid quantity'
      });
    }
    
    // Find cart
    const cart = await cartCollection.findOne({ userId, status: 'active' });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
        error: 'No active cart exists'
      });
    }
    
    // Find item in cart
    const itemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
        error: 'Product not in cart'
      });
    }
    
    // Check stock if quantity > 0
    if (quantity > 0) {
      const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
          error: 'Product does not exist'
        });
      }
      
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`,
          error: 'Insufficient stock'
        });
      }
    }
    
    // Update quantity or remove item
    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].addedAt = new Date();
    }
    
    // Recalculate totals
    cart.totalAmount = cart.items.reduce((total, item) => 
      total + (item.priceAtTime * item.quantity), 0
    );
    cart.totalItems = cart.items.reduce((total, item) => 
      total + item.quantity, 0
    );
    cart.updatedAt = new Date();
    
    // Save cart
    await cartCollection.replaceOne({ _id: cart._id }, cart);
    
    res.status(200).json({
      success: true,
      message: quantity === 0 ? 'Item removed from cart' : 'Cart updated successfully',
      cart: cart
    });
    
    console.log(`✅ Cart updated - User: ${req.user.email}, Product: ${productId}, Quantity: ${quantity}`);
    
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart',
      error: error.message
    });
  }
});

// DELETE /api/cart/item/:productId - Remove single item
app.delete('/api/cart/item/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = new ObjectId(req.user.userId);
    
    // Validation
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
        error: 'Invalid ObjectId'
      });
    }
    
    // Find cart
    const cart = await cartCollection.findOne({ userId, status: 'active' });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
        error: 'No active cart exists'
      });
    }
    
    // Find item in cart
    const itemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
        error: 'Product not in cart'
      });
    }
    
    // Remove item
    const removedItem = cart.items[itemIndex];
    cart.items.splice(itemIndex, 1);
    
    // Recalculate totals
    cart.totalAmount = cart.items.reduce((total, item) => 
      total + (item.priceAtTime * item.quantity), 0
    );
    cart.totalItems = cart.items.reduce((total, item) => 
      total + item.quantity, 0
    );
    cart.updatedAt = new Date();
    
    // Save cart
    await cartCollection.replaceOne({ _id: cart._id }, cart);
    
    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      cart: cart
    });
    
    console.log(`✅ Item removed from cart - User: ${req.user.email}, Product: ${removedItem.productName}`);
    
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart',
      error: error.message
    });
  }
});

// DELETE /api/cart/clear - Clear entire cart
app.delete('/api/cart/clear', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    
    // Find cart
    const cart = await cartCollection.findOne({ userId, status: 'active' });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
        error: 'No active cart exists'
      });
    }
    
    // Clear cart
    cart.items = [];
    cart.totalAmount = 0;
    cart.totalItems = 0;
    cart.updatedAt = new Date();
    
    // Save cart
    await cartCollection.replaceOne({ _id: cart._id }, cart);
    
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart: cart
    });
    
    console.log(`✅ Cart cleared - User: ${req.user.email}`);
    
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
});

// POST /api/orders - Save order data
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    
    // Basic validation - required fields
    const requiredFields = ['order_id', 'order_date', 'status', 'user', 'items', 'customer', 'pricing', 'payment'];
    const missingFields = requiredFields.filter(field => !orderData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Validate user object
    if (!orderData.user.username || !orderData.user.user_email) {
      return res.status(400).json({
        success: false,
        message: 'User username and user_email are required'
      });
    }
    
    // Validate items array
    if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }
    
    // Validate customer object
    const customerRequiredFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'pin_code', 'country'];
    const missingCustomerFields = customerRequiredFields.filter(field => !orderData.customer[field]);
    
    if (missingCustomerFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing customer fields: ${missingCustomerFields.join(', ')}`
      });
    }
    
    // Validate payment object
    if (!orderData.payment.method || !orderData.payment.status) {
      return res.status(400).json({
        success: false,
        message: 'Payment method and status are required'
      });
    }
    
    // Check if order_id already exists
    const existingOrder = await newOrdersCollection.findOne({ order_id: orderData.order_id });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Order with this ID already exists'
      });
    }
    
    // Create new order object with proper formatting
    const newOrder = {
      order_id: orderData.order_id,
      order_date: new Date(orderData.order_date),
      status: orderData.status,
      user: {
        user_id: orderData.user.user_id ? new ObjectId(orderData.user.user_id) : null,
        username: orderData.user.username,
        user_email: orderData.user.user_email.toLowerCase()
      },
      items: orderData.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: parseInt(item.quantity),
        price: parseFloat(item.price)
      })),
      customer: {
        name: orderData.customer.name,
        email: orderData.customer.email.toLowerCase(),
        phone: orderData.customer.phone,
        address: orderData.customer.address,
        city: orderData.customer.city,
        state: orderData.customer.state,
        pin_code: orderData.customer.pin_code,
        country: orderData.customer.country
      },
      pricing: {
        subtotal: parseFloat(orderData.pricing.subtotal),
        tax: parseFloat(orderData.pricing.tax),
        shipping: parseFloat(orderData.pricing.shipping),
        discount: orderData.pricing.discount ? parseFloat(orderData.pricing.discount) : null,
        total: parseFloat(orderData.pricing.total)
      },
      payment: {
        method: orderData.payment.method,
        status: orderData.payment.status,
        razorpay_order_id: orderData.payment.razorpay_order_id || null,
        razorpay_payment_id: orderData.payment.razorpay_payment_id || null,
        razorpay_signature: orderData.payment.razorpay_signature || null,
        transaction_id: orderData.payment.transaction_id || null,
        payment_date: orderData.payment.payment_date ? new Date(orderData.payment.payment_date) : null
      },
      shipping: orderData.shipping || null,
      notes: orderData.notes || null,
      invoice_number: orderData.invoice_number || `INV-${orderData.order_id}-${Date.now()}`,
      is_deleted: orderData.is_deleted || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the order into database
    const result = await newOrdersCollection.insertOne(newOrder);
    
    // Get the inserted order
    const insertedOrder = await newOrdersCollection.findOne({ _id: result.insertedId });
    
    // Send success response
    res.status(201).json({
      success: true,
      message: 'Order saved successfully',
      order: insertedOrder
    });
    
    console.log(`✅ New order saved: ${orderData.order_id} for ${orderData.customer.email}`);
    
  } catch (error) {
    console.error('Error saving order:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.order_id) {
        return res.status(400).json({
          success: false,
          message: 'Order with this ID already exists'
        });
      } else if (error.keyPattern && error.keyPattern.invoice_number) {
        return res.status(400).json({
          success: false,
          message: 'Order with this invoice number already exists'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Duplicate data detected',
          error: error.errmsg
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error saving order',
      error: error.message
    });
  }
});

// GET /api/orders/:email - Fetch orders by email
app.get('/api/orders/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Find orders by email - search both user.user_email and customer.email
    const orders = await newOrdersCollection.find({
      $or: [
        { "user.user_email": email },
        { "customer.email": email }
      ],
      is_deleted: { $ne: true }
    })
    .sort({ order_date: -1 }) // Sort by order date, newest first
    .toArray();
    
    // Send response
    res.status(200).json({
      success: true,
      message: orders.length > 0 ? `Found ${orders.length} orders` : 'No orders found for this email',
      count: orders.length,
      email: email,
      orders: orders
    });
    
    console.log(`✅ Orders fetched for email: ${email} - Found ${orders.length} orders`);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
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
      'GET /api/latestproducts': 'Get all latest products',
      'GET /api/latestproducts/:id': 'Get single latest product',
      'GET /api/categories': 'Get all categories',
      'POST /api/categories': 'Create new category',
      'GET /api/categories/:id': 'Get single category',
      'DELETE /api/categories/:id': 'Delete category',
      'POST /api/form-data': 'Store form submission (name, email, phoneNumber, orderDescription)',
      'POST /api/newsletter-emails': 'Store email subscription (email)',
      'GET /api/cart': 'Get user\'s cart (requires JWT token)',
      'POST /api/cart/add': 'Add item to cart (productId, quantity) (requires JWT token)',
      'PUT /api/cart/update': 'Update cart item quantity (productId, quantity) (requires JWT token)',
      'DELETE /api/cart/item/:productId': 'Remove item from cart (requires JWT token)',
      'DELETE /api/cart/clear': 'Clear entire cart (requires JWT token)',
      'POST /api/orders': 'Save order data (order_id, user, items, customer, pricing, payment)',
      'GET /api/orders/:email': 'Fetch all orders by email address',
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