require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

console.log('🧪 Testing Inline Keyboard Buttons');
console.log('==================================\n');

// Test 1: Check environment variables
console.log('✅ Test 1: Environment Variables');
console.log('   TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing');
console.log('   TELEGRAM_CHANNEL_LINK:', process.env.TELEGRAM_CHANNEL_LINK ? 'Set' : 'Missing');
console.log('   TELEGRAM_ADMIN_CHANNEL_LINK:', process.env.TELEGRAM_ADMIN_CHANNEL_LINK ? 'Set' : 'Missing');

// Test 2: Create inline keyboard
console.log('\n✅ Test 2: Creating Inline Keyboard');
try {
  const channelLink = process.env.TELEGRAM_CHANNEL_LINK || process.env.TELEGRAM_ADMIN_CHANNEL_LINK;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('📢 Join Channel', channelLink || 'https://t.me/test')],
    [Markup.button.callback("✅ I'm Subscribed", 'check_subscription')]
  ]);
  
  console.log('   Keyboard created successfully');
  console.log('   Channel Link:', channelLink || 'Using fallback');
  console.log('   Keyboard structure:', JSON.stringify(keyboard, null, 2));
} catch (error) {
  console.log('   ❌ Error creating keyboard:', error.message);
}

// Test 3: Test message structure
console.log('\n✅ Test 3: Message Structure');
try {
  const channelLink = process.env.TELEGRAM_CHANNEL_LINK || process.env.TELEGRAM_ADMIN_CHANNEL_LINK;
  
  const messageStructure = {
    text: '🎓 <b>Welcome to Student Helper Bot!</b>\n\n' +
          'To get started, please complete these steps:\n\n' +
          '1️⃣ Subscribe to our channel\n' +
          '2️⃣ Share your contact information\n\n' +
          "Let's begin with channel subscription:",
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📢 Join Channel', channelLink || 'https://t.me/test')],
      [Markup.button.callback("✅ I'm Subscribed", 'check_subscription')]
    ])
  };
  
  console.log('   Message structure created successfully');
  console.log('   Text length:', messageStructure.text.length);
  console.log('   Parse mode:', messageStructure.parse_mode);
  console.log('   Has reply_markup:', !!messageStructure.reply_markup);
} catch (error) {
  console.log('   ❌ Error creating message structure:', error.message);
}

console.log('\n🏁 Button test completed!');
console.log('💡 If all tests pass, the buttons should work correctly.');
