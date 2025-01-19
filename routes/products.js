const express = require('express');
const Product = require('../Models/Product');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');


const router = express.Router();



const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
      folder: 'product-images', // Change folder name if needed
      allowed_formats: ['jpeg', 'png', 'jpg'],
  },
});

const upload = multer({ storage });

// Middleware to Verify Admin
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Received Token:', token); 

  // If no token is provided
  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify token
    console.log('JWT_SECRET in middleware:', process.env.JWT_SECRET_TOKEN);
    const decoded = jwt.verify(token, process.env.JWT_SECRET_TOKEN);
    console.log('Decoded Token:', decoded);  

    // Check if the user is admin
    if (!decoded.isAdmin) {
      console.error('Not an admin');
      return res.status(403).json({ error: 'Access forbidden. Admins only.' });
    }
    next();
  } catch (err) {
    console.error('Token Verification Error:', err.message);
    return res.status(400).json({ error: 'Invalid token.' });
  }
};




// Admin: Post Product
router.post("/post", verifyAdmin, upload.single("image"), async (req, res) => {
  const { name, description, price, quantity } = req.body;
  const image = req.file; 

  try {
    
    console.log(req.file);
 if (!req.file) {
  return res.status(400).json({ message: "Image upload failed" });
}

console.log(req.body, req.file);


    const newProduct = new Product({
      name,
      description,
     price,
      quantity,
      image: image.path, 
    });

    await newProduct.save();
    res.status(201).json({ message: "Product posted successfully!", product: newProduct });
  } catch (err) {
    res.status(500).json({ error: "Failed to post product!", details: err.message });
  }
});

// User: Get Products (Paginated)
router.get('/get', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 15;

  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments();
    res.status(200).json({
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products!', details: err.message });
  }
});

// Search Products by Title
router.get('/search', async (req, res) => {
    const { query } = req.query; 
  
    try {
      const products = await Product.find({
        name: { $regex: query, $options: 'i' }, 
      });
  
      if (products.length === 0) {
        return res.status(404).json({ message: 'No products found!' });
      }
  
      res.status(200).json(products);
    } catch (err) {
      res.status(500).json({ error: 'Failed to search products!', details: err.message });
    }
  });
  
  module.exports = {
    router,
    storage
  };
