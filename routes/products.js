const express = require("express");
const Product = require("../Models/Product");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs").promises;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

// Configure multer to store files temporarily in memory
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Image compression middleware using Sharp (similar to Squoosh quality)
const compressImage = async (buffer, originalname, mimetype) => {
  const ext = path.extname(originalname).toLowerCase();
  
  try {
    let compressedBuffer;
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        compressedBuffer = await sharp(buffer)
          .jpeg({ 
            quality: 85, // High quality, reduces size significantly
            progressive: true,
            mozjpeg: true // Better compression algorithm
          })
          .toBuffer();
        break;
        
      case '.png':
        compressedBuffer = await sharp(buffer)
          .png({ 
            quality: 90,
            compressionLevel: 9, // Maximum compression
            progressive: true
          })
          .toBuffer();
        break;
        
      case '.webp':
        compressedBuffer = await sharp(buffer)
          .webp({ 
            quality: 85,
            effort: 6 // Maximum effort for better compression
          })
          .toBuffer();
        break;
        
      case '.gif':
        // For GIFs, we'll convert to WebP for better compression
        compressedBuffer = await sharp(buffer, { animated: true })
          .webp({ 
            quality: 85,
            effort: 6
          })
          .toBuffer();
        break;
        
      case '.svg':
        // SVGs are already optimized, return as-is
        return buffer;
        
      default:
        // For other formats, try to convert to WebP
        compressedBuffer = await sharp(buffer)
          .webp({ 
            quality: 85,
            effort: 6
          })
          .toBuffer();
    }
    
    // Check if compression actually reduced the size
    if (compressedBuffer.length < buffer.length) {
      console.log(`Image compressed: ${buffer.length} → ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length/buffer.length) * 100)}% reduction)`);
      return compressedBuffer;
    } else {
      console.log("Compression didn't reduce size, using original");
      return buffer;
    }
    
  } catch (error) {
    console.error("Image compression failed:", error);
    return buffer; // Return original if compression fails
  }
};

// Video compression middleware using FFmpeg
const compressVideo = async (buffer, originalname) => {
  const tempDir = path.join(__dirname, '../temp');
  const inputPath = path.join(tempDir, `input_${Date.now()}_${originalname}`);
  const outputPath = path.join(tempDir, `output_${Date.now()}_${originalname.replace(path.extname(originalname), '.mp4')}`);
  
  try {
    // Create temp directory if it doesn't exist
    await fs.mkdir(tempDir, { recursive: true });
    
    // Write buffer to temp file
    await fs.writeFile(inputPath, buffer);
    
    // Compress video using FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate('1000k') // Adjust based on your needs
        .audioBitrate('128k')
        .size('?x720') // Max height 720p, maintain aspect ratio
        .format('mp4')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });
    
    // Read compressed file
    const compressedBuffer = await fs.readFile(outputPath);
    
    // Clean up temp files
    await fs.unlink(inputPath);
    await fs.unlink(outputPath);
    
    console.log(`Video compressed: ${buffer.length} → ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length/buffer.length) * 100)}% reduction)`);
    return compressedBuffer;
    
  } catch (error) {
    console.error("Video compression failed:", error);
    // Clean up temp files on error
    try {
      await fs.unlink(inputPath);
      await fs.unlink(outputPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    return buffer; // Return original if compression fails
  }
};

// Main compression middleware
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
      // For other file types, proceed without compression
      compressedBuffer = buffer;
    }
    
    // Update the file object with compressed data
    req.file.buffer = compressedBuffer;
    req.file.size = compressedBuffer.length;
    
    next();
  } catch (error) {
    console.error("File compression middleware error:", error);
    next(); // Continue with original file if compression fails
  }
};

// Custom Cloudinary upload function for compressed files
const uploadToCloudinary = (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'product-images',
        resource_type: 'auto', // Auto-detect file type
        quality: 'auto:best', // Let Cloudinary optimize further if needed
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

// Updated POST route with compression
router.post("/post", verifyAdmin, upload.single("image"), compressFile, async (req, res) => {
  const { name, description, price, quantity } = req.body;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image upload failed" });
    }

    // Upload compressed file to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    
    console.log("Upload successful:", uploadResult.secure_url);
    
    const newProduct = new Product({
      name,
      description,
      price,
      quantity,
      image: uploadResult.secure_url,
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

// Updated PUT route with compression
router.put("/put/:id", verifyAdmin, upload.single("image"), compressFile, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, quantity } = req.body;
    
    let imageUrl;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      imageUrl = uploadResult.secure_url;
    }
    
    const updatedFields = {
      ...(name && { name }),
      ...(description && { description }),
      ...(price && { price }),
      ...(quantity && { quantity }),
      ...(imageUrl && { image: imageUrl }),
    };

    const result = await Product.findByIdAndUpdate(id, updatedFields, { new: true });

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

// Rest of your existing routes remain the same
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

module.exports = router;