const { Markup } = require('telegraf');
const User = require('../models/User');
const Question = require('../models/Question');
const logger = require('../utils/logger');

const setupAdminHandler = (bot) => {
  // Helper function to check if user is admin
  const isUserAdmin = async (userId) => {
    try {
      // Only allow the specific admin ID provided
      const allowedAdminId = '5752137292';
      if (userId?.toString() === allowedAdminId) return true;
      const user = await User.findOne({ telegramId: userId.toString() });
      return !!(user && user.isAdmin && user.telegramId === allowedAdminId);
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  };

  // Make user admin
  bot.command('makeadmin', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ You are not authorized to make admins.');
      }

      const reply = ctx.message.reply_to_message;
      if (!reply) {
        return ctx.reply('❌ Reply to a message from the user you want to make admin.');
      }

      const targetUserId = reply.from.id.toString();
      const targetUser = await User.findOne({ telegramId: targetUserId });

      if (!targetUser) {
        return ctx.reply('❌ User not found in database.');
      }

      if (targetUser.isAdmin) {
        return ctx.reply('❌ User is already an admin.');
      }

      targetUser.isAdmin = true;
      targetUser.adminRole = 'admin';
      targetUser.adminAddedAt = new Date();
      targetUser.adminAddedBy = ctx.from.id.toString();
      await targetUser.save();

      await ctx.reply(`✅ Made @${reply.from.username || reply.from.first_name} an admin.`);
    } catch (error) {
      logger.error('Error making admin:', error);
      await ctx.reply('❌ Error making admin.');
    }
  });

  // List admins
  bot.command('listadmins', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ You are not authorized to view admins.');
      }

      const admins = await User.find({ isAdmin: true });
      if (admins.length === 0) {
        return ctx.reply('❌ No admins found.');
      }

      let message = '👑 Admins:\n\n';
      for (const admin of admins) {
        message += `• ${admin.username || admin.firstName || 'Unknown'} (${admin.telegramId})\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      logger.error('Error listing admins:', error);
      await ctx.reply('❌ Error listing admins.');
    }
  });

  // Check admin status
  bot.command('adminstatus', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      const user = await User.findOne({ telegramId: ctx.from.id.toString() });

      let message = '🔍 Admin Status Check\n\n';
      message += `👤 User: ${ctx.from.first_name}\n`;
      message += `🆔 User ID: ${ctx.from.id}\n`;
      message += `📧 Username: ${ctx.from.username || 'None'}\n`;
      message += `👑 Admin Status: ${isAdmin ? '✅ Yes' : '❌ No'}\n`;

      if (user) {
        message += `🔧 Admin Role: ${user.adminRole || 'None'}\n`;
        message += `📅 Admin Since: ${
          user.adminAddedAt ? new Date(user.adminAddedAt).toLocaleDateString() : 'N/A'
        }\n`;
        message += `👑 Added By: ${user.adminAddedBy || 'N/A'}\n`;
        message += `📊 User in DB: ✅ Yes\n`;
      } else {
        message += `❌ User not found in database\n`;
        message += `📊 User in DB: ❌ No\n`;
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      logger.error('Error checking admin status:', error);
      await ctx.reply('❌ An error occurred while checking admin status.');
    }
  });

  // Admin panel (QA-only, commands only)
  bot.command('admin', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ You are not authorized to access admin panel.');
      }

      const instructions =
        '🔧 Admin Panel (Commands)\n\n' +
        '/admin_questions – List pending questions\n' +
        '/admin_stats – Show basic stats\n' +
        '/approve <questionId> – Approve question\n' +
        '/decline <questionId> – Decline question\n' +
        '/broadcast <message> – Send message to all users';

      await ctx.reply(instructions);
    } catch (error) {
      logger.error('Error in admin command:', error);
      await ctx.reply('❌ Error displaying admin panel.');
    }
  });

  // Show pending questions (command)
  bot.command('admin_questions', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Unauthorized');
      }

      const questions = await Question.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(10);

      if (questions.length === 0) {
        return ctx.reply('❓ Question Approvals\n\nNo pending questions.');
      }

      let message = '❓ Pending Questions\n\n';
      for (const q of questions) {
        message += `• ${q._id}: ${q.content.substring(0, 100)}...\n`;
        message += `  /approve ${q._id} | /decline ${q._id}\n\n`;
      }

      await ctx.reply(message);
    } catch (error) {
      logger.error('Error showing admin questions:', error);
      await ctx.reply('❌ Error');
    }
  });

  // Simple stats (command)
  bot.command('admin_stats', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Unauthorized');
      }

      const totalQuestions = await Question.countDocuments();
      const pendingQuestions = await Question.countDocuments({ status: 'pending' });
      const users = await User.countDocuments();

      // Get all users with their usernames for admin view
      const allUsers = await User.find({}).sort({ createdAt: -1 });

      let statsMessage = `📊 Stats\n\n❓ Questions: ${totalQuestions} (pending: ${pendingQuestions})\n👥 Total Users: ${users}\n\n👤 User List:\n`;
      
      for (const user of allUsers) {
        const username = user.username || user.firstName || 'Anonymous';
        const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
        statsMessage += `• ${username} (${joinDate})\n`;
      }

      await ctx.reply(statsMessage);
    } catch (error) {
      logger.error('Error showing stats:', error);
      await ctx.reply('❌ Error');
    }
  });

  // Approve question (command)
  bot.command('approve', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Unauthorized');

      const parts = ctx.message.text.trim().split(/\s+/);
      const id = parts[1];
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        return ctx.reply('Usage: /approve <questionId>');
      }

      const question = await Question.findById(id);
      if (!question) return ctx.reply('❌ Question not found');

      question.status = 'approved';
      question.approvedBy = ctx.from.id.toString();
      question.approvedAt = new Date();
      await question.save();

      // Post to main channel
      try {
        const channelId = process.env.TELEGRAM_CHANNEL_ID;
        logger.info(`Attempting to post question ${question._id} to channel ${channelId}`);
        
        if (!channelId) {
          logger.error('TELEGRAM_CHANNEL_ID environment variable is not set');
          await ctx.reply('❌ Channel ID not configured. Please set TELEGRAM_CHANNEL_ID in environment.');
          return;
        }
        
        const messageText = `❓ New Question\n\n${question.content}\n\n👤 Asked by: Anonymous\n📅 ${new Date(question.createdAt).toLocaleDateString()}`;
        
        // Create keyboard with proper format
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '✏️ Answer This Question',
                callback_data: `answer_${question._id}`
              },
              {
                text: '👁️ View Answers',
                callback_data: `view_${question._id}`
              }
            ]
          ]
        };
        
        logger.info('Sending message to channel with keyboard:', {
          channelId: channelId,
          messageText: messageText.substring(0, 100) + '...',
          keyboard: JSON.stringify(keyboard)
        });
        
        // Try sending with explicit reply_markup
        let channelMessage;
        try {
          channelMessage = await bot.telegram.sendMessage(
            channelId,
            messageText,
            {
              parse_mode: 'HTML',
              reply_markup: keyboard
            }
          );
        } catch (sendError) {
          logger.error('Error sending with keyboard, trying without parse_mode:', sendError);
          // Fallback: try without parse_mode
          channelMessage = await bot.telegram.sendMessage(
            channelId,
            messageText,
            {
              reply_markup: keyboard
            }
          );
        }

        logger.info(`Successfully posted question to channel, message ID: ${channelMessage.message_id}`);

        // Save channel message ID for later updates
        question.channelMessageId = channelMessage.message_id;
        await question.save();

        // Notify the asker
        try {
          const asker = await User.findOne({ telegramId: question.userId?.toString() });
          if (asker) {
            await bot.telegram.sendMessage(
              asker.telegramId,
              '✅ Your question has been approved and posted to the channel!'
            );
          }
        } catch (notifyError) {
          logger.error('Error notifying user:', notifyError);
        }

      } catch (channelError) {
        logger.error('Error posting to channel:', channelError);
        logger.error('Channel ID:', process.env.TELEGRAM_CHANNEL_ID);
        logger.error('Question content:', question.content);
      }

      await ctx.reply('✅ Question approved and posted to channel!');
    } catch (error) {
      logger.error('Approve error:', error);
      await ctx.reply('❌ Error approving');
    }
  });

  // Test channel posting
  bot.command('testchannel', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Unauthorized');

      const testKeyboard = {
        inline_keyboard: [
          [
            {
              text: '✅ Test Button 1',
              callback_data: 'test_button_1'
            }
          ],
          [
            {
              text: '❌ Test Button 2',
              callback_data: 'test_button_2'
            }
          ]
        ]
      };

             await bot.telegram.sendMessage(
         process.env.TELEGRAM_CHANNEL_ID,
         '🧪 Test message with buttons\n\nThis is a test to verify channel posting works.',
         {
           parse_mode: 'HTML',
           reply_markup: testKeyboard
         }
       );

      await ctx.reply('✅ Test message sent to channel!');
    } catch (error) {
      logger.error('Test channel error:', error);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  });

  // Decline question (command)
  bot.command('decline', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Unauthorized');

      const parts = ctx.message.text.trim().split(/\s+/);
      const id = parts[1];
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        return ctx.reply('Usage: /decline <questionId>');
      }

      const question = await Question.findById(id);
      if (!question) return ctx.reply('❌ Question not found');

      question.status = 'declined';
      question.rejectedBy = ctx.from.id.toString();
      question.rejectedAt = new Date();
      await question.save();

      // Notify the asker
      try {
        const asker = await User.findOne({ telegramId: question.userId?.toString() });
        if (asker) {
          await bot.telegram.sendMessage(
            asker.telegramId,
            '❌ Your question has been rejected by an admin.'
          );
        }
      } catch (notifyError) {
        logger.error('Error notifying user:', notifyError);
      }

      await ctx.reply('✅ Declined');
    } catch (error) {
      logger.error('Decline error:', error);
      await ctx.reply('❌ Error declining');
    }
  });

  // Broadcast message to all users (command)
  bot.command('broadcast', async (ctx) => {
    try {
      const isAdmin = await isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Unauthorized');

      const message = ctx.message.text.replace('/broadcast', '').trim();
      if (!message) {
        return ctx.reply('Usage: /broadcast <message>\n\nExample: /broadcast Hello everyone! This is an important announcement.');
      }

      // Get all users
      const users = await User.find({});
      if (users.length === 0) {
        return ctx.reply('❌ No users found in database.');
      }

      // Send confirmation to admin
      await ctx.reply(`📢 Broadcast Message\n\nMessage: ${message}\n\nRecipients: ${users.length} users\n\nSending broadcast...`);

      let successCount = 0;
      let failCount = 0;

      // Send message to all users
      for (const user of users) {
        try {
          await bot.telegram.sendMessage(
            user.telegramId,
            `📢 **Broadcast Message**\n\n${message}\n\n_From: Admin_`,
            { parse_mode: 'Markdown' }
          );
          successCount++;
          
          // Add small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to send broadcast to user ${user.telegramId}:`, error);
          failCount++;
        }
      }

      // Send final report to admin
      await ctx.reply(`✅ Broadcast Complete!\n\n📊 Results:\n✅ Success: ${successCount}\n❌ Failed: ${failCount}\n\nTotal users: ${users.length}`);

    } catch (error) {
      logger.error('Broadcast error:', error);
      await ctx.reply('❌ Error sending broadcast');
    }
  });

  return {
    isUserAdmin,
  };
};

module.exports = { setupAdminHandler };
