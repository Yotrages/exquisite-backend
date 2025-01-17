const express = require('express');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Add to Cart
router.post('/add', protect, async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (quantity > product.quantity) {
      return res.status(400).json({ error: 'Requested quantity exceeds stock' });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      // Check if product is already in the cart
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

      if (itemIndex > -1) {
        // Update quantity
        cart.items[itemIndex].quantity += quantity;
      } else {
        // Add new item
        cart.items.push({ product: productId, quantity });
      }
    } else {
      // Create new cart
      cart = new Cart({
        user: req.user._id,
        items: [{ product: productId, quantity }],
      });
    }

    await cart.save();
    res.status(200).json({ message: 'Item added to cart', cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to cart', details: err.message });
  }
});

// Get Cart
router.get('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve cart', details: err.message });
  }
});

// Update Cart Item
router.put('/update', protect, async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ error: 'Item not found in cart' });

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    res.status(200).json({ message: 'Cart updated', cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart', details: err.message });
  }
});

module.exports = router;
