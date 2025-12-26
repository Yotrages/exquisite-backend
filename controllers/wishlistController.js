const Wishlist = require('../Models/Wishlist.js');
const Product = require('../Models/Product.js');
const { deleteFromCache } = require('../config/redis.js');

/**
 * Get user's wishlist
 */
const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    let wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name price category images rating inStock',
    });

    // Create wishlist if doesn't exist
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, items: [] });
      await wishlist.save();
    }

    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add product to wishlist
 */
const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { notifyOnPriceDrop = false, priceDropThreshold = 10 } = req.body;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, items: [] });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find((item) => item.product.toString() === productId);

    if (existingItem) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

    // Add to wishlist
    wishlist.items.push({
      product: productId,
      priceAtAddition: product.price,
      notifyOnPriceDrop,
      priceDropThreshold,
    });

    await wishlist.save();

    // Invalidate cache
    await deleteFromCache(`wishlist:${userId}`);

    res.status(201).json({ message: 'Product added to wishlist', wishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Remove product from wishlist
 */
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: productId } } },
      { new: true }
    ).populate({
      path: 'items.product',
      select: 'name price category images rating inStock',
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Invalidate cache
    await deleteFromCache(`wishlist:${userId}`);

    res.json({ message: 'Product removed from wishlist', wishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Check if product is in wishlist
 */
const isInWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({
      user: userId,
      'items.product': productId,
    });

    res.json({ inWishlist: !!wishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Clear entire wishlist
 */
const clearWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { items: [] },
      { new: true }
    );

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Invalidate cache
    await deleteFromCache(`wishlist:${userId}`);

    res.json({ message: 'Wishlist cleared', wishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Move wishlist item to cart
 */
const moveToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { quantity = 1 } = req.body;

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.inStock) {
      return res.status(400).json({ message: 'Product is out of stock' });
    }

    // Remove from wishlist
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: productId } } },
      { new: true }
    );

    // TODO: Add to cart logic (integrate with cart service)
    // This would depend on your cart implementation

    // Invalidate cache
    await deleteFromCache(`wishlist:${userId}`);

    res.json({
      message: 'Product moved to cart',
      wishlist,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get price drop opportunities
 */
const getPriceDrops = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name price category images',
    });

    if (!wishlist) {
      return res.json({ priceDrops: [] });
    }

    const priceDrops = wishlist.items
      .filter((item) => {
        if (!item.notifyOnPriceDrop || !item.product) return false;

        const percentageDrop = ((item.priceAtAddition - item.product.price) / item.priceAtAddition) * 100;
        return percentageDrop >= item.priceDropThreshold;
      })
      .map((item) => ({
        product: item.product,
        originalPrice: item.priceAtAddition,
        currentPrice: item.product.price,
        percentageDrop: (
          ((item.priceAtAddition - item.product.price) / item.priceAtAddition) *
          100
        ).toFixed(2),
        savings: (item.priceAtAddition - item.product.price).toFixed(0),
      }));

    res.json({ priceDrops });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update price notification settings
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { notifyOnPriceDrop, priceDropThreshold } = req.body;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId, 'items.product': productId },
      {
        $set: {
          'items.$.notifyOnPriceDrop': notifyOnPriceDrop,
          'items.$.priceDropThreshold': priceDropThreshold,
        },
      },
      { new: true }
    ).populate({
      path: 'items.product',
      select: 'name price category images rating inStock',
    });

    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    // Invalidate cache
    await deleteFromCache(`wishlist:${userId}`);

    res.json({ message: 'Notification settings updated', wishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Share wishlist (public link)
 */
const togglePublicWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      [{ $set: { isPublic: { $not: '$isPublic' } } }],
      { new: true }
    );

    res.json({
      message: wishlist.isPublic ? 'Wishlist is now public' : 'Wishlist is now private',
      wishlist,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  clearWishlist,
  moveToCart,
  getPriceDrops,
  updateNotificationSettings,
  togglePublicWishlist,
};
