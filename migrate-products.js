require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Product = require('./Models/Product');
const https = require('https');

const MONGO_URI = process.env.MONGO_URI;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

if (!MONGO_URI) {
  console.error('MONGO_URI not found in .env file');
  process.exit(1);
}
if (!UNSPLASH_ACCESS_KEY) {
  console.error('UNSPLASH_ACCESS_KEY not found in .env file');
  process.exit(1);
}

// 12 categories from the frontend
const CATEGORIES = [
  'Fashion',
  'Electronics',
  'Phones',
  'Home',
  'Books',
  'Baby',
  'Sports',
  'Health',
  'Jewellery',
  'Kitchen',
  'Cameras',
  'Food'
];

// Helper to generate unique SKU
const generateSKU = (category, index) => {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}-${String(index).padStart(4, '0')}-${Date.now().toString(36).toUpperCase()}`;
};

// Cache for Unsplash search results to avoid duplicate API calls
const imageCache = new Map();

// Helper to search Unsplash API for product-relevant images
const searchUnsplashImages = (query, count = 3) => {
  return new Promise((resolve) => {
    const cacheKey = `${query}-${count}`;
    if (imageCache.has(cacheKey)) {
      resolve(imageCache.get(cacheKey));
      return;
    }

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=squarish&client_id=${UNSPLASH_ACCESS_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.results && parsed.results.length > 0) {
            const images = parsed.results.map(photo => photo.urls.regular);
            imageCache.set(cacheKey, images);
            resolve(images);
          } else {
            // Fallback to placeholder if no results
            const fallback = Array(count).fill(null).map((_, i) =>
              `https://via.placeholder.com/400x400/cccccc/333333?text=${encodeURIComponent(query + ' ' + (i+1))}`
            );
            imageCache.set(cacheKey, fallback);
            resolve(fallback);
          }
        } catch (e) {
          const fallback = Array(count).fill(null).map((_, i) =>
            `https://via.placeholder.com/400x400/cccccc/333333?text=${encodeURIComponent(query + ' ' + (i+1))}`
          );
          imageCache.set(cacheKey, fallback);
          resolve(fallback);
        }
      });
    }).on('error', () => {
      const fallback = Array(count).fill(null).map((_, i) =>
        `https://via.placeholder.com/400x400/cccccc/333333?text=${encodeURIComponent(query + ' ' + (i+1))}`
      );
      imageCache.set(cacheKey, fallback);
      resolve(fallback);
    });
  });
};

// Single API call per product - gets both main image and gallery images
const getProductImages = async (productName, category, index, count = 3) => {
  // Create search query from product name - extract key descriptive terms
  const searchTerms = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special chars
    .split(/\s+/)
    .filter(word => word.length > 2)  // Keep words longer than 2 chars
    .slice(0, 4)  // Limit to first 4 meaningful words
    .join(' ');

  // Fallback to category if product name doesn't yield good terms
  const query = searchTerms || category.toLowerCase();

  const images = await searchUnsplashImages(query, count);
  return images.length > 0 ? images : Array(count).fill(null).map((_, i) =>
    `https://via.placeholder.com/400x400/cccccc/333333?text=${encodeURIComponent(productName + ' ' + (i+1))}`
  );
};

// Rate limiter to respect Unsplash API limits (50 req/hour free tier)
// 54 products = 54 API calls. Need ~72 seconds between calls to stay under 50/hr.
// Using 80 seconds (80000ms) to be safe.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let lastApiCall = 0;
const MIN_API_INTERVAL = 80000; // 80 seconds between calls = 45 calls/hour max

const rateLimitedApiCall = async (fn) => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
    console.log(`  Rate limiting: waiting ${Math.round(waitTime/1000)}s before next API call...`);
    await delay(waitTime);
  }
  lastApiCall = Date.now();
  return await fn();
};

// Wrapper function with rate limiting - gets all images in one call
const getProductImagesRL = (productName, category, index, count = 3) =>
  rateLimitedApiCall(() => getProductImages(productName, category, index, count));

