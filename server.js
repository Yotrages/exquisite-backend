const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/products'); 
const cartRoutes = require('./routes/cart');
const contact = require('./routes/contact')
const { protect, admin } = require('./middleware/authMiddleware');
const cors = require('cors');
const subscribe = require('./routes/Subscribe')
const bodyParser = require('body-parser')


dotenv.config();
console.log('JWT Secret:', process.env.JWT_SECRET_TOKEN);
const initializeApp = async () => {
    await connectDB(); 
  };
  
  initializeApp();

const app = express();
app.use(express.json());

const allowedOrigins = [
  'http://localhost:5173',
  'https://vite-project-omega-seven.vercel.app',
  'https://exquisite-wears.vercel.app'
];

// ✅ Configure CORS
const corsOptions = {
  origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true); // Allow the request
      } else {
          callback(new Error('Not allowed by CORS'));
      }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: "*",
  credentials: true
};

app.use(cors(corsOptions));

app.use(bodyParser.json())

app.get('/', (req, res) => res.send('API is running...'));


// User routes
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);

// Product routes
app.use('/api/products', productRoutes); 

// contact routes
app.use('/api/contact', contact)
app.use('/api/subscribe', subscribe)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
