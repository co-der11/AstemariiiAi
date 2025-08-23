require('dotenv').config();
const { Telegraf, session } = require('telegraf'); // Correct import for session middleware
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const config = require('./config/config');
const { app, PORT } = require('./health');

// Import handlers
const { setupAuthHandler } = require('./handlers/authHandler');
const { setupAdminHandler } = require('./handlers/adminHandler');
const { 
  askQuestionHandler, 
  handleQuestionContent, 
  handleGradeSelection, 
  handleApproval, 
  handleAnswerButton, 
  handleAnswer, 
  handleViewAnswers,
  handleReply,
  handleAnswerReaction,
  handleStartReplyToAnswer
} = require('./handlers/qaHandler');

// Initialize bot
const bot = new Telegraf(config.telegram.token);
bot.use(session()); // Add this line after bot initialization

// Import and use channel subscription middleware
const checkChannelSubscription = require('./middlewares/channelSubscription').default;
bot.use(checkChannelSubscription);

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, config.mongodb.options)
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Setup handlers
logger.info('Setting up bot handlers...');
setupAuthHandler(bot);
logger.info('✅ Auth handler setup complete');
setupAdminHandler(bot);
logger.info('✅ Admin handler setup complete');
logger.info('All handlers setup complete');

// Start command is now handled by authHandler

