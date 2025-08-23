const { Markup } = require('telegraf');
const User = require('../models/User');
const Question = require('../models/Question');
const logger = require('../utils/logger');
const config = require('../config/config');
const mongoose = require('mongoose');

const setupAuthHandler = (bot) => {
  logger.info('Setting up auth handler...');

  // Handle /start command with onboarding
  bot.command('start', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      
      // Validate channel configuration first
      if (!config.telegram.channelLink) {
        logger.error('Channel link not configured in start command', {
          userId: telegramId,
          channelLink: config.telegram.channelLink
        });
        await ctx.reply(
          '❌ <b>Bot Configuration Error</b>\n\n' +
          'The bot is not properly configured. Please contact an administrator.',
          { parse_mode: 'HTML' }
        );
        return;
      }
      
      // Capture deep-link payload like: /start answer_<id>
      const rawText = ctx.message?.text || '';
      const possiblePayload = rawText.split(' ').slice(1).join(' ').trim();
      const startPayload = (ctx.startPayload || possiblePayload || '').trim();
      if (startPayload && startPayload.startsWith('answer_')) {
        const answerId = startPayload.replace('answer_', '').trim();
        ctx.session = ctx.session || {};
        ctx.session.deepLink = { action: 'answer', questionId: answerId };
      }
      if (startPayload && startPayload.startsWith('view_')) {
        const viewId = startPayload.replace('view_', '').trim();
        ctx.session = ctx.session || {};
        ctx.session.deepLink = { action: 'view', questionId: viewId };
      }
      
      // Create or update user
      let user;
      try {
        user = await User.createOrUpdate(ctx.from);
        logger.info('User created/updated successfully', { userId: telegramId });
      } catch (userError) {
        logger.error('Error creating/updating user:', {
          error: userError.message,
          userId: telegramId
        });
        await ctx.reply(
          '❌ <b>Error Creating User</b>\n\n' +
          'There was an error setting up your account. Please try again or contact support.',
          { parse_mode: 'HTML' }
        );
        return;
      }
      
      // Check if user has completed onboarding
      if (user.onboardingCompleted) {
        // If deep link to answer exists, start answer flow directly
        if (ctx.session?.deepLink?.action === 'answer' && ctx.session.deepLink.questionId) {
          await startAnswerFlow(ctx, ctx.session.deepLink.questionId);
          return;
        }
        if (ctx.session?.deepLink?.action === 'view' && ctx.session.deepLink.questionId) {
          await showAnswersFlow(ctx, ctx.session.deepLink.questionId);
          return;
        }
        // Otherwise show main menu
        return showMainMenu(ctx);
      }
      
      // Start onboarding process
      try {
        // Check if we have channel configuration
        if (!config.telegram.channelLink) {
          // Fallback onboarding without channel subscription
          await ctx.reply(
            '🎓 <b>Welcome to Student Helper Bot!</b>\n\n' +
            '⚠️ <b>Note:</b> Channel subscription is not configured.\n\n' +
            '📱 <b>Next Step: Share Contact</b>\n\n' +
            'Please share your contact information to complete the setup.',
            {
              parse_mode: 'HTML',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('📱 Share Contact', 'share_contact')],
                [Markup.button.callback('❌ Cancel', 'cancel_onboarding')]
              ])
            }
          );
          
          // Show contact keyboard
          await ctx.reply(
            '📱 Share your contact using the button below:',
            {
              parse_mode: 'HTML',
              reply_markup: {
                keyboard: [[{ text: '📱 Share My Contact', request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: false
              }
            }
          );
          return;
        }
        
        await ctx.reply(
          '🎓 <b>Welcome to Student Helper Bot!</b>\n\n' +
          'To get started, please complete these steps:\n\n' +
          '1️⃣ Subscribe to our channel\n' +
          '2️⃣ Share your contact information\n\n' +
          "Let's begin with channel subscription:",
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.url('📢 Join Channel', config.telegram.channelLink)],
              [Markup.button.callback("✅ I'm Subscribed", 'check_subscription')]
            ])
          }
        );
      } catch (replyError) {
        logger.error('Error sending welcome message:', {
          error: replyError.message,
          userId: telegramId,
          channelLink: config.telegram.channelLink
        });
        
        // Fallback message if the main message fails
        await ctx.reply(
          '🎓 <b>Welcome to Student Helper Bot!</b>\n\n' +
          'Please contact an administrator to complete your setup.',
          { parse_mode: 'HTML' }
        );
      }
    } catch (error) {
      logger.error('Error in start command:', {
        error: error.message,
        stack: error.stack,
        userId: ctx.from?.id
      });
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  });

  // Simple config test command (no database required)
  bot.command('testconfig', async (ctx) => {
    try {
      const configStatus = {
        botToken: config.telegram.token ? '✅ Set' : '❌ Missing',
        channelId: config.telegram.channelId ? '✅ Set' : '❌ Missing',
        channelLink: config.telegram.channelLink ? '✅ Set' : '❌ Missing',
        mongoUri: config.mongodb.uri ? '✅ Set' : '❌ Missing'
      };
      
      await ctx.reply(
        '🔍 <b>Configuration Test</b>\n\n' +
        `Bot Token: ${configStatus.botToken}\n` +
        `Channel ID: ${configStatus.channelId}\n` +
        `Channel Link: ${configStatus.channelLink}\n` +
        `MongoDB URI: ${configStatus.mongoUri}\n\n` +
        'If any show ❌ Missing, check your environment variables.',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Error in testconfig command:', error);
      await ctx.reply('❌ Error testing configuration.');
    }
  });

  // Debug command for troubleshooting (admin only)
  bot.command('debug', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const user = await User.findOne({ telegramId });
      
      if (!user || !user.isAdmin) {
        return ctx.reply('❌ This command is for administrators only.');
      }
      
      const debugInfo = {
        userId: telegramId,
        channelId: config.telegram.channelId,
        channelLink: config.telegram.channelLink,
        botToken: config.telegram.token ? 'Set' : 'Missing',
        hasChannelId: !!config.telegram.channelId,
        hasChannelLink: !!config.telegram.channelLink,
        envChannelId: process.env.TELEGRAM_CHANNEL_ID ? 'Set' : 'Missing',
        envChannelLink: process.env.TELEGRAM_CHANNEL_LINK ? 'Set' : 'Missing'
      };
      
      await ctx.reply(
        '🔍 <b>Debug Information</b>\n\n' +
        `User ID: ${debugInfo.userId}\n` +
        `Channel ID: ${debugInfo.channelId || 'Not set'}\n` +
        `Channel Link: ${debugInfo.channelLink || 'Not set'}\n` +
        `Bot Token: ${debugInfo.botToken}\n` +
        `Has Channel ID: ${debugInfo.hasChannelId}\n` +
        `Has Channel Link: ${debugInfo.hasChannelLink}\n` +
        `ENV Channel ID: ${debugInfo.envChannelId}\n` +
        `ENV Channel Link: ${debugInfo.envChannelLink}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Error in debug command:', error);
      await ctx.reply('❌ Error getting debug info.');
    }
  });

  // Handle channel subscription button
  bot.action('subscribe_channel', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        return ctx.reply('❌ User not found. Please try /start again.');
      }

      // Check if channel is configured
      if (!config.telegram.channelLink) {
        logger.error('Channel link not configured');
        return ctx.reply('❌ Channel not configured. Please contact administrator.');
      }

      await ctx.editMessageText(
        '📢 <b>Channel Subscription Required</b>\n\n' +
        'To use this bot, you need to subscribe to our official channel.\n\n' +
        '📋 <b>Steps:</b>\n' +
        '1. Click the channel link below\n' +
        '2. Join the channel\n' +
        '3. Come back here and click "✅ Check Subscription"\n\n' +
        '🔗 <b>Channel:</b> ' + config.telegram.channelLink,
        {
          parse_mode: 'HTML',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.url('📢 Join Channel', config.telegram.channelLink)],
            [Markup.button.callback('✅ Check Subscription', 'check_subscription')],
            [Markup.button.callback('❌ Cancel', 'cancel_onboarding')]
          ])
        }
      );
    } catch (error) {
      logger.error('Error in subscribe channel action:', error);
      await ctx.answerCbQuery('❌ An error occurred. Please try again.');
    }
  });

  // Handle subscription check
  bot.action('check_subscription', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      
      // Validate channel configuration
      if (!config.telegram.channelLink) {
        logger.error('Channel link not configured in subscription check', {
          userId: telegramId
        });
        await ctx.answerCbQuery('❌ Channel not configured');
        await ctx.reply(
          '❌ <b>Configuration Error</b>\n\n' +
          'The bot is not properly configured. Please contact an administrator.',
          { parse_mode: 'HTML' }
        );
        return;
      }
      
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        logger.error('User not found in subscription check', { userId: telegramId });
        return ctx.reply('❌ User not found. Please try /start again.');
      }

      // Check if user is subscribed
      let isSubscribed = false;
      try {
        isSubscribed = await checkSubscription(ctx);
        logger.info('Subscription check completed', { 
          userId: telegramId, 
          isSubscribed 
        });
      } catch (subError) {
        logger.error('Error checking subscription:', {
          error: subError.message,
          userId: telegramId
        });
        // Default to not subscribed if check fails
        isSubscribed = false;
      }
      
      if (isSubscribed) {
        user.hasSubscribedToChannel = true;
        try {
          await user.save();
          logger.info('User subscription status updated', { userId: telegramId });
        } catch (saveError) {
          logger.error('Error saving user subscription status:', {
            error: saveError.message,
            userId: telegramId
          });
        }
        
        // Move to contact sharing step
        await ctx.reply(
          '✅ <b>Subscription Verified!</b>\n\n' +
          'Great! You\'ve successfully subscribed to our channel.\n\n' +
          '📱 <b>Next Step: Share Contact</b>\n\n' +
          'Please share your contact information to complete the setup.\nTap the button below to continue:',
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('📱 Share Contact', 'share_contact')],
              [Markup.button.callback('❌ Cancel', 'cancel_onboarding')]
            ])
          }
        );

        // Proactively show the contact request keyboard so the button is immediately visible
        await ctx.reply(
          '📱 Share your contact using the button below:',
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: '📱 Share My Contact', request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: false
            }
          }
        );
      } else {
        await ctx.answerCbQuery('❌ Not subscribed yet. Please join the channel first.');
        await ctx.editMessageText(
          '❌ <b>Subscription Not Found</b>\n\n' +
          'It seems you haven\'t subscribed to our channel yet.\n\n' +
          'Please:\n' +
          '1. Click the channel link below\n' +
          '2. Join the channel\n' +
          '3. Come back here and click "✅ Check Subscription"\n\n' +
          '🔗 <b>Channel:</b> ' + config.telegram.channelLink,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.url('📢 Join Channel', config.telegram.channelLink)],
              [Markup.button.callback('✅ Check Subscription', 'check_subscription')],
              [Markup.button.callback('❌ Cancel', 'cancel_onboarding')]
            ])
          }
        );
      }
    } catch (error) {
      logger.error('Error in check subscription action:', {
        error: error.message,
        stack: error.stack,
        userId: ctx.from?.id
      });
      await ctx.answerCbQuery('❌ An error occurred. Please try again.');
    }
  });

  // Handle contact sharing
  bot.action('share_contact', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      await ctx.reply(
        '📱 <b>Share Your Contact</b>\n\n' +
        'Please share your contact information by tapping the button below.\n\n' +
        'This helps us provide better support and track your requests.',
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [[{ text: '📱 Share My Contact', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: false
          }
        }
      );
    } catch (error) {
      logger.error('Error in share contact action:', error);
      await ctx.answerCbQuery('❌ An error occurred. Please try again.');
    }
  });

  // Handle contact request
  bot.action('request_contact', async (ctx) => {
    try {
      await ctx.reply(
        '📱 <b>Contact Information</b>\n\n' +
        'Please share your contact information using the button below.',
        {
          parse_mode: 'HTML',
          reply_markup: Markup.keyboard([
            [Markup.button.contactRequest('📱 Share My Contact')]
          ]).resize()
        }
      );
    } catch (error) {
      logger.error('Error in request contact action:', error);
      await ctx.answerCbQuery('❌ An error occurred. Please try again.');
    }
  });

  // Handle contact sharing
  bot.on('contact', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        return ctx.reply('❌ User not found. Please try /start again.');
      }

      // Save contact information
      user.phoneNumber = ctx.message.contact.phone_number;
      user.hasSharedContact = true;
      user.onboardingCompleted = true;
      await user.save();

      // If there was a pending deep-link action, process it
      if (ctx.session?.deepLink?.action === 'answer' && ctx.session.deepLink.questionId) {
        await ctx.reply('✅ Setup complete! Taking you to the question...', { parse_mode: 'HTML', reply_markup: Markup.removeKeyboard() });
        await startAnswerFlow(ctx, ctx.session.deepLink.questionId);
        return;
      }
      if (ctx.session?.deepLink?.action === 'view' && ctx.session.deepLink.questionId) {
        await ctx.reply('✅ Setup complete! Loading answers...', { parse_mode: 'HTML', reply_markup: Markup.removeKeyboard() });
        await showAnswersFlow(ctx, ctx.session.deepLink.questionId);
        return;
      }

      // Otherwise, show main menu
      await ctx.reply(
        '✅ <b>Setup Complete!</b>\n\n' +
        'Welcome to Student Helper Bot! 🎓',
        { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
      );
      await showMainMenu(ctx);
    } catch (error) {
      logger.error('Error handling contact:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  });

  // Handle cancel onboarding
  bot.action('cancel_onboarding', async (ctx) => {
    try {
      await ctx.editMessageText(
        '❌ <b>Setup Cancelled</b>\n\n' +
        'You can restart the setup process anytime by using /start command.',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Error in cancel onboarding action:', error);
      await ctx.answerCbQuery('❌ An error occurred. Please try again.');
    }
  });

  // Handle "Check Subscription" button from main flow
  bot.hears('✅ Check Subscription', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        return ctx.reply('❌ User not found. Please try /start again.');
      }

      const isSubscribed = await checkSubscription(ctx);
      
      if (isSubscribed) {
        user.hasSubscribedToChannel = true;
        await user.save();
        
        if (user.onboardingCompleted) {
          await ctx.reply('✅ Subscription verified! You can continue using the bot.');
        } else {
          // Continue with contact sharing
          await ctx.reply(
            '✅ <b>Subscription Verified!</b>\n\n' +
            'Great! You\'ve successfully subscribed to our channel.\n\n' +
            '📱 <b>Next Step: Share Contact</b>\n\n' +
            'Please share your contact information to complete the setup.',
            {
              parse_mode: 'HTML',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('📱 Share Contact', 'share_contact')]
              ])
            }
          );
        }
      } else {
        await ctx.reply(
          '❌ <b>Subscription Not Found</b>\n\n' +
          'It seems you haven\'t subscribed to our channel yet.\n\n' +
          'Please:\n' +
          '1. Click the channel link below\n' +
          '2. Join the channel\n' +
          '3. Come back here and click "✅ Check Subscription"\n\n' +
          '🔗 <b>Channel:</b> ' + config.telegram.channelLink,
          {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.url('📢 Join Channel', config.telegram.channelLink)],
              [Markup.button.callback('✅ Check Subscription', 'check_subscription')]
            ])
          }
        );
      }
    } catch (error) {
      logger.error('Error in check subscription button:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  });
};

// Helper function to check subscription
const checkSubscription = async (ctx) => {
  try {
    // Determine channel identifier: prefer configured ID, then env var, then username from link
    let channelIdentifier = config.telegram.channelId;
    if (!channelIdentifier && process.env.TELEGRAM_CHANNEL_ID) {
      channelIdentifier = process.env.TELEGRAM_CHANNEL_ID;
    }
    if (!channelIdentifier && config.telegram.channelLink) {
      try {
        // Extract username from link like https://t.me/YourChannel or t.me/YourChannel
        const link = String(config.telegram.channelLink).trim();
        const match = link.match(/t\.me\/(.+)$/i);
        if (match && match[1]) {
          const username = match[1].replace(/^[@/]+/, '');
          channelIdentifier = `@${username}`;
        }
      } catch (e) {
        logger.warn('Error parsing channel link:', {
          error: e.message,
          channelLink: config.telegram.channelLink
        });
      }
    }

    if (!channelIdentifier) {
      logger.warn('Channel not configured (no ID or resolvable link); skipping subscription check', {
        hasChannelId: !!config.telegram.channelId,
        hasEnvChannelId: !!process.env.TELEGRAM_CHANNEL_ID,
        hasChannelLink: !!config.telegram.channelLink,
        channelLink: config.telegram.channelLink
      });
      return true;
    }

    logger.info('Checking subscription for channel:', {
      userId: ctx.from?.id,
      channelIdentifier,
      channelIdType: typeof channelIdentifier
    });

    try {
      const member = await ctx.telegram.getChatMember(channelIdentifier, ctx.from.id);
      const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);
      
      logger.info('Subscription check result:', {
        userId: ctx.from?.id,
        channelIdentifier,
        memberStatus: member.status,
        isSubscribed
      });
      
      return isSubscribed;
    } catch (telegramError) {
      logger.error('Telegram API error checking subscription:', {
        error: telegramError.message,
        userId: ctx.from?.id,
        channelIdentifier
      });
      
      // If it's a channel not found error, log it specifically
      if (telegramError.description && telegramError.description.includes('chat not found')) {
        logger.error('Channel not found or bot not in channel:', {
          channelIdentifier,
          userId: ctx.from?.id
        });
      }
      
      return false;
    }
  } catch (error) {
    logger.error('Unexpected error in checkSubscription:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id
    });
    return false;
  }
};

// Helper function to show main menu
const showMainMenu = async (ctx) => {
  try {
    // Build menu buttons conditionally (hide subscribe after user subscribed)
    let inlineButtons = [
      [{ text: '❓ Ask Question', callback_data: 'ask_question_menu' }],
      [{ text: '❓ Help', callback_data: 'help_menu' }]
    ];

    try {
      const telegramId = ctx.from.id.toString();
      const user = await User.findOne({ telegramId });
      if (!user || !user.hasSubscribedToChannel) {
        inlineButtons.push([{ text: '📢 Subscribe to Channel', callback_data: 'subscribe_channel' }]);
      }
    } catch (menuErr) {
      logger.warn('Unable to load user for main menu, showing subscribe by default', { error: menuErr?.message });
      inlineButtons.push([{ text: '📢 Subscribe to Channel', callback_data: 'subscribe_channel' }]);
    }

    await ctx.reply(
      '🎓 <b>Student Helper Bot</b>\n\n' +
      'Welcome! I\'m here to help you with your academic journey.\n\n' +
      '❓ <b>Q&A Community</b> - Ask questions and get answers from the community\n\n' +
      'Choose an option to get started:',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineButtons
        }
      }
    );
  } catch (error) {
    logger.error('Error showing main menu:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

module.exports = {
  setupAuthHandler,
  showMainMenu,
  checkSubscription
}; 

// Helper: start answer flow from deep link
async function startAnswerFlow(ctx, questionId) {
  try {
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      await ctx.reply('❌ Invalid question reference.');
      ctx.session.deepLink = null;
      return;
    }
    const question = await Question.findById(questionId);
    if (!question) {
      await ctx.reply('❌ Question not found.');
      ctx.session.deepLink = null;
      return;
    }
    if (question.status !== 'approved') {
      await ctx.reply('❌ This question is not available for answers.');
      ctx.session.deepLink = null;
      return;
    }

    // Prepare prompt
    const isAuthor = ctx.from.id === parseInt(question.userId);
    const header = isAuthor ? '📝 Add information to your question:' : '💬 Answer this question:';
    const messageText = `${header}\n\n` +
      `Question: ${question.content}\n\n` +
      (question.gradeLevel ? `Grade Level: ${question.gradeLevel}\n\n` : '') +
      `Type your ${isAuthor ? 'additional information' : 'answer'} below. You can send text, voice, photo, video, or document.`;

    await ctx.reply(messageText, {
      parse_mode: 'HTML',
      reply_markup: { keyboard: [['❌ Cancel Answering']], resize_keyboard: true }
    });

    // Set session state
    ctx.session.qaState = 'awaiting_answer';
    ctx.session.answeringQuestionId = questionId;
    ctx.session.isAuthorAnswer = isAuthor;
    ctx.session.confirmingAnswer = false;
    ctx.session.answerData = null;
    ctx.session.deepLink = null;
  } catch (err) {
    logger.error('startAnswerFlow error:', err);
    await ctx.reply('❌ Error loading question. Please try again later.');
    ctx.session.deepLink = null;
  }
}

// Helper: show answers for a question from deep link
async function showAnswersFlow(ctx, questionId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      await ctx.reply('❌ Invalid question reference.');
      ctx.session.deepLink = null;
      return;
    }
    const question = await Question.findById(questionId);
    if (!question) {
      await ctx.reply('❌ Question not found.');
      ctx.session.deepLink = null;
      return;
    }
    if (!question.answers || question.answers.length === 0) {
      await ctx.reply('👁️ No answers yet for this question.');
      ctx.session.deepLink = null;
      return;
    }
    await ctx.reply('👁️ <b>Answers</b>', { parse_mode: 'HTML' });

    for (let i = 0; i < question.answers.length; i++) {
      const ans = question.answers[i];
      const by = ans.username || `User ${ans.userId}`;
      const date = ans.createdAt ? new Date(ans.createdAt).toLocaleDateString() : '';
      const right = ans.reactions?.right || 0;
      const wrong = ans.reactions?.wrong || 0;

      let answerMessage = `<b>💬 Answer ${i + 1} by ${by}${date ? ` (${date})` : ''}:</b>\n\n`;
      if (ans.mediaType && ans.mediaType !== 'text') {
        answerMessage += `[${(ans.mediaType || '').toUpperCase()}] ${ans.mediaCaption || ans.content || ''}`;
      } else {
        answerMessage += ans.content || '';
      }

      const answerKeyboard = {
        inline_keyboard: [
          [
            Markup.button.callback(`✅ ${right}`, `ans_right_${questionId}_${i}`),
            Markup.button.callback(`❌ ${wrong}`, `ans_wrong_${questionId}_${i}`),
            Markup.button.callback('↩️ Reply', `ans_reply_${questionId}_${i}`)
          ]
        ]
      };

      await ctx.reply(answerMessage, { parse_mode: 'HTML', reply_markup: answerKeyboard });
    }
    ctx.session.deepLink = null;
  } catch (err) {
    logger.error('showAnswersFlow error:', err);
    await ctx.reply('❌ Error loading answers. Please try again later.');
    ctx.session.deepLink = null;
  }
}