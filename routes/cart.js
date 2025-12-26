const express = require('express');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

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
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
      } else {
        cart.items.push({ product: productId, quantity });
      }
    } else {
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

router.get('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve cart', details: err.message });
  }
});

router.put('/update', protect, async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ error: 'Item not found in cart' });

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    res.status(200).json({ message: 'Cart updated', cart });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart', details: err.message });
  }
});

router.post('/cart/apply-coupon', protect, async (req, res) => {
  try {
    const { code, cartTotal } = req.body

    // Sample coupon codes - you should store these in database
    const coupons = {
      'SAVE10': { discount: 10, minPurchase: 0, type: 'percentage' },
      'SAVE20': { discount: 20, minPurchase: 50000, type: 'percentage' },
      'FIRST100': { discount: 100, minPurchase: 1000, type: 'fixed' },
      'FREESHIP': { discount: 0, minPurchase: 0, type: 'free_shipping' }
    }

    const coupon = coupons[code.toUpperCase()]

    if (!coupon) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid coupon code' 
      })
    }

    if (cartTotal < coupon.minPurchase) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum purchase of ₦${coupon.minPurchase.toLocaleString()} required` 
      })
    }

    let discountAmount = 0
    let freeShipping = false

    if (coupon.type === 'percentage') {
      discountAmount = (cartTotal * coupon.discount) / 100
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.discount
    } else if (coupon.type === 'free_shipping') {
      freeShipping = true
    }

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      discount: discountAmount,
      freeShipping,
      couponCode: code
    })
  } catch (error) {
    console.error('Error applying coupon:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to apply coupon' 
    })
  }
})

/**
 * GET /api/cart/shipping-cost
 * Calculate shipping cost based on location and cart total
 */
router.get('/cart/shipping-cost', protect, async (req, res) => {
  try {
    const { state, cartTotal } = req.query

    // Free shipping for orders over 50,000
    if (parseFloat(cartTotal) >= 50000) {
      return res.json({
        cost: 0,
        estimatedDays: 3,
        isFree: true,
        message: 'Free shipping on orders over ₦50,000'
      })
    }

    // Sample shipping costs by state (Nigeria)
    const shippingRates = {
      'Lagos': { cost: 1500, days: 2 },
      'Abuja': { cost: 2000, days: 3 },
      'Port Harcourt': { cost: 2500, days: 4 },
      'Kano': { cost: 3000, days: 5 },
      'Ibadan': { cost: 1800, days: 3 },
      'default': { cost: 2500, days: 4 }
    }

    const shipping = shippingRates[state] || shippingRates['default']

    res.json({
      cost: shipping.cost,
      estimatedDays: shipping.days,
      isFree: false
    })
  } catch (error) {
    console.error('Error calculating shipping:', error)
    res.status(500).json({ message: 'Failed to calculate shipping' })
  }
})

/**
 * POST /api/cart/validate-address
 * Validate delivery address
 */
router.post('/cart/validate-address', protect, async (req, res) => {
  try {
    const { address, city, state, zipCode } = req.body

    // Basic validation
    if (!address || !city || !state) {
      return res.status(400).json({
        valid: false,
        message: 'Please provide complete address details'
      })
    }

    // You can integrate with a real address validation API here
    res.json({
      valid: true,
      message: 'Address validated successfully',
      deliveryEstimate: '2-4 business days'
    })
  } catch (error) {
    console.error('Error validating address:', error)
    res.status(500).json({ 
      valid: false, 
      message: 'Failed to validate address' 
    })
  }
})

module.exports = router;
