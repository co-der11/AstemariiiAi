const fs = require('fs');
const path = require('path');

console.log('🔧 Student Helper Bot Setup');
console.log('============================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (!envExists) {
  console.log('❌ .env file not found!');
  console.log('\n📝 Please create a .env file with the following content:\n');
  console.log('# Telegram Bot Configuration');
  console.log('# Get your bot token from @BotFather on Telegram');
  console.log('TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here');
  console.log('');
  console.log('# Channel configuration (optional)');
  console.log('TELEGRAM_CHANNEL_ID=your_channel_id_here');
  console.log('TELEGRAM_CHANNEL_LINK=your_channel_link_here');
  console.log('');
  console.log('# Admin user IDs (comma-separated)');
  console.log('ADMIN_IDS=5752137292');
  console.log('');
  console.log('# MongoDB Configuration');
  console.log('MONGODB_URI=mongodb+srv://amirhusengh:10203040Ye@cluster0.qjwdzxl.mongodb.net/studenthelperbot?retryWrites=true&w=majority&appName=Cluster0');
  console.log('');
  console.log('# Logging Configuration');
  console.log('LOG_LEVEL=info');
  console.log('LOG_FILE=bot.log');
  console.log('\n⚠️  IMPORTANT: Replace "your_telegram_bot_token_here" with your actual bot token from @BotFather');
} else {
  console.log('✅ .env file found');
  
  // Load and check environment variables
  require('dotenv').config();
  
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'MONGODB_URI'
  ];
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName] === 'your_telegram_bot_token_here') {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.log('❌ Missing or invalid environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n⚠️  Please update your .env file with the correct values');
  } else {
    console.log('✅ All required environment variables are set');
    console.log('\n🚀 You can now run: npm start');
  }
}

console.log('\n📚 How to get your Telegram Bot Token:');
console.log('1. Open Telegram and search for @BotFather');
console.log('2. Send /newbot command');
console.log('3. Follow the instructions to create your bot');
console.log('4. Copy the token provided by BotFather');
console.log('5. Paste it in your .env file as TELEGRAM_BOT_TOKEN=your_token_here'); 