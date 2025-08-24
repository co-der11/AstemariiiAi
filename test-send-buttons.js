require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

console.log('🧪 Testing Button Sending');
console.log('=========================\n');

async function testButtons() {
  try {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    // Get bot info first
    const botInfo = await bot.telegram.getMe();
    console.log(`✅ Bot info: @${botInfo.username} (${botInfo.first_name})`);
    
    // Test channel link
    const channelLink = process.env.TELEGRAM_CHANNEL_LINK || process.env.TELEGRAM_ADMIN_CHANNEL_LINK;
    console.log(`📢 Channel link: ${channelLink}`);
    
    // Create the message with buttons
    const messageText = '🎓 <b>Welcome to Student Helper Bot!</b>\n\n' +
                       'To get started, please complete these steps:\n\n' +
                       '1️⃣ Subscribe to our channel\n' +
                       '2️⃣ Share your contact information\n\n' +
                       "Let's begin with channel subscription:";
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('📢 Join Channel', channelLink)],
      [Markup.button.callback("✅ I'm Subscribed", 'check_subscription')]
    ]);
    
    console.log('📋 Message structure:');
    console.log('   Text length:', messageText.length);
    console.log('   Keyboard:', JSON.stringify(keyboard, null, 2));
    
    console.log('\n💡 To test the buttons:');
    console.log('   1. Send /start to your bot');
    console.log('   2. You should see the welcome message with two buttons');
    console.log('   3. The buttons should be: "📢 Join Channel" and "✅ I\'m Subscribed"');
    
    // Test if we can create the message structure
    const testMessage = {
      text: messageText,
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    };
    
    console.log('\n✅ Message structure created successfully');
    console.log('   Has reply_markup:', !!testMessage.reply_markup);
    console.log('   Inline keyboard rows:', testMessage.reply_markup.inline_keyboard.length);
    
    // Check each button
    testMessage.reply_markup.inline_keyboard.forEach((row, rowIndex) => {
      row.forEach((button, buttonIndex) => {
        console.log(`   Button ${rowIndex + 1}.${buttonIndex + 1}: ${button.text} (${button.url ? 'URL' : 'callback'})`);
      });
    });
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testButtons();
