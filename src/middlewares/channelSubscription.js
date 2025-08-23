const config = require('../config/config');
const logger = require('../utils/logger');
const User = require('../models/User'); // Added import for User model

// Commands that should skip subscription check
const SKIP_COMMANDS = [
  '/start',
  '/help'
];

/**
 * Check if user is subscribed to required channel
 * @param {Object} ctx Telegram context
 * @returns {Promise<boolean>} Subscription status
 */
const isSubscribed = async (ctx) => {
  try {
    // Skip check if channel ID is not configured
    if (!config.telegram.channelId) {
      logger.warn('Channel ID not configured, skipping subscription check');
      return true;
    }
    
    // Skip check for admin users
    if (ctx.from && ctx.from.id) {
      try {
        const user = await User.findOne({ telegramId: ctx.from.id.toString() });
        if (user && user.isAdmin) {
          logger.info('Admin user detected, skipping subscription check');
          return true;
        }
      } catch (userErr) {
        logger.error('Error checking admin status:', userErr);
        // Continue with subscription check if admin check fails
      }
    }
    
    const member = await ctx.telegram.getChatMember(config.telegram.channelId, ctx.from.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (error) {
    logger.error('Error checking channel subscription:', {
      error: error.message,
      userId: ctx.from?.id
    });
    
    // If there's an error with the channel check, default to allowing access
    // This prevents users from being locked out due to configuration issues
    return true;
  }
};

/**
 * Middleware to check if user is subscribed to required channels
 * @param {Object} ctx Telegram context
 * @param {Function} next Next middleware function
 */
const checkChannelSubscription = async (ctx, next) => {
  try {
    // Skip if no user data
    if (!ctx.from) {
      logger.warn('No user data in context, skipping subscription check');
      return next();
    }
    
    // Check if user is admin first
    try {
      const user = await User.findOne({ telegramId: ctx.from.id.toString() });
      if (user && user.isAdmin) {
        logger.info('Skipping subscription check for admin', {
          userId: ctx.from.id,
          username: ctx.from.username
        });
        return next();
      }
      
      // Skip subscription check for users who haven't completed onboarding
      if (user && !user.onboardingCompleted) {
        logger.info('Skipping subscription check for user in onboarding', {
          userId: ctx.from.id,
          username: ctx.from.username
        });
        return next();
      }
    } catch (adminErr) {
      logger.error('Error checking admin status:', adminErr);
      // Continue with normal subscription check
    }
    
    // Skip subscription check for certain conditions
    if (
      // Skip for basic commands
      (ctx.message && SKIP_COMMANDS.includes(ctx.message.text)) ||
      // Skip for subscription check button
      (ctx.message && ctx.message.text === '✅ Check Subscription') ||
      // Skip for contact sharing during onboarding
      (ctx.updateType === 'message' && ctx.message?.contact) ||
      // Skip for file uploads during upload process
      (ctx.session?.uploadState && ['document', 'photo', 'video', 'audio'].includes(ctx.updateType))
    ) {
      logger.info('Skipping subscription check', {
        userId: ctx.from.id,
        updateType: ctx.updateType,
        command: ctx.message?.text
      });
      return next();
    }
    
    // Skip if channel ID not configured
    if (!config.telegram.channelId) {
      logger.warn('Channel ID not configured, skipping subscription check');
      return next();
    }

    // Check if user is subscribed
    const subscribed = await isSubscribed(ctx);
    if (!subscribed) {
      logger.info('User not subscribed to channel', {
        userId: ctx.from.id,
        updateType: ctx.updateType
      });
      
      // Make sure channel link is available
      if (!config.telegram.channelLink) {
        logger.error('Channel link not configured');
        return next(); // Allow access rather than blocking users
      }
      
      try {
        await ctx.reply(
          '⚠️ *Please Subscribe*\n\n' +
          'You need to subscribe to our channel to use this bot\\.\n\n' +
          `1\\. Join our channel: ${config.telegram.channelLink}\n` +
          '2\\. Come back here and click "✅ Check Subscription" button\\.\n\n' +
          'This helps us maintain and improve the bot for everyone\\!',
          { 
            parse_mode: 'MarkdownV2',
            reply_markup: {
              keyboard: [['✅ Check Subscription']],
              resize_keyboard: true
            }
          }
        );
      } catch (replyError) {
        logger.error('Error sending subscription message:', replyError);
        // If we can't send the subscription message, let the user continue
        return next();
      }
      return;
    }

    logger.info('User subscription verified', {
      userId: ctx.from.id,
      updateType: ctx.updateType
    });

    return next();
  } catch (error) {
    logger.error('Channel subscription check error:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id
    });
    
    // In case of error, allow the user to proceed rather than blocking them
    return next();
  }
};

module.exports = {
  default: checkChannelSubscription,
  isSubscribed
};