// Generate products for each category
const generateProducts = async () => {
  const products = [];
  let productIndex = 1;

  // FASHION - 5 products
  const fashionProducts = [
    { name: 'Classic Cotton T-Shirt', brand: 'UrbanStyle', price: 29.99, originalPrice: 39.99, discount: 25, description: 'Premium 100% organic cotton t-shirt with a relaxed fit. Perfect for everyday wear.', specs: { material: '100% Organic Cotton', fit: 'Relaxed', care: 'Machine wash cold', origin: 'Portugal' } },
    { name: 'Slim Fit Denim Jeans', brand: 'DenimCo', price: 79.99, originalPrice: 99.99, discount: 20, description: 'Modern slim-fit jeans with stretch comfort. Classic 5-pocket styling.', specs: { material: '98% Cotton, 2% Elastane', fit: 'Slim', wash: 'Dark Indigo', closure: 'Button fly' } },
    { name: 'Wool Blend Blazer', brand: 'Executive Wear', price: 149.99, originalPrice: 199.99, discount: 25, description: 'Sophisticated wool blend blazer for professional and casual occasions.', specs: { material: '70% Wool, 30% Polyester', fit: 'Tailored', lining: 'Full silk lining', buttons: 'Horn buttons' } },
    { name: 'Floral Summer Dress', brand: 'Bloom & Co', price: 59.99, originalPrice: 79.99, discount: 25, description: 'Light and breezy floral dress perfect for summer days and garden parties.', specs: { material: '100% Viscose', fit: 'A-line', length: 'Midi', pattern: 'Floral print' } },
    { name: 'Leather Bomber Jacket', brand: 'Aviator', price: 299.99, originalPrice: 399.99, discount: 25, description: 'Genuine leather bomber jacket with ribbed cuffs and hem. Timeless style.', specs: { material: '100% Genuine Leather', fit: 'Regular', lining: 'Polyester', closure: 'YKK zipper' } }
  ];

  for (const [i, p] of fashionProducts.entries()) {
    const allImages = await getProductImagesRL(p.name, 'Fashion', i + 1);
    const image = allImages[0];
    const images = allImages;
    products.push({
      name: p.name,
      description: p.description,
      category: 'Fashion',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 50) + 20,
      sku: generateSKU('Fashion', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['clothing', 'apparel', p.brand.toLowerCase()],
      rating: (Math.random() * 1.5 + 3.5).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 200) + 10,
      seller: { name: 'Fashion Hub', rating: 4.8 }
    });
  }

  // ELECTRONICS - 5 products
  const electronicsProducts = [
    { name: 'Wireless Noise-Cancelling Headphones', brand: 'SoundMax', price: 249.99, originalPrice: 349.99, discount: 29, description: 'Premium over-ear headphones with industry-leading noise cancellation and 30-hour battery.', specs: { driver: '40mm', battery: '30 hours', connectivity: 'Bluetooth 5.0', weight: '254g', anc: 'Active Noise Cancellation' } },
    { name: '4K Ultra HD Smart TV 55"', brand: 'VisionTech', price: 599.99, originalPrice: 799.99, discount: 25, description: '55-inch 4K UHD Smart TV with HDR support and built-in streaming apps.', specs: { resolution: '3840x2160', panel: 'LED', hdr: 'HDR10+', os: 'WebOS', ports: '4x HDMI, 2x USB' } },
    { name: 'Mechanical Gaming Keyboard', brand: 'KeyMaster', price: 129.99, originalPrice: 159.99, discount: 19, description: 'RGB mechanical keyboard with Cherry MX Red switches and programmable macros.', specs: { switches: 'Cherry MX Red', backlight: 'Per-key RGB', layout: 'Full-size', connection: 'USB-C', polling: '1000Hz' } },
    { name: 'Portable Bluetooth Speaker', brand: 'AudioGo', price: 79.99, originalPrice: 99.99, discount: 20, description: 'Waterproof portable speaker with 360° sound and 20-hour playtime.', specs: { power: '20W', battery: '20 hours', waterproof: 'IPX7', connectivity: 'Bluetooth 5.3', weight: '0.9kg' } },
    { name: 'External SSD 1TB', brand: 'DataVault', price: 119.99, originalPrice: 149.99, discount: 20, description: 'Ultra-fast portable SSD with 1050MB/s read speeds. Compact and durable.', specs: { capacity: '1TB', interface: 'USB 3.2 Gen 2', speed: '1050MB/s', size: '91x57x9mm', warranty: '3 years' } }
  ];

  for (const [i, p] of electronicsProducts.entries()) {
    const allImages = await getProductImagesRL(p.name, 'Electronics', i + 1);
    const image = allImages[0];
    const images = allImages;
    products.push({
      name: p.name,
      description: p.description,
      category: 'Electronics',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 30) + 10,
      sku: generateSKU('Electronics', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['electronics', 'tech', 'gadgets'],
      rating: (Math.random() * 1.2 + 3.8).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 150) + 20,
      seller: { name: 'TechStore Pro', rating: 4.7 }
    });
  }

  // PHONES - 4 products
  const phonesProducts = [
    { name: 'Smartphone Pro Max 256GB', brand: 'Apple', price: 1199.99, originalPrice: 1299.99, discount: 8, description: 'Latest flagship with A17 Pro chip, 48MP camera system, and titanium design.', specs: { storage: '256GB', screen: '6.7" Super Retina XDR', chip: 'A17 Pro', camera: '48MP + 12MP + 12MP', battery: '29 hours video' } },
    { name: 'Galaxy S24 Ultra 512GB', brand: 'Samsung', price: 1299.99, originalPrice: 1419.99, discount: 8, description: 'Premium Android with S Pen, 200MP camera, and Galaxy AI features.', specs: { storage: '512GB', screen: '6.8" Dynamic AMOLED 2X', chip: 'Snapdragon 8 Gen 3', camera: '200MP + 50MP + 12MP + 10MP', battery: '5000mAh' } },
    { name: 'Pixel 8 Pro 128GB', brand: 'Google', price: 799.99, originalPrice: 999.99, discount: 20, description: 'Google AI-powered phone with best-in-class computational photography.', specs: { storage: '128GB', screen: '6.7" LTPO OLED', chip: 'Tensor G3', camera: '50MP + 48MP + 48MP', battery: '5050mAh' } },
    { name: 'OnePlus 12 256GB', brand: 'OnePlus', price: 699.99, originalPrice: 799.99, discount: 13, description: 'Fast and smooth flagship with Hasselblad camera and 100W charging.', specs: { storage: '256GB', screen: '6.82" LTPO AMOLED', chip: 'Snapdragon 8 Gen 3', camera: '50MP + 64MP + 48MP', battery: '5400mAh' } }
  ];

  for (const [i, p] of phonesProducts.entries()) {
    const allImages = await getProductImagesRL(p.name, 'Phones', i + 1);
    const image = allImages[0];
    const images = allImages;
    products.push({
      name: p.name,
      description: p.description,
      category: 'Phones',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 20) + 5,
      sku: generateSKU('Phones', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['smartphone', 'mobile', '5g'],
      rating: (Math.random() * 1.0 + 4.0).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 300) + 50,
      seller: { name: 'Mobile World', rating: 4.9 }
    });
  }

  // HOME - 5 products
  const homeProducts = [
    { name: 'Memory Foam Mattress Queen', brand: 'SleepWell', price: 599.99, originalPrice: 799.99, discount: 25, description: 'Medium-firm memory foam mattress with cooling gel layer. 100-night trial.', specs: { size: 'Queen (60"x80")', type: 'Memory Foam', firmness: 'Medium-Firm', layers: '3', trial: '100 nights', warranty: '10 years' } },
    { name: 'Smart Robot Vacuum', brand: 'CleanBot', price: 349.99, originalPrice: 449.99, discount: 22, description: 'LiDAR navigation, self-emptying base, and app control. Maps your home.', specs: { suction: '5000 Pa', navigation: 'LiDAR', battery: '180 mins', dustbin: 'Self-empty', app: 'iOS/Android' } },
    { name: 'Ergonomic Office Chair', brand: 'ErgoComfort', price: 449.99, originalPrice: 599.99, discount: 25, description: 'Fully adjustable ergonomic chair with lumbar support and breathable mesh.', specs: { material: 'Mesh + Foam', adjustments: 'Height, Tilt, Arms, Lumbar', weightCapacity: '300 lbs', warranty: '12 years', color: 'Graphite' } },
    { name: 'Weighted Blanket 15lbs', brand: 'CalmNights', price: 89.99, originalPrice: 119.99, discount: 25, description: 'Premium weighted blanket for better sleep. Glass beads, breathable cotton cover.', specs: { weight: '15 lbs', size: '60"x80"', fill: 'Glass beads', cover: '100% Cotton', care: 'Machine washable' } },
    { name: 'Air Purifier HEPA', brand: 'PureAir', price: 199.99, originalPrice: 249.99, discount: 20, description: 'True HEPA filtration for rooms up to 500 sq ft. Whisper-quiet operation.', specs: { coverage: '500 sq ft', filter: 'True HEPA H13', cadR: '230 CFM', noise: '24-50 dB', smart: 'App + Voice control' } }
  ];

  for (const [i, p] of homeProducts.entries()) {
    const allImages = await getProductImagesRL(p.name, 'Home', i + 1);
    const image = allImages[0];
    const images = allImages;
    products.push({
      name: p.name,
      description: p.description,
      category: 'Home',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 25) + 10,
      sku: generateSKU('Home', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['home', 'furniture', 'decor'],
      rating: (Math.random() * 1.2 + 3.8).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 180) + 15,
      seller: { name: 'Home Essentials', rating: 4.6 }
    });
  }

  // BOOKS - 4 products
  const booksProducts = [
    { name: 'Atomic Habits', brand: 'Penguin Random House', price: 18.99, originalPrice: 24.99, discount: 24, description: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones by James Clear.', specs: { author: 'James Clear', pages: 320, format: 'Hardcover', language: 'English', publisher: 'Avery', isbn: '978-0735211292' } },
    { name: 'The Psychology of Money', brand: 'Harriman House', price: 16.99, originalPrice: 22.99, discount: 26, description: 'Timeless lessons on wealth, greed, and happiness by Morgan Housel.', specs: { author: 'Morgan Housel', pages: 256, format: 'Hardcover', language: 'English', publisher: 'Harriman House', isbn: '978-0857197689' } },
    { name: 'Project Hail Mary', brand: 'Ballantine Books', price: 19.99, originalPrice: 28.99, discount: 31, description: 'A riveting interstellar adventure from the author of The Martian by Andy Weir.', specs: { author: 'Andy Weir', pages: 476, format: 'Hardcover', language: 'English', publisher: 'Ballantine Books', isbn: '978-0593135204' } },
    { name: 'Educated: A Memoir', brand: 'Random House', price: 17.99, originalPrice: 26.99, discount: 33, description: 'Bestselling memoir about a woman who leaves her survivalist family for education.', specs: { author: 'Tara Westover', pages: 334, format: 'Paperback', language: 'English', publisher: 'Random House', isbn: '978-0399590504' } }
  ];

  for (const [i, p] of booksProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Books', i + 1);
    const images = await getProductImagesRL(p.name, 'Books', i + 1, 2);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Books',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 100) + 50,
      sku: generateSKU('Books', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['books', 'reading', 'education'],
      rating: (Math.random() * 0.8 + 4.2).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 500) + 100,
      seller: { name: 'BookWorm', rating: 4.8 }
    });
  }

  // BABY - 4 products
  const babyProducts = [
    { name: 'Organic Cotton Onesies 5-Pack', brand: 'LittleSprout', price: 34.99, originalPrice: 44.99, discount: 22, description: 'Soft GOTS-certified organic cotton onesies. Gentle on baby sensitive skin.', specs: { material: '100% Organic Cotton', certification: 'GOTS', pack: '5 pieces', sizes: '0-3M, 3-6M, 6-9M', care: 'Machine washable' } },
    { name: 'Convertible Crib', brand: 'NurseryDream', price: 299.99, originalPrice: 399.99, discount: 25, description: '4-in-1 convertible crib grows with your child: crib, toddler bed, daybed, full bed.', specs: { material: 'Solid New Zealand Pine', finish: 'Non-toxic', converts: '4 stages', mattress: 'Adjustable 3 heights', certification: 'JPMA' } },
    { name: 'Video Baby Monitor', brand: 'WatchfulEye', price: 159.99, originalPrice: 199.99, discount: 20, description: '5" HD screen, night vision, two-way audio, temperature sensor, lullabies.', specs: { screen: '5" 720p', range: '1000 ft', battery: '12 hours', nightVision: 'Auto', features: 'Temp sensor, lullabies, VOX' } },
    { name: 'Stroller Travel System', brand: 'GoBaby', price: 379.99, originalPrice: 499.99, discount: 24, description: 'Lightweight stroller with infant car seat and base. One-hand fold.', specs: { weight: '18 lbs', fold: 'One-hand', carSeat: 'Included (4-35 lbs)', canopy: 'UPF 50+', wheels: 'All-terrain' } }
  ];

  for (const [i, p] of babyProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Baby', i + 1);
    const images = await getProductImagesRL(p.name, 'Baby', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Baby',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 30) + 10,
      sku: generateSKU('Baby', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['baby', 'nursery', 'parenting'],
      rating: (Math.random() * 1.0 + 4.0).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 120) + 20,
      seller: { name: 'Baby Bliss', rating: 4.7 }
    });
  }

  // SPORTS - 5 products
  const sportsProducts = [
    { name: 'Pro Tennis Racket', brand: 'Wilson', price: 229.99, originalPrice: 279.99, discount: 18, description: 'Tournament-grade racket with graphite frame. Used by pros worldwide.', specs: { weight: '305g', headSize: '97 sq in', pattern: '16x19', balance: '31.5cm', material: 'Graphite + Basalt' } },
    { name: 'Running Shoes Marathon', brand: 'Nike', price: 159.99, originalPrice: 189.99, discount: 16, description: 'Lightweight carbon-plated racing shoes for marathon distance. Energy return foam.', specs: { weight: '184g (M9)', drop: '8mm', foam: 'ZoomX', plate: 'Carbon fiber', use: 'Race day' } },
    { name: 'Yoga Mat Premium', brand: 'Manduka', price: 99.99, originalPrice: 129.99, discount: 23, description: 'Lifetime guarantee, closed-cell surface prevents sweat absorption. 6mm thick.', specs: { thickness: '6mm', dimensions: '71"x26"', material: 'PVC-free', weight: '5.5 lbs', guarantee: 'Lifetime' } },
    { name: 'Adjustable Dumbbells Pair', brand: 'Bowflex', price: 349.99, originalPrice: 449.99, discount: 22, description: 'Space-saving adjustable dumbbells replace 15 sets. 5-52.5 lbs each.', specs: { range: '5-52.5 lbs', increments: '2.5 lbs', mechanism: 'Dial system', warranty: '2 years', footprint: 'Compact' } },
    { name: 'Camping Tent 4-Person', brand: 'REI Co-op', price: 279.99, originalPrice: 349.99, discount: 20, description: 'Lightweight backpacking tent with full rainfly. Sets up in 3 minutes.', specs: { capacity: '4 person', weight: '5 lbs 8 oz', packed: '21"x7"', seasons: '3-season', setup: 'Freestanding' } }
  ];

  for (const [i, p] of sportsProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Sports', i + 1);
    const images = await getProductImagesRL(p.name, 'Sports', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Sports',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 25) + 10,
      sku: generateSKU('Sports', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['sports', 'fitness', 'outdoor'],
      rating: (Math.random() * 1.2 + 3.8).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 200) + 30,
      seller: { name: 'SportZone', rating: 4.6 }
    });
  }

  // HEALTH - 4 products
  const healthProducts = [
    { name: 'Digital Blood Pressure Monitor', brand: 'Omron', price: 69.99, originalPrice: 89.99, discount: 22, description: 'Clinically validated upper arm monitor with Bluetooth sync to app.', specs: { type: 'Upper arm', connectivity: 'Bluetooth', memory: '200 readings', cuff: 'Fits 9"-17"', validation: 'FDA cleared' } },
    { name: 'Smart Body Composition Scale', brand: 'Withings', price: 129.99, originalPrice: 159.99, discount: 19, description: 'Wi-Fi scale measuring weight, body fat, muscle, water, bone mass. App sync.', specs: { metrics: '8 body metrics', connectivity: 'Wi-Fi + Bluetooth', users: 'Unlimited', display: 'Color LED', battery: '1 year' } },
    { name: 'Pulse Oximeter Fingertip', brand: 'Zacurate', price: 24.99, originalPrice: 34.99, discount: 29, description: 'Accurate SpO2 and pulse rate reading in seconds. Large LED display.', specs: { measure: 'SpO2 + Pulse Rate', accuracy: '±2%', display: 'OLED', battery: '40 hours', autoOff: 'Yes' } },
    { name: 'Massage Gun Pro', brand: 'Theragun', price: 399.99, originalPrice: 499.99, discount: 20, description: 'Deep tissue percussion therapy. 5 speeds, 4 attachments, quiet motor.', specs: { speeds: '5 (1750-2400 RPM)', amplitude: '16mm', attachments: '4', battery: '150 mins', noise: 'QuietForce' } }
  ];

  for (const [i, p] of healthProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Health', i + 1);
    const images = await getProductImagesRL(p.name, 'Health', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Health',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 30) + 15,
      sku: generateSKU('Health', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['health', 'wellness', 'medical'],
      rating: (Math.random() * 1.0 + 4.0).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 150) + 25,
      seller: { name: 'HealthFirst', rating: 4.7 }
    });
  }

  // JEWELLERY - 4 products
  const jewelleryProducts = [
    { name: '14K Gold Diamond Pendant', brand: 'LuxeGems', price: 599.99, originalPrice: 799.99, discount: 25, description: 'Ethically sourced 0.5ct diamond in 14K white gold. Includes 18" chain.', specs: { metal: '14K White Gold', diamond: '0.5ct, VS1, G-H', chain: '18" cable chain', certification: 'GIA', clasp: 'Spring ring' } },
    { name: 'Sterling Silver Hoop Earrings', brand: 'ArgentShine', price: 89.99, originalPrice: 119.99, discount: 25, description: 'Classic medium hoops in 925 sterling silver. Rhodium plated for shine.', specs: { metal: '925 Sterling Silver', plating: 'Rhodium', diameter: '25mm', width: '4mm', closure: 'Lever back' } },
    { name: 'Pearl Strand Necklace', brand: 'OceanPearls', price: 299.99, originalPrice: 399.99, discount: 25, description: 'AAA quality freshwater pearls with silk knotting. 18" length with clasp.', specs: { pearls: 'Freshwater, AAA', size: '7-7.5mm', length: '18"', knotting: 'Silk between each', clasp: '14K gold filled' } },
    { name: 'Men\'s Tungsten Wedding Band', brand: 'TitanBands', price: 149.99, originalPrice: 199.99, discount: 25, description: 'Scratch-resistant tungsten carbide with comfort fit. Lifetime warranty.', specs: { material: 'Tungsten Carbide', width: '8mm', fit: 'Comfort fit', finish: 'Brushed', warranty: 'Lifetime', hypoallergenic: 'Yes' } }
  ];

  for (const [i, p] of jewelleryProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Jewellery', i + 1);
    const images = await getProductImagesRL(p.name, 'Jewellery', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Jewellery',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 15) + 5,
      sku: generateSKU('Jewellery', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['jewellery', 'accessories', 'gifts'],
      rating: (Math.random() * 0.8 + 4.2).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 80) + 15,
      seller: { name: 'GemStone', rating: 4.9 }
    });
  }

  // KITCHEN - 5 products
  const kitchenProducts = [
    { name: 'Stand Mixer 5-Quart', brand: 'KitchenAid', price: 379.99, originalPrice: 449.99, discount: 16, description: 'Iconic tilt-head stand mixer with 10 speeds. 5-qt stainless bowl included.', specs: { capacity: '5 quarts', speeds: '10', motor: '325W', bowl: 'Stainless steel', attachments: '3 included', colors: '20+ options' } },
    { name: 'Air Fryer XL 8-Quart', brand: 'Ninja', price: 149.99, originalPrice: 199.99, discount: 25, description: 'Dual-zone technology cooks two foods at once. 6 cooking functions.', specs: { capacity: '8 quarts', zones: '2 independent', functions: 'Air fry, roast, bake, reheat, dehydrate', temp: '105-450°F', dishwasher: 'Yes' } },
    { name: 'Chef\'s Knife Set 7-Piece', brand: 'Wüsthof', price: 299.99, originalPrice: 399.99, discount: 25, description: 'German forged high-carbon stainless steel. Full tang, triple-riveted handles.', specs: { pieces: '7 knives + block', steel: 'High-carbon stainless', handle: 'Polyoxymethylene', forged: 'Yes', warranty: 'Lifetime', origin: 'Solingen, Germany' } },
    { name: 'Espresso Machine Semi-Auto', brand: 'Breville', price: 599.99, originalPrice: 749.99, discount: 20, description: 'Barista-quality espresso with PID temperature control. Built-in grinder.', specs: { pressure: '15 bar Italian pump', grinder: 'Conical burr', boiler: 'Thermocoil', milk: 'Steam wand', programmability: 'Volumetric' } },
    { name: 'Instant Pot Pro 8-Quart', brand: 'Instant Pot', price: 139.99, originalPrice: 179.99, discount: 22, description: '10-in-1 multi-cooker: pressure cook, slow cook, sauté, steam, yogurt, more.', specs: { capacity: '8 quarts', functions: '10-in-1', pressure: '15 psi', innerPot: 'Stainless steel', smart: 'App + WiFi', safety: '10+ features' } }
  ];

  for (const [i, p] of kitchenProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Kitchen', i + 1);
    const images = await getProductImagesRL(p.name, 'Kitchen', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Kitchen',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 25) + 10,
      sku: generateSKU('Kitchen', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['kitchen', 'cooking', 'appliances'],
      rating: (Math.random() * 1.0 + 4.0).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 200) + 30,
      seller: { name: 'Chef\'s Corner', rating: 4.7 }
    });
  }

  // CAMERAS - 4 products
  const camerasProducts = [
    { name: 'Mirrorless Camera R6 Mark II', brand: 'Canon', price: 2499.99, originalPrice: 2799.99, discount: 11, description: 'Full-frame 24MP with 40fps electronic shutter. Incredible low-light performance.', specs: { sensor: '24MP Full-frame', mount: 'RF', video: '4K 60p', af: 'Dual Pixel CMOS AF II', ibis: '8-stop', shutter: '40fps electronic' } },
    { name: 'Alpha 7 IV Mirrorless', brand: 'Sony', price: 2499.99, originalPrice: 2799.99, discount: 11, description: '33MP full-frame hybrid for photo and video. Real-time tracking AF.', specs: { sensor: '33MP Full-frame', mount: 'E-mount', video: '4K 60p 10-bit', af: 'Real-time Tracking', ibis: '5.5-stop', card: 'CFexpress A + SD' } },
    { name: 'Z9 Flagship Mirrorless', brand: 'Nikon', price: 5499.99, originalPrice: 5999.99, discount: 8, description: '45.7MP stacked sensor, 120fps, 8K video. No mechanical shutter.', specs: { sensor: '45.7MP Stacked', mount: 'Z', video: '8K 30p', af: '3D Tracking', shutter: 'Electronic only', fps: '120fps' } },
    { name: 'X-T5 APS-C Mirrorless', brand: 'Fujifilm', price: 1699.99, originalPrice: 1999.99, discount: 15, description: '40MP APS-C in compact body. Film simulations and IBIS. Great value.', specs: { sensor: '40MP APS-C', mount: 'X', video: '6.2K 30p', af: 'Subject detection', ibis: '7-stop', filmSim: '19 modes' } }
  ];

  for (const [i, p] of camerasProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Cameras', i + 1);
    const images = await getProductImagesRL(p.name, 'Cameras', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Cameras',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 10) + 3,
      sku: generateSKU('Cameras', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['camera', 'photography', 'video'],
      rating: (Math.random() * 0.8 + 4.2).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 100) + 20,
      seller: { name: 'PhotoPro', rating: 4.8 }
    });
  }

  // FOOD - 5 products
  const foodProducts = [
    { name: 'Organic Extra Virgin Olive Oil', brand: 'Mediterra', price: 24.99, originalPrice: 32.99, discount: 24, description: 'Cold-pressed single-origin EVOO from Koroneiki olives. Polyphenol rich.', specs: { type: 'Extra Virgin', origin: 'Kalamata, Greece', variety: 'Koroneiki', harvest: '2023-2024', acidity: '<0.3%', size: '500ml' } },
    { name: 'Artisan Dark Chocolate 70%', brand: 'CacaoLab', price: 12.99, originalPrice: 16.99, discount: 24, description: 'Bean-to-bar single origin Ecuadorian cacao. Notes of floral and citrus.', specs: { cacao: '70%', origin: 'Esmeraldas, Ecuador', ingredients: 'Cacao, cane sugar, cocoa butter', weight: '80g', certifications: 'Organic, Fair Trade' } },
    { name: 'Specialty Coffee Beans 1lb', brand: 'Blue Bottle', price: 19.99, originalPrice: 24.99, discount: 20, description: 'Freshly roasted Ethiopian Yirgacheffe. Bright floral notes, tea-like body.', specs: { origin: 'Yirgacheffe, Ethiopia', roast: 'Light-Medium', process: 'Washed', notes: 'Jasmine, bergamot, peach', roasted: 'Within 48 hours', size: '12oz' } },
    { name: 'Manuka Honey UMF 15+', brand: 'Comvita', price: 49.99, originalPrice: 64.99, discount: 23, description: 'Certified UMF 15+ Manuka honey from New Zealand. Independently tested.', specs: { umf: '15+', mg: '514+', origin: 'New Zealand', size: '250g', certification: 'UMFHA licensed', grade: 'Monofloral' } },
    { name: 'Organic Quinoa 2lb', brand: 'Ancient Harvest', price: 14.99, originalPrice: 19.99, discount: 25, description: 'Royal white quinoa, pre-washed. Complete protein, gluten-free, non-GMO.', specs: { type: 'Royal White', origin: 'Bolivia', washed: 'Pre-washed', protein: '8g per serving', certifications: 'USDA Organic, Non-GMO', size: '2 lbs' } }
  ];

  for (const [i, p] of foodProducts.entries()) {
    const image = await getProductImageRL(p.name, 'Food', i + 1);
    const images = await getProductImagesRL(p.name, 'Food', i + 1);
    products.push({
      name: p.name,
      description: p.description,
      category: 'Food',
      price: p.price,
      originalPrice: p.originalPrice,
      discount: p.discount,
      quantity: Math.floor(Math.random() * 100) + 50,
      sku: generateSKU('Food', productIndex++),
      brand: p.brand,
      specifications: p.specs,
      image,
      images,
      tags: ['food', 'grocery', 'organic'],
      rating: (Math.random() * 1.0 + 4.0).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 150) + 25,
      seller: { name: 'Gourmet Pantry', rating: 4.7 }
    });
  }

  return products;
};

