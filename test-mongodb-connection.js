require('dotenv').config();
const mongoose = require('mongoose');

// Test MongoDB connection
async function testMongoDBConnection() {
  console.log('🔍 Testing MongoDB Connection...\n');
  
  // Display configuration
  const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://amirhusengh:10203040Ye@cluster0.qjwdzxl.mongodb.net/studenthelperbot?retryWrites=true&w=majority&appName=Cluster0';
  console.log('📋 Configuration:');
  console.log(`   MongoDB URI: ${mongoUri ? 'Set' : 'Missing'}`);
  console.log(`   URI Preview: ${mongoUri ? mongoUri.substring(0, 50) + '...' : 'N/A'}`);
  console.log('');
  
  try {
    console.log('🔄 Attempting to connect...');
    
    // Set connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      family: 4,
      maxPoolSize: 5,
      minPoolSize: 1
    };
    
    // Attempt connection
    await mongoose.connect(mongoUri, options);
    
    console.log('✅ MongoDB connection successful!');
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Port: ${mongoose.connection.port}`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Connection State: ${mongoose.connection.readyState}`);
    
    // Test a simple operation
    console.log('\n🧪 Testing database operation...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   Collections found: ${collections.length}`);
    collections.forEach(col => console.log(`   - ${col.name}`));
    
  } catch (error) {
    console.log('❌ MongoDB connection failed!');
    console.log(`   Error: ${error.message}`);
    console.log('');
    
    // Provide troubleshooting tips
    console.log('🔧 Troubleshooting Tips:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify MongoDB Atlas cluster is running');
    console.log('   3. Ensure your IP is whitelisted in MongoDB Atlas');
    console.log('   4. Check username/password in connection string');
    console.log('   5. Verify cluster name and database name');
    console.log('');
    
    if (error.message.includes('IP that isn\'t whitelisted')) {
      console.log('🚨 IP WHITELIST ISSUE DETECTED!');
      console.log('   Go to MongoDB Atlas → Network Access → Add IP Address');
      console.log('   Add your current IP address or use "Add Current IP Address"');
    }
    
    if (error.message.includes('authentication failed')) {
      console.log('🚨 AUTHENTICATION ISSUE DETECTED!');
      console.log('   Check your MongoDB username and password');
      console.log('   Verify the user has access to the database');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('🚨 NETWORK RESOLUTION ISSUE DETECTED!');
      console.log('   Check your internet connection');
      console.log('   Verify the MongoDB Atlas cluster URL is correct');
    }
    
  } finally {
    // Close connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Connection closed');
    }
    
    console.log('\n🏁 Test completed');
    process.exit(0);
  }
}

// Run the test
testMongoDBConnection().catch(console.error);

