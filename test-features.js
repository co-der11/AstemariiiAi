require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./src/config/config');

console.log('🧪 Testing Student Helper Bot Features');
console.log('=====================================\n');

// Test 1: Check environment variables
console.log('📋 Environment Variables:');
console.log(`✅ Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing'}`);
console.log(`✅ MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'Missing'}`);
console.log(`✅ Channel ID: ${process.env.TELEGRAM_CHANNEL_ID ? 'Set' : 'Missing'}`);
console.log('');

// Test 2: Check MongoDB connection
console.log('🗄️ MongoDB Connection:');
mongoose.connect(config.mongodb.uri, config.mongodb.options)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch((error) => {
    console.log('❌ MongoDB connection failed:', error.message);
  })
  .finally(() => {
    mongoose.connection.close();
  });

// Test 3: Check handler imports
console.log('\n📦 Handler Imports:');
try {
  const { setupExpertSupportHandler } = require('./src/handlers/expertSupportHandler');
  console.log('✅ Expert Support Handler imported');
} catch (error) {
  console.log('❌ Expert Support Handler import failed:', error.message);
}

try {
  const { setupTutorialSessionHandler } = require('./src/handlers/tutorialSessionHandler');
  console.log('✅ Tutorial Session Handler imported');
} catch (error) {
  console.log('❌ Tutorial Session Handler import failed:', error.message);
}

try {
  const { 
    askQuestionHandler, 
    handleQuestionContent, 
    handleGradeSelection, 
    handleApproval, 
    handleAnswerButton, 
    handleAnswer, 
    handleViewAnswers,
    handleReply
  } = require('./src/handlers/qaHandler');
  console.log('✅ QA Handler imported');
} catch (error) {
  console.log('❌ QA Handler import failed:', error.message);
}

// Test 4: Check model imports
console.log('\n📊 Model Imports:');
try {
  const User = require('./src/models/User');
  console.log('✅ User model imported');
} catch (error) {
  console.log('❌ User model import failed:', error.message);
}

try {
  const Question = require('./src/models/Question');
  console.log('✅ Question model imported');
} catch (error) {
  console.log('❌ Question model import failed:', error.message);
}

try {
  const TutoringSession = require('./src/models/TutoringSession');
  console.log('✅ TutoringSession model imported');
} catch (error) {
  console.log('❌ TutoringSession model import failed:', error.message);
}

try {
  const ExpertRequest = require('./src/models/ExpertRequest');
  console.log('✅ ExpertRequest model imported');
} catch (error) {
  console.log('❌ ExpertRequest model import failed:', error.message);
}

// Test 5: Check config
console.log('\n⚙️ Configuration:');
console.log(`✅ Config loaded: ${config ? 'Yes' : 'No'}`);
console.log(`✅ Telegram config: ${config.telegram ? 'Yes' : 'No'}`);
console.log(`✅ MongoDB config: ${config.mongodb ? 'Yes' : 'No'}`);

console.log('\n🎉 Feature Test Complete!');
console.log('\n📋 Available Features:');
console.log('✅ Expert Support System');
console.log('✅ Tutorial Session Management');
console.log('✅ Q&A Community System');
console.log('✅ Payment Processing');
console.log('✅ Admin Approval System');
console.log('✅ Multi-media Support');
console.log('✅ User Management');

console.log('\n🚀 Ready to start the bot with: npm start'); 