const express = require("express");
const Product = require("../Models/Product");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs").promises;
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 
  }
});

/**
 * Unified image compression with format detection
 * Handles JPEG, PNG, WebP, GIF, SVG with optimal settings
 */
const compressImage = async (buffer, originalname, mimetype) => {
  const ext = path.extname(originalname).toLowerCase();
  
  try {
    let compressedBuffer;
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        compressedBuffer = await sharp(buffer)
          .jpeg({ 
            quality: 85, 
            progressive: true,
            mozjpeg: true 
          })
          .toBuffer();
        break;
        
      case '.png':
        compressedBuffer = await sharp(buffer)
          .png({ 
            quality: 90,
            compressionLevel: 9, 
            progressive: true
          })
          .toBuffer();
        break;
        
      case '.webp':
        compressedBuffer = await sharp(buffer)
          .webp({ 
            quality: 85,
            effort: 6 
          })
          .toBuffer();
        break;
        
      case '.gif':
        compressedBuffer = await sharp(buffer, { animated: true })
          .webp({ 
            quality: 85,
            effort: 6
          })
          .toBuffer();
        break;
        
      case '.svg':
        return buffer; // SVG already efficient
        
      default:
        compressedBuffer = await sharp(buffer)
          .webp({ 
            quality: 85,
            effort: 6
          })
          .toBuffer();
    }
    
    if (compressedBuffer.length < buffer.length) {
      console.log(`Image compressed: ${buffer.length} → ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length/buffer.length) * 100)}% reduction)`);
      return compressedBuffer;
    } else {
      console.log("Compression didn't reduce size, using original");
      return buffer;
    }
    
  } catch (error) {
    console.error("Image compression failed:", error);
    return buffer; 
  }
};

const compressVideo = async (buffer, originalname) => {
  const tempDir = path.join(__dirname, '../temp');
  const inputPath = path.join(tempDir, `input_${Date.now()}_${originalname}`);
  const outputPath = path.join(tempDir, `output_${Date.now()}_${originalname.replace(path.extname(originalname), '.mp4')}`);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    await fs.writeFile(inputPath, buffer);
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate('1000k') 
        .audioBitrate('128k')
        .size('?x720') 
        .format('mp4')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });
    
    const compressedBuffer = await fs.readFile(outputPath);
    
    await fs.unlink(inputPath);
    await fs.unlink(outputPath);
    
    console.log(`Video compressed: ${buffer.length} → ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length/buffer.length) * 100)}% reduction)`);
    return compressedBuffer;
    
  } catch (error) {
    console.error("Video compression failed:", error);
    try {
      await fs.unlink(inputPath);
      await fs.unlink(outputPath);
    } catch (cleanupError) {
    }
    return buffer; 
  }
};

const compressFile = async (req, res, next) => {
  if (!req.file) return next();
  
  const { buffer, originalname, mimetype } = req.file;
  const ext = path.extname(originalname).toLowerCase();
  const isVideo = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(ext);
  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);
  
  try {
    let compressedBuffer;
    
    if (isImage) {
      compressedBuffer = await compressImage(buffer, originalname, mimetype);
    } else if (isVideo) {
      compressedBuffer = await compressVideo(buffer, originalname);
    } else {
      compressedBuffer = buffer;
    }
    
    req.file.buffer = compressedBuffer;
    req.file.size = compressedBuffer.length;
    
    next();
  } catch (error) {
    console.error("File compression middleware error:", error);
    next(); 
  }
};

const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'product-images',
        resource_type: 'auto', 
        quality: 'auto:best', 
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    stream.end(buffer);
  });
};

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log("Received Token:", token);

  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_TOKEN);
    console.log("Decoded Token:", decoded);

    if (!decoded.isAdmin) {
      console.error("Not an admin");
      return res.status(403).json({ error: "Access forbidden. Admins only." });
    }
    next();
  } catch (err) {
    console.error("Token Verification Error:", err.message);
    return res.status(400).json({ error: "Invalid token." });
  }
};

