const express = require("express");
const Product = require("../Models/Product");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'product-images',
    allowedFormats: ['jpeg', 'png', 'jpg', 'gif', 'webp', 'svg', 'mp4']
  }
})

const upload = multer({ storage })

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
    res
      .status(201)
      .json({ message: "Product posted successfully!", product: newProduct });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to post product!", details: err.message });
  }
});

router.get("/get", async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 15;
  const skip = (page - 1) * limit;
  // URL/get?page=${currentPage}&limit=limit
  
  console.log(`Request params: page=${page}, limit=${limit}, skip=${skip}`);
  
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
  // URL/search?query=${searchTerm}
  try {
    const products = await Product.find({
      name: { $regex: query, $options: "i" },
    });

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found!" });
    }

    res.status(200).json(products);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to search products!", details: err.message });
  }
});

router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params.id
  try {
    const deletedProducts = await Product.findOneAndDelete(id)
    if (!deletedProducts) {
      return res.status(404).json({ message: 'Product not found' });
    } 
    res.status(200).json({ message: 'Product deleted successfully', products: deletedProducts});
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product'})
  }
})


router.put(
  "/put/:id",
  verifyAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("File:", req.file); // Check uploaded file
      console.log("Body:", req.body); // Check other fields

      const { id } = req.params;
      const { name, description, price, quantity } = req.body;
        
      let imageUrl;
        if (req.file) {
          const answer = await cloudinary.uploader.upload(req.file.path, {
            folder: 'product-images',
          })
          imageUrl = answer.secure_url;
        }  
        
        const updatedFields = {
          ...(name && { name }),
        ...(description && { description }),
        ...(price && { price }),
        ...(quantity && { quantity }),
        ...(imageUrl && {image: imageUrl}),
        }

      const result = await Product.findByIdAndUpdate(id, 
        updatedFields,
        {new: true}
      );

      res.status(200).json({ success: true, product: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);



router.get("/get/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Find the product by ID
    const product = await Product.findById(id);

    // If no product is found, return an error
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Return the product details
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