// Main migration function
const runMigration = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully!');

    const products = await generateProducts();
    console.log(`Generated ${products.length} products across ${CATEGORIES.length} categories`);

    // Count by category
    const categoryCounts = {};
    products.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    console.log('Products per category:', categoryCounts);

    // Clear existing products to avoid duplicates
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Insert products in batches
    const batchSize = 20;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      try {
        const result = await Product.insertMany(batch, { ordered: false });
        inserted += result.length;
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}: ${result.length} products`);
      } catch (batchError) {
        // Handle duplicate key errors (SKU unique constraint)
        if (batchError.writeErrors) {
          const successful = batch.length - batchError.writeErrors.length;
          inserted += successful;
          errors += batchError.writeErrors.length;
          console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${successful} inserted, ${batchError.writeErrors.length} duplicates skipped`);
        } else {
          console.error(`Batch ${Math.floor(i/batchSize) + 1} failed:`, batchError.message);
          errors += batch.length;
        }
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total products inserted: ${inserted}`);
    console.log(`Errors/duplicates skipped: ${errors}`);
    console.log(`Total products in database: ${await Product.countDocuments()}`);

    // Show sample products
    const sampleProducts = await Product.find().limit(3).select('name category price discount image');
    console.log('\nSample products:');
    sampleProducts.forEach(p => {
      console.log(`  - ${p.name} (${p.category}) - $${p.price} (${p.discount}% off)`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
};

// Run the migration
runMigration();