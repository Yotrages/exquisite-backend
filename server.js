const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/products'); // Import productRoutes
const cartRoutes = require('./routes/cart');
const { protect, admin } = require('./middleware/authMiddleware');


dotenv.config();
console.log('JWT Secret:', process.env.JWT_SECRET_TOKEN);
connectDB();

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('API is running...'));

// User routes
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);

// Product routes
app.use('/api/products', productRoutes); // Register the product routes

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
