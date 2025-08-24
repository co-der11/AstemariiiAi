require('dotenv').config();
const { Telegraf } = require('telegraf');

console.log('🛑 Bot Cleanup Script');
console.log('=====================\n');

async function cleanupBot() {
  try {
    // Create a temporary bot instance to clean up webhook
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    console.log('🧹 Cleaning up webhook...');
    await bot.telegram.deleteWebhook();
    console.log('✅ Webhook cleaned up successfully');
    
    console.log('🔄 Getting bot info...');
    const botInfo = await bot.telegram.getMe();
    console.log(`✅ Bot info: @${botInfo.username} (${botInfo.first_name})`);
    
    console.log('📊 Getting webhook info...');
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log(`ℹ️ Webhook URL: ${webhookInfo.url || 'None'}`);
    console.log(`ℹ️ Pending updates: ${webhookInfo.pending_update_count || 0}`);
    
    if (webhookInfo.pending_update_count > 0) {
      console.log('⚠️  There are pending updates. This might cause conflicts.');
      console.log('💡 Wait a few minutes before starting the bot again.');
    }
    
    console.log('\n✅ Cleanup completed successfully!');
    console.log('💡 You can now start your bot with: npm start');
    
  } catch (error) {
    if (error.response && error.response.error_code === 409) {
      console.log('❌ Bot conflict detected!');
      console.log('🔧 This means another instance is running or there are conflicts.');
      console.log('');
      console.log('💡 Solutions:');
      console.log('   1. Close all terminal windows running the bot');
      console.log('   2. Wait 2-3 minutes');
      console.log('   3. Try running this script again');
      console.log('   4. Restart your terminal/computer if needed');
    } else {
      console.log('❌ Error during cleanup:', error.message);
    }
  }
}

// Run cleanup
cleanupBot();
