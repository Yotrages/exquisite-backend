const express = require('express');
const dotenv = require('dotenv');
const compression = require('compression');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/products'); 
const cartRoutes = require('./routes/cart');
const paymentRoutes = require('./routes/Payments');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/adminRoutes');
const contact = require('./routes/contact');
const aiRoutes = require('./routes/ai');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');
const recommendationRoutes = require('./routes/recommendations');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const { protect, admin } = require('./middleware/authMiddleware');
const cors = require('cors');
const subscribe = require('./routes/Subscribe')
const bodyParser = require('body-parser')
const passport = require('passport');
const session = require('express-session');
const configurePassport = require('./config/passport');
const { cacheMiddleware, cacheInvalidatorMiddleware } = require('./middleware/cacheMiddleware');
 const chatbotRoutes = require('./routes/chatbot');
const {
  globalLimiter,
  strictLimiter,
  moderateLimiter,
  permissiveLimiter,
  sensitiveLimiter,
  adminLimiter,
  paymentLimiter,
  publicLimiter,
} = require('./middleware/rateLimiters');


dotenv.config();
console.log('JWT Secret:', process.env.JWT_SECRET_TOKEN);
const initializeApp = async () => {
    await connectDB(); 
  };
  
  initializeApp();
  configurePassport()

const app = express();

// Trust proxy - configure based on deployment environment
// This ensures rate limiting works correctly behind load balancers
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

// Compression middleware - compress all responses
app.use(compression());

app.use(express.json());

const allowedOrigins = [
  'http://localhost:5173',
  'https://vite-project-omega-seven.vercel.app',
  'https://exquisitewears.vercel.app'
];

const corsOptions = {
  origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
      } else {
          callback(new Error('Not allowed by CORS'));
      }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: "*",
  credentials: true
};


app.use(cors(corsOptions));

app.use(globalLimiter);

app.use(bodyParser.json())
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));


app.get('/', (req, res) => res.send('API is running...'));


// User routes - apply authentication rate limit to login/register
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/chatbot', chatbotRoutes)

// Product routes - apply permissive limit for read-heavy operations
app.use('/api/products', productRoutes); 

// Payment routes - apply strict payment limiter
app.use('/api/payments', paymentLimiter, paymentRoutes);

// Order routes - apply moderate limiter for writes
app.use('/api/orders', orderRoutes);

// Admin routes - apply admin-specific limiter
app.use('/api/admin', adminLimiter, adminRoutes);

// contact routes
app.use('/api/contact', contact)
app.use('/api/subscribe', subscribe)

// Advanced feature routes - Phase 5 implementations
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);

// Settings routes (user account settings)
app.use('/api/settings', settingsRoutes);

// AI endpoints (protected)
app.use('/api/ai', aiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