router.post("/post", verifyAdmin, upload.single("image"), compressFile, async (req, res) => {
  const { name, description, price, quantity, category, sku, tags, originalPrice, discount, brand, specifications, seller } = req.body;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image upload failed" });
    }

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    
    console.log("Upload successful:", uploadResult.secure_url);

    // Normalize numbers
    const parsedOriginalPrice = originalPrice !== undefined ? parseFloat(originalPrice) : undefined;
    const parsedDiscount = discount !== undefined ? parseFloat(discount) : 0;

    // If originalPrice and discount provided, compute price, else fallback to provided price
    let finalPrice = price !== undefined ? parseFloat(price) : undefined;
    if (parsedOriginalPrice && parsedDiscount > 0) {
      finalPrice = Math.round((parsedOriginalPrice * (1 - (parsedDiscount / 100))) * 100) / 100;
    }

    const parsedSpecs = specifications ? (typeof specifications === 'string' ? JSON.parse(specifications) : specifications) : {};
    const parsedSeller = seller ? (typeof seller === 'string' ? JSON.parse(seller) : seller) : undefined;

    const newProduct = new Product({
      name,
      description,
      price: finalPrice,
      originalPrice: parsedOriginalPrice || undefined,
      discount: parsedDiscount || 0,
      quantity,
      category,
      brand: brand || undefined,
      specifications: parsedSpecs,
      seller: parsedSeller,
      image: uploadResult.secure_url,
      sku: sku || undefined,
      tags: tags ? JSON.parse(tags) : [],
      images: req.body.images ? JSON.parse(req.body.images) : undefined,
    });

    await newProduct.save();
    res.status(201).json({ 
      message: "Product posted successfully!", 
      product: newProduct,
      compressionInfo: {
        originalSize: req.file.size,
        finalUrl: uploadResult.secure_url
      }
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ 
      error: "Failed to post product!", 
      details: err.message 
    });
  }
});

router.put("/put/:id", verifyAdmin, upload.single("image"), compressFile, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, quantity, category, sku, tags, originalPrice, discount, brand, specifications, seller, inStock } = req.body;
    
    let imageUrl;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      imageUrl = uploadResult.secure_url;
    }

    const parsedOriginalPrice = originalPrice !== undefined ? parseFloat(originalPrice) : undefined;
    const parsedDiscount = discount !== undefined ? parseFloat(discount) : undefined;

    const parsedSpecs = specifications ? (typeof specifications === 'string' ? JSON.parse(specifications) : specifications) : undefined;
    const parsedSeller = seller ? (typeof seller === 'string' ? JSON.parse(seller) : seller) : undefined;

    let updatedFields = {
      ...(name && { name }),
      ...(description && { description }),
      ...(price && { price }),
      ...(quantity !== undefined && { quantity }),
      ...(category && { category }),
      ...(sku && { sku }),
      ...(tags && { tags: typeof tags === 'string' ? JSON.parse(tags) : tags }),
      ...(imageUrl && { image: imageUrl }),
      ...(brand && { brand }),
      ...(parsedSpecs && { specifications: parsedSpecs }),
      ...(parsedSeller && { seller: parsedSeller }),
    };

    // Respect explicit inStock provided by the admin (form will send 'true'/'false' strings)
    if (typeof inStock !== 'undefined') {
      updatedFields.inStock = (inStock === 'true' || inStock === true || inStock === '1' || inStock === 1);
    } else if (typeof quantity !== 'undefined') {
      // derive inStock from quantity when admin didn't explicitly set it
      updatedFields.inStock = Number(quantity) > 0;
    }

    // Handle pricing updates: if originalPrice and discount provided, recalculate price
    if (parsedOriginalPrice !== undefined) {
      updatedFields.originalPrice = parsedOriginalPrice;
    }

    if (parsedDiscount !== undefined) {
      updatedFields.discount = parsedDiscount;
    }

    if ((parsedOriginalPrice !== undefined && parsedDiscount !== undefined) && (parsedDiscount > 0)) {
      updatedFields.price = Math.round((parsedOriginalPrice * (1 - (parsedDiscount/100))) * 100) / 100;
    }

    const result = await Product.findByIdAndUpdate(id, updatedFields, { new: true });

    if (!result) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ 
      success: true, 
      product: result,
      ...(req.file && {
        compressionInfo: {
          originalSize: req.file.size,
          finalUrl: imageUrl
        }
      })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/get", async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 15;
  const skip = (page - 1) * limit;
  
  try {
    const products = await Product.find().skip(skip).limit(limit).sort({dateAdded: -1});
    const total = await Product.countDocuments();
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      products,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products!", details: err.message });
  }
});

