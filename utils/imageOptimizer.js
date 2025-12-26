const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Cloudinary is already configured in config/cloudinary.js
// No need to reconfigure here

/**
 * Optimize and upload image to Cloudinary with multiple formats
 * Returns responsive image URLs for different sizes
 */
const optimizeAndUploadImage = async (file) => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    // Create temporary directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.jpg`);

    // Optimize image using sharp
    const optimizedBuffer = await sharp(file.buffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    // Save optimized image temporarily
    fs.writeFileSync(tempFilePath, optimizedBuffer);

    // Upload to Cloudinary
    const uploadResult = await cloudinary.v2.uploader.upload(tempFilePath, {
      folder: 'exquisite-wears/products',
      quality: 'auto',
      fetch_format: 'auto',
      resource_type: 'auto',
      tags: ['product', 'optimized'],
    });

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);

    // Generate responsive URLs using Cloudinary transformations
    const responsiveImages = {
      original: uploadResult.secure_url,
      thumbnail: cloudinary.url(uploadResult.public_id, {
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto',
      }),
      small: cloudinary.url(uploadResult.public_id, {
        width: 300,
        height: 300,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto',
      }),
      medium: cloudinary.url(uploadResult.public_id, {
        width: 600,
        height: 600,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto',
      }),
      large: cloudinary.url(uploadResult.public_id, {
        width: 1000,
        height: 1000,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto',
      }),
      webp: cloudinary.url(uploadResult.public_id, {
        width: 600,
        height: 600,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'webp',
      }),
      thumbnail_webp: cloudinary.url(uploadResult.public_id, {
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'webp',
      }),
    };

    return {
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      responsiveImages,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      size: uploadResult.bytes,
    };
  } catch (error) {
    console.error('Image optimization error:', error);
    throw new Error(`Image optimization failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.v2.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Image deletion error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Batch optimize multiple images
 */
const batchOptimizeImages = async (files) => {
  try {
    const uploadPromises = files.map((file) => optimizeAndUploadImage(file));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Batch optimization error:', error);
    throw new Error(`Batch optimization failed: ${error.message}`);
  }
};

/**
 * Get image optimization stats
 */
const getImageStats = async (publicId) => {
  try {
    const resource = await cloudinary.v2.api.resource(publicId);
    return {
      publicId: resource.public_id,
      url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      bytes: resource.bytes,
      format: resource.format,
      created: resource.created_at,
      tags: resource.tags,
    };
  } catch (error) {
    console.error('Get image stats error:', error);
    throw new Error(`Failed to get image stats: ${error.message}`);
  }
};

module.exports = {
  optimizeAndUploadImage,
  deleteImage,
  batchOptimizeImages,
  getImageStats,
};
