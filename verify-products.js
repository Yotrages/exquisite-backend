const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const Product = require('./Models/Product');

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);

  // Check products by category
  const categories = ['Fashion', 'Electronics', 'Phones', 'Home', 'Books', 'Baby', 'Sports', 'Health', 'Jewellery', 'Kitchen', 'Cameras', 'Food'];

  for (const cat of categories) {
    const products = await Product.find({ category: cat }).select('name price discount image brand').limit(3);
    console.log(`\n=== ${cat} (${products.length} shown) ===`);
    products.forEach(p => {
      console.log(`  - ${p.name} | $${p.price} | ${p.discount}% off | ${p.brand} | ${p.image.substring(0,60)}...`);
    });
  }

  const total = await Product.countDocuments();
  console.log(`\nTotal products in DB: ${total}`);

  await mongoose.disconnect();
}

verify().catch(console.error);