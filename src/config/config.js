require('dotenv').config();

// Add debug logging for channel configuration
console.log('🔍 Environment Variables Debug:');
console.log('TELEGRAM_CHANNEL_ID:', process.env.TELEGRAM_CHANNEL_ID ? 'Set' : 'Missing');
console.log('TELEGRAM_CHANNEL_ID value:', process.env.TELEGRAM_CHANNEL_ID);
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing');

const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
    channelLink: process.env.TELEGRAM_CHANNEL_LINK || process.env.TELEGRAM_ADMIN_CHANNEL_LINK,
    adminIds: (process.env.ADMIN_IDS || '5752137292').split(',').map(id => id.trim())
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://amirhusengh:10203040Ye@cluster0.qjwdzxl.mongodb.net/studenthelperbot?retryWrites=true&w=majority&appName=Cluster0',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 1
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'bot.log'
  }
};

module.exports = config; 