router.get("/search", async (req, res) => {
  const { query } = req.query;
  try {
    const products = await Product.find({
      name: { $regex: query, $options: "i" },
    });

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found!" });
    }

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to search products!", details: err.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const id = req.params.id; 
  try {
    const deletedProduct = await Product.findOneAndDelete({ _id: id });

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ 
      message: "Product deleted successfully", 
      deletedProduct 
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
});

router.get("/get/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/flash-deals', async (req, res) => {
  try {
    const flashDeals = await Product.find({
      discount: { $gte: 30 }, // 30% or more discount
      quantity: { $gt: 0 }
    })
      .sort({ discount: -1, dateAdded: -1 })
      .limit(10)
      .select('name price image discount quantity')

    // Add originalPrice for display if available, otherwise compute
    const dealsWithOriginalPrice = flashDeals.map(deal => {
      const obj = deal.toObject();
      return Object.assign({}, obj, {
        originalPrice: obj.originalPrice || (obj.discount ? Math.round((obj.price / (1 - obj.discount / 100)) * 100) / 100 : obj.price),
        stockLeft: obj.quantity
      })
    })

    res.json(dealsWithOriginalPrice)
  } catch (error) {
    console.error('Error fetching flash deals:', error)
    res.status(500).json({ message: 'Failed to fetch flash deals' })
  }
})

/**
 * GET /api/products/deal-of-the-day
 * Get the best deal of the current day
 */
router.get('/deal-of-the-day', async (req, res) => {
  try {
    // You can implement logic to rotate daily or pick the best discount
    const dealOfDay = await Product.findOne({
      discount: { $gte: 40 },
      stock: { $gt: 0 }
    })
      .sort({ discount: -1 })
      .select('name price image discount stock averageRating description')

    if (!dealOfDay) {
      return res.status(404).json({ message: 'No deal available today' })
    }

    res.json(dealOfDay)
  } catch (error) {
    console.error('Error fetching deal of the day:', error)
    res.status(500).json({ message: 'Failed to fetch deal of the day' })
  }
})

// ============================================
// RELATED PRODUCTS
// ============================================

/**
 * GET /api/products/:id/related
 * Get products related to a specific product (same category)
 */
router.get('/:id/related', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Find products in same category, excluding current product
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      stock: { $gt: 0 }
    })
      .limit(12)
      .select('name price image discount averageRating')
      .sort({ averageRating: -1 })

    res.json(relatedProducts)
  } catch (error) {
    console.error('Error fetching related products:', error)
    res.status(500).json({ message: 'Failed to fetch related products' })
  }
})

/**
 * GET /api/products/:id/frequently-bought-together
 * Get products frequently bought with this product
 */
router.get('/:id/frequently-bought-together', async (req, res) => {
  try {
    // This is a simplified version - you'd want to implement actual
    // collaborative filtering based on order history
    const product = await Product.findById(req.params.id)
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // For now, return products in same category with high ratings
    const frequentlyBought = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      averageRating: { $gte: 4 },
      stock: { $gt: 0 }
    })
      .limit(4)
      .select('name price image discount averageRating')

    res.json(frequentlyBought)
  } catch (error) {
    console.error('Error fetching frequently bought together:', error)
    res.status(500).json({ message: 'Failed to fetch products' })
  }
})

router.post('/:id/view', async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 }
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error tracking view:', error)
    res.status(500).json({ success: false })
  }
})

/**
 * GET /api/products/trending
 * Get trending products based on views and sales
 */
router.get('/trending', async (req, res) => {
  try {
    const trendingProducts = await Product.find({ stock: { $gt: 0 } })
      .sort({ views: -1, soldCount: -1 })
      .limit(12)
      .select('name price image discount averageRating')

    res.json(trendingProducts)
  } catch (error) {
    console.error('Error fetching trending products:', error)
    res.status(500).json({ message: 'Failed to fetch trending products' })
  }
})


module.exports = router;