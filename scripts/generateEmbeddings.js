require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../src/models/businessSchema');
const { generateBusinessEmbeddings } = require('../src/utils/embeddingService');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Generate embeddings for all businesses
async function generateAllEmbeddings() {
  try {
    console.log('\n🚀 Starting embedding generation...\n');

    // Fetch all businesses
    const businesses = await Business.find({});
    console.log(`📊 Found ${businesses.length} businesses\n`);

    if (businesses.length === 0) {
      console.log('⚠️  No businesses found in database');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Process each business
    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i];
      const progress = `[${i + 1}/${businesses.length}]`;

      try {
        console.log(`${progress} Processing: ${business.name}...`);

        // Generate embeddings
        const embeddings = await generateBusinessEmbeddings(business);

        if (embeddings && Object.keys(embeddings).length > 0) {
          // Update business with embeddings
          await Business.findByIdAndUpdate(business._id, embeddings);
          console.log(`${progress} ✅ Success: ${business.name}`);
          successCount++;
        } else {
          console.log(`${progress} ⚠️  No embeddings generated for: ${business.name}`);
          failCount++;
          errors.push({ name: business.name, error: 'No embeddings generated' });
        }
      } catch (error) {
        console.error(`${progress} ❌ Error processing ${business.name}:`, error.message);
        failCount++;
        errors.push({ name: business.name, error: error.message });
      }

      // Add a small delay to avoid overwhelming the system
      if (i < businesses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📈 SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total: ${businesses.length}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors:');
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.name}: ${err.error}`);
      });
    }

    console.log('\n✨ Embedding generation complete!\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  await generateAllEmbeddings();
  await mongoose.connection.close();
  console.log('👋 Disconnected from MongoDB');
  process.exit(0);
}

// Run the script
main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
