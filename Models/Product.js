const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
        index: true,
    },
    price: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    sku: {
        type: String,
        unique: true,
        sparse: true,
    },
    image: {
        type: String,
        required: true,
    },
    images: [String],
    originalPrice: {
        type: Number,
        default: null,
    },
    discount: {
        // discount stored as percentage (e.g., 20 for 20%)
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    brand: {
        type: String,
        index: true,
    },
    specifications: {
        // flexible structure: key-value map of specs
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    seller: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
        name: { type: String, default: 'Default Seller' },
        rating: { type: Number, default: 0 },
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
    },
    reviews: {
        type: Number,
        default: 0,
    },
    inStock: {
        type: Boolean,
        default: function() {
            return this.quantity > 0;
        },
    },
    tags: [String],
    dateAdded: {
        type: Date,
        default: Date.now,
        index: true,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

// Create indexes for performance optimization
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });

// Update lastUpdated timestamp on save
productSchema.pre('save', function(next) {
    this.lastUpdated = Date.now();
    next();
});

// Virtuals and JSON options
productSchema.virtual('stock').get(function() {
    return this.quantity;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Indexes
productSchema.index({ brand: 1, category: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
