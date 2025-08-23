require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Markup } = require('telegraf');

console.log('🧪 Testing Bot Startup and Inline Keyboard...\n');

// Test 1: Basic bot initialization
console.log('✅ Test 1: Bot initialization');
try {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'test_token');
  console.log('   Bot created successfully');
} catch (error) {
  console.log('   ❌ Bot creation failed:', error.message);
}

// Test 2: Inline keyboard creation
console.log('\n✅ Test 2: Inline keyboard creation');
try {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('📢 Join Channel', 'https://t.me/testchannel')],
    [Markup.button.callback("✅ I'm Subscribed", 'check_subscription')]
  ]);
  console.log('   Inline keyboard created successfully');
  console.log('   Keyboard structure:', JSON.stringify(keyboard, null, 2));
} catch (error) {
  console.log('   ❌ Inline keyboard creation failed:', error.message);
}

// Test 3: Message with inline keyboard (simulated)
console.log('\n✅ Test 3: Message structure with inline keyboard');
try {
  const messageStructure = {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📢 Join Channel', 'https://t.me/testchannel')],
      [Markup.button.callback("✅ I'm Subscribed", 'check_subscription')]
    ])
  };
  console.log('   Message structure created successfully');
  console.log('   Structure keys:', Object.keys(messageStructure));
  console.log('   Reply markup type:', typeof messageStructure.reply_markup);
} catch (error) {
  console.log('   ❌ Message structure creation failed:', error.message);
}

// Test 4: Check environment variables
console.log('\n✅ Test 4: Environment variables check');
console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing');
console.log('   TELEGRAM_CHANNEL_LINK:', process.env.TELEGRAM_CHANNEL_LINK ? 'Set' : 'Missing');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Missing');

// Test 5: Import test
console.log('\n✅ Test 5: Module imports test');
try {
  const config = require('./src/config/config');
  console.log('   Config loaded successfully');
  console.log('   Channel link:', config.telegram.channelLink || 'Not configured');
} catch (error) {
  console.log('   ❌ Config loading failed:', error.message);
}

console.log('\n🏁 All tests completed!');
console.log('\n📝 If all tests pass, the inline keyboard issue should be resolved.');
console.log('📝 If you still get errors, check the specific error messages above.');
