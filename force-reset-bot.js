require('dotenv').config();
const { Telegraf } = require('telegraf');

console.log('🔄 Force Reset Bot Script');
console.log('========================\n');

async function forceResetBot() {
  try {
    // Create a temporary bot instance
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    console.log('🧹 Step 1: Cleaning up webhook...');
    await bot.telegram.deleteWebhook();
    console.log('✅ Webhook cleaned up');
    
    console.log('⏳ Step 2: Waiting 5 seconds for Telegram servers...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🔄 Step 3: Getting bot info...');
    const botInfo = await bot.telegram.getMe();
    console.log(`✅ Bot info: @${botInfo.username} (${botInfo.first_name})`);
    
    console.log('📊 Step 4: Getting webhook info...');
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log(`ℹ️ Webhook URL: ${webhookInfo.url || 'None'}`);
    console.log(`ℹ️ Pending updates: ${webhookInfo.pending_update_count || 0}`);
    
    console.log('⏳ Step 5: Waiting another 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🧹 Step 6: Final webhook cleanup...');
    await bot.telegram.deleteWebhook();
    console.log('✅ Final webhook cleanup completed');
    
    console.log('\n🎯 Force reset completed!');
    console.log('💡 Wait 1-2 minutes, then try starting your bot with: npm start');
    console.log('⚠️  If you still get conflicts, try restarting your computer/terminal');
    
  } catch (error) {
    console.log('❌ Error during force reset:', error.message);
    
    if (error.response && error.response.error_code === 409) {
      console.log('\n🔧 Conflict detected! Try these steps:');
      console.log('   1. Close ALL terminal windows');
      console.log('   2. Wait 5-10 minutes');
      console.log('   3. Open a new terminal');
      console.log('   4. Run this script again');
      console.log('   5. If still failing, restart your computer');
    }
  }
}

// Run force reset
forceResetBot();