// Help command
bot.command('help', async (ctx) => {
  try {
    const isAdmin = ctx.from?.id?.toString() === '5752137292';
    const adminLines = isAdmin
      ? '/admin - Admin panel (admin only)\n/checkadmin - Check your admin status\n/setupadmin - Create first admin (initial setup)\n'
      : '';
    await ctx.reply(
      '❓ <b>Help Menu</b>\n\n' +
      '📋 <b>Available Commands:</b>\n' +
      '/start - Start the bot\n' +
      '/ask - Ask questions to the community\n' +
      adminLines +
      '/help - Show this help menu\n\n' +
      '❓ <b>Ask Questions:</b>\n' +
      '1. Use /ask to submit a question\n' +
      '2. Send your question (text, voice, photo, etc.)\n' +
      '3. Select your grade level\n' +
      '4. Wait for admin approval\n' +
      '5. Others can answer your question\n\n' +
      'Need more help? Contact support @astemariAi.',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    logger.error('Error in help command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
});

// QA Handlers
bot.command('ask', askQuestionHandler);

// Handle question content (text, media)
bot.on('text', async (ctx, next) => {
  if (ctx.session?.qaState === 'awaiting_question') {
    return handleQuestionContent(ctx);
  }
  if (ctx.session?.qaState === 'awaiting_answer') {
    return handleAnswer(ctx);
  }
  if (ctx.session?.qaState === 'awaiting_reply') {
    return handleReply(ctx);
  }
  return next();
});

// Handle media for questions and answers
bot.on(['photo', 'video', 'audio', 'voice', 'document'], async (ctx, next) => {
  if (ctx.session?.qaState === 'awaiting_question') {
    return handleQuestionContent(ctx);
  }
  if (ctx.session?.qaState === 'awaiting_answer') {
    return handleAnswer(ctx);
  }
  if (ctx.session?.qaState === 'awaiting_reply') {
    return handleReply(ctx);
  }
  return next();
});

// Handle grade selection callbacks
bot.action(/^grade_/, handleGradeSelection);

// Handle approval callbacks
bot.action(/^(approve_|decline_)[0-9a-fA-F]{24}$/, handleApproval);

// Handle answer button callbacks
bot.action(/^answer_[0-9a-fA-F]{24}$/, handleAnswerButton);

// Handle view answers callbacks
bot.action(/^view_[0-9a-fA-F]{24}$/, handleViewAnswers);
bot.action(/^ans_right_[0-9a-fA-F]{24}_\d+$/, handleAnswerReaction('right'));
bot.action(/^ans_wrong_[0-9a-fA-F]{24}_\d+$/, handleAnswerReaction('wrong'));
bot.action(/^ans_reply_[0-9a-fA-F]{24}_\d+$/, handleStartReplyToAnswer);

// Handle reply callbacks
bot.action(/^reply_[0-9a-fA-F]{24}_\d+$/, async (ctx) => {
  try {
    const parts = ctx.callbackQuery.data.split('_');
    const questionId = parts[1];
    const answerIndex = parseInt(parts[2]);
    
    ctx.session = ctx.session || {};
    ctx.session.qaState = 'awaiting_reply';
    ctx.session.replyingToAnswer = { questionId, answerIndex };
    
    await ctx.reply(
      '💬 <b>Reply to Answer</b>\n\n' +
      'Type your reply below. You can send text, voice, photo, video, or document.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [['❌ Cancel Reply']],
          resize_keyboard: true
        }
      }
    );
    
    await ctx.answerCbQuery();
  } catch (error) {
    logger.error('Error handling reply callback:', error);
    await ctx.answerCbQuery('❌ Error processing reply request');
  }
});

// Handle back to main menu
bot.action('back_to_main', async (ctx) => {
  try {
    await ctx.editMessageText(
      '🎓 <b>Student Helper Bot</b>\n\n' +
      'Welcome! I\'m here to help you with your academic journey.\n\n' +
      '❓ <b>Q&A Community</b> - Ask questions and get answers from the community\n\n' +
      'Choose an option to get started:',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❓ Ask Question', callback_data: 'ask_question_menu' }],
            [{ text: '❓ Help', callback_data: 'help_menu' }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error in back to main menu:', error);
    await ctx.answerCbQuery('❌ An error occurred. Please try again.');
  }
});

// Handle start asking question
bot.action('start_asking', async (ctx) => {
  try {
    await ctx.editMessageText(
      '❓ <b>Ask a Question</b>\n\n' +
      'You can send your question as text, video, document, or voice.\n\n' +
      '💡 Tips for a good question:\n' +
      '• Include all necessary details\n' +
      '• Specify what you\'ve already tried\n' +
      '• Be clear and concise\n\n' +
      'Your question will be reviewed by an admin before being posted.',
      { parse_mode: 'HTML' }
    );
    ctx.session = ctx.session || {};
    ctx.session.qaState = 'awaiting_question';
  } catch (error) {
    logger.error('Error in start asking:', error);
    await ctx.answerCbQuery('❌ An error occurred. Please try again.');
  }
});

// Handle my questions
bot.action('my_questions', async (ctx) => {
  try {
    await ctx.editMessageText(
      '📋 <b>My Questions</b>\n\n' +
      'Here are your submitted questions:\n\n' +
      'Use /ask to submit a new question!',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    logger.error('Error in my questions:', error);
    await ctx.answerCbQuery('❌ An error occurred. Please try again.');
  }
});

// (Tutorial-related actions removed for QA-only mode)

// Handle cancel callbacks
bot.action('cancel_question', async (ctx) => {
  ctx.session.qaState = null;
  ctx.session.questionData = null;
  await ctx.editMessageText('❌ Question cancelled.');
  await ctx.answerCbQuery();
});

// (Expert support and tutorial menus removed for QA-only mode)

bot.action('ask_question_menu', async (ctx) => {
  try {
    await ctx.editMessageText(
      '❓ <b>Ask a Question</b>\n\n' +
      'Ask questions to the community and get answers from other students and tutors.\n\n' +
      '📋 <b>How it works:</b>\n' +
      '1. Send your question (text, voice, photo, video, document)\n' +
      '2. Select your grade level\n' +
      '3. Wait for admin approval\n' +
      '4. Your question will be posted to the community\n' +
      '5. Others can answer your question\n\n' +
      '💡 <b>Tips for a good question:</b>\n' +
      '• Include all necessary details\n' +
      '• Specify what you\'ve already tried\n' +
      '• Be clear and concise\n\n' +
      'Ready to ask your question?',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❓ Ask Question', callback_data: 'start_asking' }],
            [{ text: '📋 My Questions', callback_data: 'my_questions' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error in ask question menu:', error);
    await ctx.answerCbQuery('❌ An error occurred. Please try again.');
  }
});

bot.action('help_menu', async (ctx) => {
  try {
    const isAdmin = ctx.from?.id?.toString() === '5752137292';
    const adminLines = isAdmin
      ? '/admin - Admin panel (admin only)\n/checkadmin - Check your admin status\n/setupadmin - Create first admin (initial setup)\n'
      : '';
    await ctx.editMessageText(
      '❓ <b>Help Menu</b>\n\n' +
      '📋 <b>Available Commands:</b>\n' +
      '/start - Start the bot\n' +
      '/ask - Ask questions to the community\n' +
      adminLines +
      '/help - Show this help menu\n\n' +
      '💡 <b>How to use:</b>\n\n' +
      '❓ <b>Ask Questions:</b>\n' +
      '1. Use /ask to submit a question\n' +
      '2. Send your question (text, voice, photo, etc.)\n' +
      '3. Select your grade level\n' +
      '4. Wait for admin approval\n' +
      '5. Others can answer your question\n\n' +
      'Need more help? Contact support @union_supports.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error in help menu:', error);
    await ctx.answerCbQuery('❌ An error occurred. Please try again.');
  }
});

// Note: Keyboard button handlers removed - now using inline callback handlers

// Error handling
bot.catch((err, ctx) => {
  logger.error(`Bot error for ${ctx.updateType}:`, err);
});

// Start the bot
logger.info('Launching bot...');
bot.launch()
  .then(() => {
    logger.info('✅ Bot started successfully');
    logger.info('📋 Available commands: /start, /help, /admin, /checkadmin, /setupadmin, /makeadmin, /listadmins');
    
    // Start health check server for Render
    app.listen(PORT, () => {
      logger.info(`🌐 Health check server running on port ${PORT}`);
      logger.info(`🔍 Health check available at: http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    logger.error('❌ Error starting bot:', error);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  mongoose.connection.close();
  logger.info('Bot stopped gracefully');
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  mongoose.connection.close();
  logger.info('Bot stopped gracefully');
});

