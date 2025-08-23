const { Markup } = require('telegraf');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const User = require('../models/User');
const logger = require('../utils/logger');
const config = require('../config/config');

// Constants for grade levels
const GRADE_LEVELS = [
  ['Grade 6', 'Grade 7', 'Grade 8'],
  ['Grade 9', 'Grade 10'],
  ['Grade 11', 'Grade 12'],
  ['University'],
  ['⬅️ Cancel']
];

// Handler for /ask command
const askQuestionHandler = async (ctx) => {
  try {
    // Check if user is banned
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (user?.isBanned) {
      return ctx.reply('❌ You are not allowed to ask questions. Please contact an admin if you think this is a mistake.');
    }

    await ctx.reply(
      '❓ *Ask a Question*\n\n' +
      'You can send your question as text, video, document, or voice.\n\n' +
      '💡 Tips for a good question:\n' +
      '• Include all necessary details\n' +
      '• Specify what you\'ve already tried\n' +
      '• Be clear and concise\n\n' +
      'Your question will be reviewed by an admin before being posted.',
      { parse_mode: 'Markdown' }
    );
    ctx.session = ctx.session || {};
    ctx.session.qaState = 'awaiting_question';
  } catch (error) {
    logger.error('Error in ask question handler:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

// Handler for question content (text, media)
const handleQuestionContent = async (ctx) => {
  try {
    let content = '';
    let mediaType = 'text';
    let mediaId = null;
    let mediaCaption = null;

    if (ctx.message.text) {
      content = ctx.message.text;
      if (!content || content.length < 5) {
        return ctx.reply('❌ Your question is too short. Please provide more details.');
      }
    } else if (ctx.message.voice) {
      mediaType = 'voice';
      mediaId = ctx.message.voice.file_id;
      content = 'Voice message';
    } else if (ctx.message.photo && ctx.message.photo.length > 0) {
      mediaType = 'photo';
      mediaId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      content = ctx.message.caption || 'Photo';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.video) {
      mediaType = 'video';
      mediaId = ctx.message.video.file_id;
      content = ctx.message.caption || 'Video';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.audio) {
      mediaType = 'audio';
      mediaId = ctx.message.audio.file_id;
      content = ctx.message.caption || 'Audio';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.document) {
      mediaType = 'document';
      mediaId = ctx.message.document.file_id;
      content = ctx.message.caption || `Document: ${ctx.message.document.file_name || 'Untitled'}`;
      mediaCaption = ctx.message.caption;
    } else {
      logger.warn('Unsupported message type in question handler', {
        userId: ctx.from.id,
        messageKeys: Object.keys(ctx.message || {})
      });
      return ctx.reply('❌ Unsupported message type. Please send text, voice, photo, video, audio, or document.');
    }

    ctx.session.questionData = {
      content,
      mediaType,
      mediaId,
      mediaCaption,
      userId: ctx.from.id,
      username: ctx.from.username || null,
      firstName: ctx.from.first_name || null
    };

    // Ask for grade level
    await ctx.reply(
      '📚 Select your grade level:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Grade 6', 'grade_grade6'),
          Markup.button.callback('Grade 7', 'grade_grade7'),
          Markup.button.callback('Grade 8', 'grade_grade8')
        ],
        [
          Markup.button.callback('Grade 9', 'grade_grade9'),
          Markup.button.callback('Grade 10', 'grade_grade10')
        ],
        [
          Markup.button.callback('Grade 11', 'grade_grade11'),
          Markup.button.callback('Grade 12', 'grade_grade12')
        ],
        [
          Markup.button.callback('University', 'grade_university')
        ],
        [
          Markup.button.callback('❌ Cancel', 'cancel_question')
        ]
      ])
    );
    ctx.session.qaState = 'awaiting_grade';
  } catch (error) {
    logger.error('Error handling question content:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
    ctx.session.qaState = null;
  }
};

// Handler for grade selection (store media info)
const handleGradeSelection = async (ctx) => {
  try {
    if (ctx.callbackQuery.data === 'cancel_question') {
      ctx.session.qaState = null;
      ctx.session.questionData = null;
      return ctx.editMessageText('❌ Question cancelled.');
    }
    const gradeLevel = ctx.callbackQuery.data.split('_')[1];
    // Create new question
    const questionData = {
      ...ctx.session.questionData,
      gradeLevel
    };
    const question = new Question({
      userId: questionData.userId,
      username: questionData.username,
      firstName: questionData.firstName,
      content: questionData.content,
      mediaType: questionData.mediaType,
      mediaId: questionData.mediaId,
      mediaCaption: questionData.mediaCaption,
      gradeLevel: questionData.gradeLevel
    });
    await question.save();
    await ctx.editMessageText(
      '✅ Your question has been submitted!\n\n' +
      'It will be reviewed by our admins and posted to the channel if approved.\n' +
      'You will receive a notification when your question is approved.'
    );
    ctx.session.qaState = null;
    ctx.session.questionData = null;
    await ctx.answerCbQuery();
  } catch (error) {
    logger.error('Error handling grade selection:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
    ctx.session.qaState = null;
    ctx.session.questionData = null;
  }
};

/**
 * Handle question approval or decline
 * @param {Object} ctx Telegram context
 */
const handleApproval = async (ctx) => {
  try {
    logger.info('Question approval handler called', {
      userId: ctx.from?.id,
      callbackData: ctx.callbackQuery?.data
    });
    
    // Extract action and question ID from callback data
    let action, questionId;
    
    if (!ctx.callbackQuery?.data) {
      logger.error('Missing callback data in approval handler', {
        userId: ctx.from?.id
      });
      return ctx.answerCbQuery('❌ Invalid approval request');
    }
    
    // Only handle direct approve_ and decline_ patterns for questions
    // This ensures we don't conflict with material approvals
    if (ctx.callbackQuery.data.match(/^approve_[0-9a-fA-F]{24}$/)) {
      action = 'approve';
      questionId = ctx.callbackQuery.data.substring(8); // Remove 'approve_' prefix
      logger.info('Question approve action detected', { 
        userId: ctx.from?.id,
        questionId
      });
    } else if (ctx.callbackQuery.data.match(/^decline_[0-9a-fA-F]{24}$/)) {
      action = 'decline';
      questionId = ctx.callbackQuery.data.substring(8); // Remove 'decline_' prefix
      logger.info('Question decline action detected', { 
        userId: ctx.from?.id,
        questionId
      });
    } else {
      // If it doesn't match our expected patterns, log and exit
      logger.warn('Unhandled callback pattern in question approval handler', {
        userId: ctx.from?.id,
        callbackData: ctx.callbackQuery.data
      });
      return; // Let other handlers process this
    }
    
    // Validate questionId
    if (!questionId || questionId.trim() === '') {
      logger.error('Empty question ID in approval handler', {
        userId: ctx.from?.id,
        callbackData: ctx.callbackQuery.data
      });
      return ctx.answerCbQuery('❌ Missing question ID');
    }
    
    // Validate that questionId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      logger.error('Invalid question ID format in approval handler', {
        userId: ctx.from?.id,
        questionId,
        callbackData: ctx.callbackQuery.data
      });
      return ctx.answerCbQuery('❌ Invalid question ID format');
    }
    
    // Find the question
    let question;
    try {
      question = await Question.findById(questionId);
    } catch (dbError) {
      logger.error('Database error finding question in approval handler', {
        error: dbError.message,
        userId: ctx.from?.id,
        questionId
      });
      return ctx.answerCbQuery('❌ Error accessing question data');
    }
    
    if (!question) {
      logger.error('Question not found in approval handler', {
        userId: ctx.from?.id,
        questionId
      });
      return ctx.answerCbQuery('❌ Question not found');
    }

    // Check if user is admin
    let isAdmin;
    try {
      isAdmin = await isUserAdmin(ctx.from.id);
    } catch (adminError) {
      logger.error('Error checking admin status', {
        error: adminError.message,
        userId: ctx.from.id
      });
      return ctx.answerCbQuery('❌ Error verifying admin permissions');
    }
    
    if (!isAdmin) {
      logger.warn('Non-admin attempted to approve/decline question', { 
        userId: ctx.from.id,
        questionId
      });
      return ctx.answerCbQuery('❌ Only admins can approve questions');
    }

    if (action === 'approve') {
      // Update question status
      question.status = 'approved';
      question.approvedBy = ctx.from.id.toString();
      question.approvedAt = new Date();
      
      try {
        await question.save();
        logger.info('Question marked as approved', {
          userId: ctx.from.id,
          questionId
        });
      } catch (saveError) {
        logger.error('Error saving approved question', {
          error: saveError.message,
          userId: ctx.from.id,
          questionId
        });
        return ctx.answerCbQuery('❌ Error saving question status');
      }

      // Post to main channel with answer button
      try {
        // Check if channel ID is configured
        if (!config.telegram.channelId) {
          logger.error('Channel ID not configured for question posting', {
            userId: ctx.from.id,
            questionId
          });
          return ctx.answerCbQuery('❌ Channel not configured. Contact administrator.');
        }
        
        // Add debug logging to show which channel is being used
        logger.info('Posting question to channel', {
          userId: ctx.from.id,
          questionId,
          channelId: config.telegram.channelId,
          channelIdType: typeof config.telegram.channelId,
          channelIdLength: config.telegram.channelId ? config.telegram.channelId.toString().length : 0
        });
        
        let channelMessage;
        const questionText = `<b>❓ Question from Student</b>\n\n` +
          `${question.content}\n\n` +
          `📚 Grade Level: ${formatGradeLevel(question.gradeLevel)}`;
        const botUsername = (await ctx.telegram.getMe()).username;
        const answerDeepLink = `https://t.me/${botUsername}?start=answer_${question._id}`;
        // Remove the browseDeepLink and button
        // const browseDeepLink = `https://t.me/${botUsername}?start=browse`;
        const viewAnswersDeepLink = `https://t.me/${botUsername}?start=view_${question._id}`;
        const answerCount = question.answers ? question.answers.length : 0;
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '💬 Answer this Question', url: answerDeepLink },
              { text: `👁️ View Answers (${answerCount})`, url: viewAnswersDeepLink }
            ]
          ]
        };
        // Send the appropriate media type to the channel
        if (question.mediaType === 'text' || !question.mediaType) {
          channelMessage = await ctx.telegram.sendMessage(
            config.telegram.channelId,
            questionText,
            {
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        } else if (question.mediaType === 'photo') {
          channelMessage = await ctx.telegram.sendPhoto(
            config.telegram.channelId,
            question.mediaId,
            {
              caption: questionText,
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        } else if (question.mediaType === 'video') {
          channelMessage = await ctx.telegram.sendVideo(
            config.telegram.channelId,
            question.mediaId,
            {
              caption: questionText,
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        } else if (question.mediaType === 'voice') {
          channelMessage = await ctx.telegram.sendVoice(
            config.telegram.channelId,
            question.mediaId,
            {
              caption: questionText,
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        } else if (question.mediaType === 'audio') {
          channelMessage = await ctx.telegram.sendAudio(
            config.telegram.channelId,
            question.mediaId,
            {
              caption: questionText,
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        } else if (question.mediaType === 'document') {
          channelMessage = await ctx.telegram.sendDocument(
            config.telegram.channelId,
            question.mediaId,
            {
              caption: questionText,
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        } else {
          // Fallback to text if unknown type
          channelMessage = await ctx.telegram.sendMessage(
            config.telegram.channelId,
            questionText,
            {
              parse_mode: 'HTML',
              reply_markup: replyMarkup
            }
          );
        }
        // Save channel message ID
        question.channelMessageId = channelMessage.message_id;
        try {
          await question.save();
          logger.info('Channel message ID saved to question', {
            userId: ctx.from.id,
            questionId,
            channelMessageId: channelMessage.message_id
          });
        } catch (saveError) {
          logger.error('Error saving channel message ID', {
            error: saveError.message,
            userId: ctx.from.id,
            questionId,
            channelMessageId: channelMessage.message_id
          });
        }
        // Notify user of approval
        try {
          await ctx.telegram.sendMessage(
            question.userId,
            '✅ Your question has been approved and posted to the channel!\n' +
            'Other students can now see and answer your question.'
          );
          
          logger.info('User notified of question approval', {
            userId: ctx.from.id,
            questionId,
            authorId: question.userId
          });
        } catch (notifyError) {
          logger.error('Error notifying user about question approval:', {
            error: notifyError.message,
            userId: ctx.from.id,
            questionId,
            authorId: question.userId
          });
          // Continue even if notification fails
        }

        await ctx.answerCbQuery('✅ Question approved and posted to channel');
        
        // Update admin UI
        try {
          await ctx.editMessageText(
            '✅ *Question Approved*\n\n' +
            'The question has been approved and posted to the channel.\n\n' +
            '_Returning to approvals list..._',
            { parse_mode: 'Markdown' }
          );
          
          // Return to approvals list after a short delay
          setTimeout(async () => {
            try {
              // Check if ctx.action is available
              if (typeof ctx.action === 'function') {
                ctx.callbackQuery = { data: 'admin_approve:questions' };
                await ctx.action();
              } else {
                // Alternative approach if ctx.action is not available
                logger.info('Using alternative approach to return to approvals list', {
                  userId: ctx.from?.id
                });
                
                // Try to use the admin handler directly
                await ctx.telegram.answerCbQuery(ctx.callbackQuery.id);
                await ctx.telegram.editMessageText(
                  ctx.chat.id,
                  ctx.callbackQuery.message.message_id,
                  undefined,
                  '⏳ *Returning to approvals list...*',
                  { parse_mode: 'Markdown' }
                );
                
                // Wait a moment then try to show the approvals section
                setTimeout(async () => {
                  try {
                    // Try to show approvals section directly
                    // This part of the code was removed as adminHandler is no longer imported
                    // if (adminHandler.showApprovalSection) {
                    //   await adminHandler.showApprovalSection(ctx);
                    // }
                  } catch (finalError) {
                    logger.error('Final error returning to approvals list:', {
                      error: finalError.message,
                      userId: ctx.from?.id
                    });
                  }
                }, 500);
              }
            } catch (actionError) {
              logger.error('Error returning to approvals list:', {
                error: actionError.message,
                userId: ctx.from?.id
              });
              
              // Try to at least show a message to the user
              try {
                await ctx.editMessageText(
                  '✅ *Question Approved*\n\n' +
                  'The question has been approved and posted to the channel.\n\n' +
                  '_Please return to the admin section manually._',
                  { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                      inline_keyboard: [[
                        { text: '◀️ Back to Admin', callback_data: 'admin_section:approvals' }
                      ]]
                    }
                  }
                );
              } catch (finalError) {
                logger.error('Final error showing completion message:', {
                  error: finalError.message,
                  userId: ctx.from?.id
                });
              }
            }
          }, 1500);
        } catch (editError) {
          logger.error('Error updating admin UI after approval:', {
            error: editError.message,
            userId: ctx.from?.id,
            questionId
          });
          // Continue even if UI update fails
          
          // Try to at least answer the callback query
          try {
            await ctx.answerCbQuery('✅ Question approved successfully');
          } catch (finalError) {
            logger.error('Error answering callback query:', {
              error: finalError.message,
              userId: ctx.from?.id
            });
          }
        }
      } catch (channelError) {
        logger.error('Error posting question to channel:', {
          error: channelError.message,
          userId: ctx.from.id,
          questionId
        });
        return ctx.answerCbQuery('❌ Error posting to channel');
      }
    } else if (action === 'decline') {
      // Update question status
      question.status = 'declined';
      question.declinedBy = ctx.from.id.toString();
      question.declinedAt = new Date();
      
      try {
        await question.save();
        logger.info('Question marked as declined', {
          userId: ctx.from.id,
          questionId
        });
      } catch (saveError) {
        logger.error('Error saving declined question', {
          error: saveError.message,
          userId: ctx.from.id,
          questionId
        });
        return ctx.answerCbQuery('❌ Error saving question status');
      }

      // Notify user of decline
      try {
        await ctx.telegram.sendMessage(
          question.userId,
          '❌ Your question has been declined by an administrator.\n' +
          'Please review our community guidelines for asking questions.'
        );
        
        logger.info('User notified of question decline', {
          userId: ctx.from.id,
          questionId,
          authorId: question.userId
        });
      } catch (notifyError) {
        logger.error('Error notifying user about question decline:', {
          error: notifyError.message,
          userId: ctx.from.id,
          questionId,
          authorId: question.userId
        });
        // Continue even if notification fails
      }

      await ctx.answerCbQuery('❌ Question declined');
      
      // Update admin UI
      try {
        await ctx.editMessageText(
          '❌ *Question Declined*\n\n' +
          'The question has been declined and the user has been notified.\n\n' +
          '_Returning to approvals list..._',
          { parse_mode: 'Markdown' }
        );
        
        // Return to approvals list after a short delay
        setTimeout(async () => {
          try {
            // This part of the code was removed as adminHandler is no longer imported
            // ctx.callbackQuery = { data: 'admin_approve:questions' };
            // await ctx.action();
          } catch (actionError) {
            logger.error('Error returning to approvals list:', {
              error: actionError.message,
              userId: ctx.from.id
            });
          }
        }, 1500);
      } catch (editError) {
        logger.error('Error updating admin UI after decline:', {
          error: editError.message,
          userId: ctx.from.id,
          questionId
        });
        // Continue even if UI update fails
      }
    } else {
      logger.error('Unknown approval action', {
        userId: ctx.from.id,
        action,
        questionId
      });
      return ctx.answerCbQuery('❌ Invalid approval action');
    }
  } catch (error) {
    logger.error('Error in approval handler:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id,
      callbackData: ctx.callbackQuery?.data
    });
    return ctx.answerCbQuery('❌ Error processing approval');
  }
};

// Handler for answering questions
const handleAnswerButton = async (ctx) => {
  try {
    // Extract the question ID from callback data
    const questionId = ctx.callbackQuery.data.split('_')[1];
    
    // Add detailed logging
    logger.info('Answer button clicked', {
      userId: ctx.from?.id,
      questionId: questionId,
      chatType: ctx.chat?.type
    });
    
    // Validate question ID format
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      logger.error('Invalid question ID format in answer button', { questionId });
      return ctx.answerCbQuery('❌ Invalid question reference');
    }
    
    // Find the question
    let question;
    try {
      question = await Question.findById(questionId);
    } catch (dbError) {
      logger.error('Database error finding question from answer button', {
        error: dbError.message,
        questionId
      });
      return ctx.answerCbQuery('❌ Error accessing question data');
    }

    if (!question) {
      logger.warn('Question not found in answer button', { questionId });
      return ctx.answerCbQuery('❌ Question not found');
    }
    
    // Check if question is approved
    if (question.status !== 'approved') {
      logger.warn('Attempted to answer non-approved question from button', { 
        questionId,
        status: question.status 
      });
      return ctx.answerCbQuery('❌ This question is not available for answers');
    }

    // If in channel/group, send to private chat with direct link
    if (ctx.chat.type !== 'private') {
      try {
        const botUsername = (await ctx.telegram.getMe()).username;
        
        // Generate the deep link with proper encoding
        // Use a simpler format to ensure compatibility
        const deepLink = `https://t.me/${botUsername}?start=answer_${questionId}`;
        
        logger.info('Generated deep link for question', {
          userId: ctx.from.id,
          questionId: questionId,
          deepLink: deepLink,
          botUsername: botUsername
        });
        
        // Use a more descriptive message
        await ctx.answerCbQuery(
          '✏️ Click here to answer this question in private chat',
          {
            url: deepLink,
            cache_time: 3 // Short cache time to prevent issues
          }
        );
        
        // Remove the channel message - no longer needed
        // The deep link callback query is sufficient
      } catch (error) {
        logger.error('Error generating deep link:', {
          error: error.message,
          questionId: questionId
        });
        await ctx.answerCbQuery('❌ Error generating answer link. Try messaging the bot directly.');
      }
      return;
    }

    // Check if this is the question author
    const isAuthor = ctx.from.id === parseInt(question.userId);

    // Get user info if available
    let askerUsername = 'a student';
    try {
      const questionUser = await User.findOne({ telegramId: question.userId.toString() });
      if (questionUser) {
        askerUsername = questionUser.username || questionUser.firstName || 'a student';
      }
    } catch (err) {
      logger.error('Error fetching question user:', {
        error: err.message,
        questionId,
        authorId: question.userId
      });
    }

    // Prepare message text
    let messageText = '';
    if (isAuthor) {
      messageText = `<b>📝 Add information to your question:</b>\n\n`;
    } else {
      messageText = `<b>💬 Answer this question:</b>\n\n`;
    }
    
    messageText += `<b>Question:</b> ${question.content}\n\n` +
      `<b>Grade Level:</b> ${formatGradeLevel(question.gradeLevel)}\n\n` +
      `<i>Type your ${isAuthor ? 'additional information' : 'answer'} below.\n` +
      `You can send text, voice messages, photos, videos, or documents.</i>`;

    // Send the message with answer prompt
    try {
      await ctx.reply(
        messageText,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [['❌ Cancel Answering']],
            resize_keyboard: true
          }
        }
      );
    } catch (replyError) {
      logger.error('Error sending answer prompt:', {
        error: replyError.message,
        userId: ctx.from.id,
        questionId
      });
      return ctx.answerCbQuery('❌ Error displaying question. Please try again.');
    }

    // Store question ID and state in session
    ctx.session = ctx.session || {};
    ctx.session.answeringQuestionId = questionId;
    ctx.session.qaState = 'awaiting_answer';
    ctx.session.isAuthorAnswer = isAuthor;
    ctx.session.confirmingAnswer = false;
    ctx.session.answerData = null;
    
    // Log that we're starting to answer a specific question
    logger.info('User starting to answer question', {
      userId: ctx.from.id,
      questionId: questionId,
      isAuthor: isAuthor,
      sessionState: {
        qaState: ctx.session.qaState,
        answeringQuestionId: ctx.session.answeringQuestionId,
        isAuthorAnswer: ctx.session.isAuthorAnswer
      }
    });
    
    await ctx.answerCbQuery('✏️ Please write your answer');
  } catch (error) {
    logger.error('Error handling answer button:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id,
      callbackData: ctx.callbackQuery?.data
    });
    await ctx.answerCbQuery('❌ Error processing answer request');
  }
};

// Handler for receiving answers
const handleAnswer = async (ctx) => {
  try {
    // Add detailed logging to track the issue
    logger.info('Answer handler triggered', {
      userId: ctx.from?.id,
      hasSession: !!ctx.session,
      qaState: ctx.session?.qaState,
      answeringQuestionId: ctx.session?.answeringQuestionId,
      messageType: ctx.message ? Object.keys(ctx.message).filter(key => 
        ['text', 'photo', 'video', 'audio', 'voice', 'document'].includes(key)
      )[0] : 'unknown'
    });

    // Validate session state
    if (!ctx.session) {
      logger.warn('No session found when trying to handle answer', {
        userId: ctx.from?.id
      });
      return ctx.reply('❌ Session error. Please try answering the question again.', Markup.removeKeyboard());
    }
    
    if (ctx.session?.qaState !== 'awaiting_answer') {
      logger.warn('Invalid session state when trying to handle answer', {
        userId: ctx.from?.id,
        state: ctx.session?.qaState
      });
      return;
    }
    
    if (!ctx.session?.answeringQuestionId) {
      logger.warn('No question ID in session when trying to handle answer', {
        userId: ctx.from?.id
      });
      return ctx.reply('❌ Question reference lost. Please try answering the question again.', Markup.removeKeyboard());
    }

    // Handle cancellation
    if (ctx.message?.text === '❌ Cancel Answering') {
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      return ctx.reply('✅ Answer cancelled', Markup.removeKeyboard());
    }
    
    // Handle confirmation response
    if (ctx.session.confirmingAnswer) {
      logger.info('Processing confirmation response', {
        userId: ctx.from?.id,
        response: ctx.message?.text,
        questionId: ctx.session.answeringQuestionId
      });
      
      if (ctx.message?.text === '✅ Yes, Post Answer') {
        // Continue with posting the answer using the stored data
        return await postAnswerToQuestion(ctx);
      } else if (ctx.message?.text === '❌ No, Edit Answer') {
        // Go back to answering state
        ctx.session.confirmingAnswer = false;
        ctx.session.answerData = null;
        
        // Find the question to redisplay it
        const questionId = ctx.session.answeringQuestionId;
        
        // Validate question ID format
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
          logger.error('Invalid question ID format when editing answer', { questionId });
          ctx.session.qaState = null;
          ctx.session.answeringQuestionId = null;
          ctx.session.isAuthorAnswer = null;
          return ctx.reply('❌ Invalid question reference. Please try again.', Markup.removeKeyboard());
        }
        
        let question;
        try {
          question = await Question.findById(questionId);
        } catch (dbError) {
          logger.error('Database error finding question when editing answer', {
            error: dbError.message,
            questionId
          });
          ctx.session.qaState = null;
          ctx.session.answeringQuestionId = null;
          ctx.session.isAuthorAnswer = null;
          return ctx.reply('❌ Error accessing question data. Please try again later.', Markup.removeKeyboard());
        }
        
        if (!question) {
          logger.warn('Question not found when editing answer', { questionId });
          ctx.session.qaState = null;
          ctx.session.answeringQuestionId = null;
          ctx.session.isAuthorAnswer = null;
          return ctx.reply('❌ Question not found or was removed', Markup.removeKeyboard());
        }
        
        // Check if this is the question author
        const isAuthor = ctx.session.isAuthorAnswer === true;
        
        // Redisplay question and prompt for answer
        let messageText = '';
        if (isAuthor) {
          messageText = `<b>📝 Add information to your question:</b>\n\n`;
        } else {
          messageText = `<b>💬 Answer this question:</b>\n\n`;
        }
        
        messageText += `<b>Question:</b> ${question.content}\n\n` +
          `<b>Grade Level:</b> ${formatGradeLevel(question.gradeLevel)}\n\n` +
          `<i>Type your ${isAuthor ? 'additional information' : 'answer'} below.\n` +
          `You can send text, voice messages, photos, videos, or documents.</i>`;
          
        return ctx.reply(
          messageText,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [['❌ Cancel Answering']],
              resize_keyboard: true
            }
          }
        );
      }
    }

    // Find the question by ID
    const questionId = ctx.session.answeringQuestionId;
    logger.info('Processing answer for question', {
      userId: ctx.from.id,
      questionId: questionId
    });
    
    // Validate question ID format
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      logger.error('Invalid question ID format when processing answer', { questionId });
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      return ctx.reply('❌ Invalid question reference. Please try again.', Markup.removeKeyboard());
    }
    
    let question;
    try {
      question = await Question.findById(questionId);
    } catch (dbError) {
      logger.error('Database error finding question when processing answer', {
        error: dbError.message,
        questionId
      });
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      return ctx.reply('❌ Error accessing question data. Please try again later.', Markup.removeKeyboard());
    }
    
    if (!question) {
      logger.error('Question not found when processing answer', {
        userId: ctx.from.id,
        questionId: questionId
      });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      return ctx.reply('❌ Question not found or was removed', Markup.removeKeyboard());
    }

    // Check if question is approved
    if (question.status !== 'approved') {
      logger.warn('Attempt to answer non-approved question', {
        userId: ctx.from.id,
        questionId: questionId,
        status: question.status
      });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      return ctx.reply('❌ This question is no longer available for answers', Markup.removeKeyboard());
    }

    // Get user info
    let user;
    try {
      user = await User.findOne({ telegramId: ctx.from.id.toString() });
    } catch (dbError) {
      logger.error('Database error finding user when processing answer', {
        error: dbError.message,
        userId: ctx.from.id
      });
      // Continue with default display name if user lookup fails
    }
    
    const displayName = user?.username || ctx.from.username || ctx.from.first_name || 'Anonymous';
    
    // Check if this is the author adding more info
    const isAuthor = ctx.session.isAuthorAnswer === true;

    // Determine the type of media and content
    let content = '';
    let mediaType = 'text';
    let mediaId = null;
    let mediaCaption = null;
    
    // Process different types of media
    if (ctx.message.text) {
      // Text message
      content = ctx.message.text;
      if (content.trim().length < 3) {
        return ctx.reply('❌ Your answer is too short. Please provide a more detailed response.');
      }
    } else if (ctx.message.voice) {
      // Voice message
      mediaType = 'voice';
      mediaId = ctx.message.voice.file_id;
      content = 'Voice message';
    } else if (ctx.message.photo && ctx.message.photo.length > 0) {
      // Photo
      mediaType = 'photo';
      mediaId = ctx.message.photo[ctx.message.photo.length - 1].file_id; // Get highest quality
      content = ctx.message.caption || 'Photo';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.video) {
      // Video
      mediaType = 'video';
      mediaId = ctx.message.video.file_id;
      content = ctx.message.caption || 'Video';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.audio) {
      // Audio
      mediaType = 'audio';
      mediaId = ctx.message.audio.file_id;
      content = ctx.message.caption || 'Audio';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.document) {
      // Document
      mediaType = 'document';
      mediaId = ctx.message.document.file_id;
      content = ctx.message.caption || `Document: ${ctx.message.document.file_name || 'Untitled'}`;
      mediaCaption = ctx.message.caption;
    } else {
      logger.warn('Unsupported message type in answer handler', {
        userId: ctx.from.id,
        messageKeys: Object.keys(ctx.message || {})
      });
      return ctx.reply('❌ Unsupported message type. Please send text, voice, photo, video, audio, or document.');
    }

    // Store answer data in session for confirmation
    ctx.session.answerData = {
      content,
      mediaType,
      mediaId,
      mediaCaption,
      displayName,
      isAuthor
    };
    
    ctx.session.confirmingAnswer = true;
    
    // Show confirmation message with preview of answer
    let previewText = '';
    if (mediaType === 'text') {
      previewText = content;
    } else {
      previewText = `[${mediaType.toUpperCase()}]${mediaCaption ? ': ' + mediaCaption : ''}`;
    }
    
    // Truncate if too long
    if (previewText.length > 100) {
      previewText = previewText.substring(0, 100) + '...';
    }
    
    logger.info('Showing answer confirmation', {
      userId: ctx.from.id,
      questionId: questionId,
      mediaType: mediaType,
      isAuthor: isAuthor
    });
    
    return ctx.reply(
      `<b>📝 Confirm Your ${isAuthor ? 'Additional Information' : 'Answer'}</b>\n\n` +
      `${previewText}\n\n` +
      `Are you sure you want to post this ${isAuthor ? 'information' : 'answer'}?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            ['✅ Yes, Post Answer', '❌ No, Edit Answer'],
            ['❌ Cancel Answering']
          ],
          resize_keyboard: true
        }
      }
    );
  } catch (error) {
    logger.error('Error handling answer:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id
    });
    
    // Try to clean up session state
    if (ctx.session) {
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
    }
    
    await ctx.reply('❌ Error processing answer. Please try again later.', Markup.removeKeyboard());
  }
};

// Handler for receiving replies to answers
const handleReply = async (ctx) => {
  try {
    // Add detailed logging to track the issue
    logger.info('Reply handler triggered', {
      userId: ctx.from?.id,
      hasSession: !!ctx.session,
      qaState: ctx.session?.qaState,
      replyingToAnswer: ctx.session?.replyingToAnswer,
      messageType: ctx.message ? Object.keys(ctx.message).filter(key => 
        ['text', 'photo', 'video', 'audio', 'voice', 'document'].includes(key)
      )[0] : 'unknown'
    });

    // Validate session state
    if (!ctx.session) {
      logger.warn('No session found when trying to handle reply', {
        userId: ctx.from?.id
      });
      return ctx.reply('❌ Session error. Please try replying again.', Markup.removeKeyboard());
    }
    
    if (ctx.session?.qaState !== 'awaiting_reply') {
      logger.warn('Invalid session state when trying to handle reply', {
      userId: ctx.from?.id,
        state: ctx.session?.qaState
      });
      return;
    }
    
    if (!ctx.session?.replyingToAnswer) {
      logger.warn('No reply target in session when trying to handle reply', {
        userId: ctx.from?.id
      });
      return ctx.reply('❌ Reply target lost. Please try replying again.', Markup.removeKeyboard());
    }

    // Handle cancellation
    if (ctx.message?.text === '❌ Cancel Reply') {
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
      return ctx.reply('✅ Reply cancelled', Markup.removeKeyboard());
    }
    
    const { questionId, answerIndex } = ctx.session.replyingToAnswer;
    
    // Validate question ID format
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      logger.error('Invalid question ID format when processing reply', { questionId });
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
      return ctx.reply('❌ Invalid question reference. Please try again.', Markup.removeKeyboard());
    }
    
    let question;
    try {
      question = await Question.findById(questionId);
    } catch (dbError) {
      logger.error('Database error finding question when processing reply', {
        error: dbError.message,
        questionId
      });
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
      return ctx.reply('❌ Error accessing question data. Please try again later.', Markup.removeKeyboard());
    }
    
    if (!question) {
      logger.error('Question not found when processing reply', {
        userId: ctx.from.id,
        questionId: questionId
      });
      
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
      return ctx.reply('❌ Question not found or was removed', Markup.removeKeyboard());
    }
    
    if (!question.answers || !question.answers[answerIndex]) {
      logger.error('Answer not found when processing reply', {
        userId: ctx.from.id,
        questionId,
        answerIndex
      });
      
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
      return ctx.reply('❌ Answer not found or was removed', Markup.removeKeyboard());
    }

    // Get user info
    let user;
    try {
      user = await User.findOne({ telegramId: ctx.from.id.toString() });
    } catch (dbError) {
      logger.error('Database error finding user when processing reply', {
        error: dbError.message,
        userId: ctx.from.id
      });
      // Continue with default display name if user lookup fails
    }
    
    const displayName = user?.username || ctx.from.username || ctx.from.first_name || 'Anonymous';

    // Determine the type of media and content
    let content = '';
    let mediaType = 'text';
    let mediaId = null;
    let mediaCaption = null;
    
    // Process different types of media
    if (ctx.message.text) {
      // Text message
      content = ctx.message.text;
      if (content.trim().length < 3) {
        return ctx.reply('❌ Your reply is too short. Please provide a more detailed response.');
      }
    } else if (ctx.message.voice) {
      // Voice message
      mediaType = 'voice';
      mediaId = ctx.message.voice.file_id;
      content = 'Voice message';
    } else if (ctx.message.photo && ctx.message.photo.length > 0) {
      // Photo
      mediaType = 'photo';
      mediaId = ctx.message.photo[ctx.message.photo.length - 1].file_id; // Get highest quality
      content = ctx.message.caption || 'Photo';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.video) {
      // Video
      mediaType = 'video';
      mediaId = ctx.message.video.file_id;
      content = ctx.message.caption || 'Video';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.audio) {
      // Audio
      mediaType = 'audio';
      mediaId = ctx.message.audio.file_id;
      content = ctx.message.caption || 'Audio';
      mediaCaption = ctx.message.caption;
    } else if (ctx.message.document) {
      // Document
      mediaType = 'document';
      mediaId = ctx.message.document.file_id;
      content = ctx.message.caption || `Document: ${ctx.message.document.file_name || 'Untitled'}`;
      mediaCaption = ctx.message.caption;
    } else {
      logger.warn('Unsupported message type in reply handler', {
        userId: ctx.from.id,
        messageKeys: Object.keys(ctx.message || {})
      });
      return ctx.reply('❌ Unsupported message type. Please send text, voice, photo, video, audio, or document.');
    }

    // Add reply to the answer
    const answer = question.answers[answerIndex];
    if (!answer.replies) answer.replies = [];
    
    answer.replies.push({
      userId: ctx.from.id,
      username: displayName,
      content: content,
      mediaType: mediaType,
      mediaId: mediaId,
      mediaCaption: mediaCaption,
      createdAt: new Date()
    });
    
    // Save the updated question
    try {
      await question.save();
      
      logger.info('Reply added to answer', {
        userId: ctx.from.id,
        questionId,
        answerIndex,
        mediaType,
        replyCount: answer.replies.length
      });
    } catch (saveError) {
      logger.error('Error saving reply to answer', {
        error: saveError.message,
        userId: ctx.from.id,
        questionId
      });
      
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
      
      return ctx.reply('❌ Error saving your reply. Please try again later.', Markup.removeKeyboard());
    }

    // Clear session
    ctx.session.qaState = null;
    ctx.session.replyingToAnswer = null;

    // Send confirmation to user
    await ctx.reply(
      '✅ Your reply is submitted!',
      Markup.removeKeyboard()
    );
  } catch (error) {
    logger.error('Error handling reply:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id
    });
    
    // Try to clean up session state
    if (ctx.session) {
      ctx.session.qaState = null;
      ctx.session.replyingToAnswer = null;
    }
    
    await ctx.reply('❌ Error processing reply. Please try again later.', Markup.removeKeyboard());
  }
};

// Handler for viewing answers
const handleViewAnswers = async (ctx) => {
  try {
    // Log the callback data
    logger.info('View answers button clicked', {
      userId: ctx.from?.id,
      callbackData: ctx.callbackQuery?.data
    });
    
    if (!ctx.callbackQuery?.data) {
      logger.error('Missing callback data in view answers handler', {
        userId: ctx.from?.id
      });
      return ctx.answerCbQuery('❌ Invalid view request');
    }
    
    const parts = ctx.callbackQuery.data.split('_');
    if (parts.length < 2) {
      logger.error('Invalid callback data format in view answers', {
        userId: ctx.from?.id,
        callbackData: ctx.callbackQuery.data
      });
      return ctx.answerCbQuery('❌ Invalid view format');
    }
    
    const questionId = parts[1];
    
    // Validate questionId
    if (!questionId || questionId.trim() === '') {
      logger.error('Empty question ID in view answers handler', {
        userId: ctx.from?.id,
        callbackData: ctx.callbackQuery.data
      });
      return ctx.answerCbQuery('❌ Missing question ID');
    }
    
    // Validate that questionId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      logger.error('Invalid question ID format in view answers handler', {
        userId: ctx.from?.id,
        questionId,
        callbackData: ctx.callbackQuery.data
      });
      return ctx.answerCbQuery('❌ Invalid question ID format');
    }
    
    // Find the question
    let question;
    try {
      question = await Question.findById(questionId);
    } catch (dbError) {
      logger.error('Database error finding question in view answers', {
        error: dbError.message,
        userId: ctx.from?.id,
        questionId
      });
      return ctx.answerCbQuery('❌ Error accessing question data');
    }

    if (!question) {
      logger.error('Question not found in view answers handler', {
        userId: ctx.from?.id,
        questionId
      });
      return ctx.answerCbQuery('❌ Question not found');
    }

    // If in channel/group, send to private chat with deep link
    if (ctx.chat.type !== 'private') {
      try {
        const botUsername = (await ctx.telegram.getMe()).username;
        const deepLink = `https://t.me/${botUsername}?start=view_${questionId}`;
        
        logger.info('Generated deep link for viewing answers', {
          userId: ctx.from.id,
          questionId: questionId,
          deepLink: deepLink,
          botUsername: botUsername
        });
        
        await ctx.answerCbQuery(
          '👁️ Click here to view answers in private chat',
          {
            url: deepLink,
            cache_time: 3
          }
        );
      } catch (error) {
        logger.error('Error generating view answers deep link:', {
          error: error.message,
          questionId: questionId
        });
        await ctx.answerCbQuery('❌ Error generating view link. Try messaging the bot directly.');
      }
      return;
    }

    if (!question.answers || question.answers.length === 0) {
      logger.info('No answers available for question', {
        userId: ctx.from?.id,
        questionId
      });
      return ctx.answerCbQuery('❌ No answers yet for this question');
    }

    // Show question first
    const questionMessage = `<b>📝 Question:</b>\n${question.content}\n\n<b>Grade Level:</b> ${formatGradeLevel(question.gradeLevel)}\n\n<b>Total Answers:</b> ${question.answers.length}`;
    
    // Count regular answers and author updates
    const regularAnswers = question.answers.filter(a => !a.isAuthorUpdate);
    const authorUpdates = question.answers.filter(a => a.isAuthorUpdate);
    
    try {
      // Send question first
      await ctx.reply(questionMessage, { parse_mode: 'HTML' });
      
      // Show author updates first if any
      if (authorUpdates.length > 0) {
        await ctx.reply(`<b>📌 Updates from Question Author (${authorUpdates.length}):</b>`, { parse_mode: 'HTML' });
        
        for (let i = 0; i < authorUpdates.length; i++) {
          const update = authorUpdates[i];
          const date = new Date(update.createdAt).toLocaleDateString();
          let updateMessage = `<b>📌 Author Update ${i + 1} (${date}):</b>\n\n`;
          
          if (update.mediaType && update.mediaType !== 'text') {
            updateMessage += `[${update.mediaType.toUpperCase()}] ${update.mediaCaption || update.content}`;
          } else {
            updateMessage += update.content;
          }
          
          await ctx.reply(updateMessage, { parse_mode: 'HTML' });
        }
      }
      
      // Show regular answers one by one
      if (regularAnswers.length > 0) {
        await ctx.reply(`<b>💬 Answers from Others (${regularAnswers.length}):</b>`, { parse_mode: 'HTML' });
        
        for (let i = 0; i < regularAnswers.length; i++) {
          const answer = regularAnswers[i];
          const date = new Date(answer.createdAt).toLocaleDateString();
          const right = answer.reactions?.right || 0;
          const wrong = answer.reactions?.wrong || 0;
          
          let answerMessage = `<b>💬 Answer ${i + 1} by Anonymous (${date}):</b>\n\n`;
          
          if (answer.mediaType && answer.mediaType !== 'text') {
            answerMessage += `[${answer.mediaType.toUpperCase()}] ${answer.mediaCaption || answer.content}`;
          } else {
            answerMessage += answer.content;
          }
          
          // Create keyboard for this specific answer
          const answerKeyboard = {
            inline_keyboard: [
              [
                Markup.button.callback(`✅ ${right}`, `ans_right_${questionId}_${i}`),
                Markup.button.callback(`❌ ${wrong}`, `ans_wrong_${questionId}_${i}`),
                Markup.button.callback('↩️ Reply', `ans_reply_${questionId}_${i}`)
              ]
            ]
          };
          
          await ctx.reply(answerMessage, { 
            parse_mode: 'HTML', 
            reply_markup: answerKeyboard 
          });
        }
      } else {
        await ctx.reply("No answers from others yet.", { parse_mode: 'HTML' });
      }
      
      // Add navigation buttons
      const navKeyboard = {
        inline_keyboard: [
          [Markup.button.callback('🔙 Back to Question', `answer_${questionId}`)],
          [Markup.button.callback('📝 Add Answer', `answer_${questionId}`)]
        ]
      };
      
      await ctx.reply("Use the buttons above to react to answers or reply to them.", { 
        parse_mode: 'HTML', 
        reply_markup: navKeyboard 
      });
      
      logger.info('Answers displayed successfully', {
        userId: ctx.from?.id,
        questionId,
        answerCount: question.answers.length
      });
      
      await ctx.answerCbQuery();
    } catch (replyError) {
      logger.error('Error sending answers message', {
        error: replyError.message,
        userId: ctx.from?.id,
        questionId
      });
      await ctx.answerCbQuery('❌ Error displaying answers');
    }
  } catch (error) {
    logger.error('Error viewing answers:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id,
      callbackData: ctx.callbackQuery?.data
    });
    await ctx.answerCbQuery('❌ Error loading answers');
  }
};

// Reaction handlers
const clampIndex = (question, idx) => {
  if (!question.answers) return -1;
  if (idx < 0 || idx >= question.answers.length) return -1;
  return idx;
};

const handleAnswerReaction = (type) => async (ctx) => {
  try {
    const data = ctx.callbackQuery?.data || '';
    const parts = data.split('_'); // ans_right_<qid>_<idx>
    const questionId = parts[2];
    const answerIndex = parseInt(parts[3], 10);
    if (!mongoose.Types.ObjectId.isValid(questionId)) return ctx.answerCbQuery('❌ Invalid');
    const question = await Question.findById(questionId);
    if (!question) return ctx.answerCbQuery('❌ Not found');
    const idx = clampIndex(question, answerIndex);
    if (idx === -1) return ctx.answerCbQuery('❌ Invalid');
    question.answers[idx].reactions = question.answers[idx].reactions || { right: 0, wrong: 0 };
    if (type === 'right') question.answers[idx].reactions.right += 1; else question.answers[idx].reactions.wrong += 1;
    await question.save();
    return ctx.answerCbQuery('✅ Recorded');
  } catch (e) {
    logger.error('handleAnswerReaction error:', e);
    return ctx.answerCbQuery('❌ Error');
  }
};

// Start reply to specific answer
const handleStartReplyToAnswer = async (ctx) => {
  try {
    const data = ctx.callbackQuery?.data || '';
    const parts = data.split('_'); // ans_reply_<qid>_<idx>
    const questionId = parts[2];
    const answerIndex = parseInt(parts[3], 10);
    if (!mongoose.Types.ObjectId.isValid(questionId)) return ctx.answerCbQuery('❌ Invalid');
    const question = await Question.findById(questionId);
    if (!question) return ctx.answerCbQuery('❌ Not found');
    const idx = clampIndex(question, answerIndex);
    if (idx === -1) return ctx.answerCbQuery('❌ Invalid');
    ctx.session = ctx.session || {};
    ctx.session.qaState = 'awaiting_reply';
    ctx.session.replyingToAnswer = { questionId, answerIndex: idx };
    await ctx.reply('↩️ Type your reply. You can send text, voice, photo, video, or document.', {
      reply_markup: { keyboard: [['❌ Cancel Reply']], resize_keyboard: true }
    });
    return ctx.answerCbQuery();
  } catch (e) {
    logger.error('handleStartReplyToAnswer error:', e);
    return ctx.answerCbQuery('❌ Error');
  }
};

// Helper function to format grade level for display
const formatGradeLevel = (grade) => {
  const gradeMap = {
    'grade6': 'Grade 6',
    'grade7': 'Grade 7',
    'grade8': 'Grade 8',
    'grade9': 'Grade 9',
    'grade10': 'Grade 10',
    'grade11': 'Grade 11',
    'grade12': 'Grade 12',
    'university': 'University',
    'other': 'Other'
  };
  return gradeMap[grade] || grade;
};

// Helper function to check if a user is admin
const isUserAdmin = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId: telegramId.toString() });
    return user?.isAdmin === true;
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
};

// Helper function to update the channel message with current answer count
const updateChannelMessage = async (question) => {
  try {
    if (!question) {
      logger.error('No question object provided to updateChannelMessage');
      return;
    }
    
    if (!question._id) {
      logger.error('Question missing ID in updateChannelMessage');
      return;
    }
    
    if (!question.channelMessageId) {
      logger.error('No channel message ID for question', { 
        questionId: question._id.toString() 
      });
      return;
    }
    
    // Check if channel ID is configured
    if (!config.telegram.channelId) {
      logger.error('Channel ID not configured in updateChannelMessage', { 
        questionId: question._id.toString() 
      });
      return;
    }
    
    const answerCount = question.answers ? question.answers.length : 0;
    
    // Create a new bot instance to avoid conflicts
    try {
      const bot = new Telegraf(config.telegram.token);
      
      const botUsername = (await bot.telegram.getMe()).username;
      const answerDeepLink = `https://t.me/${botUsername}?start=answer_${question._id}`;
      const viewAnswersDeepLink = `https://t.me/${botUsername}?start=view_${question._id}`;
      await bot.telegram.editMessageReplyMarkup(
        config.telegram.channelId,
        question.channelMessageId,
        undefined,
        {
          inline_keyboard: [
            [
              { text: '💬 Answer this Question', url: answerDeepLink },
              { text: `👁️ View Answers (${answerCount})`, url: viewAnswersDeepLink }
            ]
          ]
        }
      );
      
      logger.info('Channel message updated with new answer count', {
        questionId: question._id.toString(),
        channelMessageId: question.channelMessageId,
        answerCount
      });
    } catch (botError) {
      logger.error('Error creating bot instance in updateChannelMessage', {
        error: botError.message,
        questionId: question._id.toString()
      });
    }
  } catch (error) {
    logger.error('Error updating channel message:', {
      error: error.message,
      stack: error.stack,
      questionId: question?._id?.toString()
    });
  }
};

// Helper function to post answer after confirmation
const postAnswerToQuestion = async (ctx) => {
  try {
    // Get data from session
    const questionId = ctx.session.answeringQuestionId;
    const answerData = ctx.session.answerData;
    
    // Add detailed logging
    logger.info('Posting confirmed answer', {
      userId: ctx.from?.id,
      questionId,
      hasAnswerData: !!answerData,
      mediaType: answerData?.mediaType
    });
    
    if (!questionId || !answerData) {
      logger.error('Missing data when posting confirmed answer', {
        userId: ctx.from.id,
        hasQuestionId: !!questionId,
        hasAnswerData: !!answerData
      });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      
      return ctx.reply('❌ Error posting answer. Please try again.', Markup.removeKeyboard());
    }
    
    // Validate question ID format
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      logger.error('Invalid question ID format when posting confirmed answer', { questionId });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      
      return ctx.reply('❌ Invalid question reference. Please try again.', Markup.removeKeyboard());
    }
    
    // Find the question
    let question;
    try {
      question = await Question.findById(questionId);
    } catch (dbError) {
      logger.error('Database error finding question when posting confirmed answer', {
        error: dbError.message,
        questionId
      });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      
      return ctx.reply('❌ Error accessing question data. Please try again later.', Markup.removeKeyboard());
    }
    
    if (!question) {
      logger.warn('Question not found when posting confirmed answer', { questionId });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      
      return ctx.reply('❌ Question not found or was removed', Markup.removeKeyboard());
    }
    
    // Check if question is still approved
    if (question.status !== 'approved') {
      logger.warn('Attempt to answer non-approved question when posting confirmed answer', {
        userId: ctx.from.id,
        questionId,
        status: question.status
      });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      
      return ctx.reply('❌ This question is no longer available for answers', Markup.removeKeyboard());
    }
    
    // Extract data
    const { content, mediaType, mediaId, mediaCaption, displayName, isAuthor } = answerData;
    
    // Add answer to question
    question.answers = question.answers || [];
    question.answers.push({
      userId: ctx.from.id,
      username: displayName,
      content: content,
      mediaType: mediaType,
      mediaId: mediaId,
      mediaCaption: mediaCaption,
      createdAt: new Date(),
      isAuthorUpdate: isAuthor
    });
    
    // Save the updated question with the new answer
    try {
      await question.save();
      
      logger.info('Answer added to question', {
        userId: ctx.from.id,
        questionId,
        isAuthor,
        mediaType,
        answerCount: question.answers.length
      });
    } catch (saveError) {
      logger.error('Error saving answer to question', {
        error: saveError.message,
        userId: ctx.from.id,
        questionId
      });
      
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
      
      return ctx.reply('❌ Error saving your answer. Please try again later.', Markup.removeKeyboard());
    }

    // Update the original message with new answer count
    try {
      await updateChannelMessage(question);
    } catch (error) {
      logger.error('Error updating answer count:', {
        error: error.message,
        questionId
      });
      // Continue even if update fails
    }

    // Clear session
    ctx.session.qaState = null;
    ctx.session.answeringQuestionId = null;
    ctx.session.isAuthorAnswer = null;
    ctx.session.confirmingAnswer = false;
    ctx.session.answerData = null;

    // Send confirmation to user
    await ctx.reply(
      isAuthor
        ? '✅ Your additional information has been posted!'
        : '✅ Your answer has been posted!',
      Markup.removeKeyboard()
    );
  } catch (error) {
    logger.error('Error posting confirmed answer:', {
      error: error.message,
      stack: error.stack,
      userId: ctx.from?.id
    });
    
    // Clean up session state
    if (ctx.session) {
      ctx.session.qaState = null;
      ctx.session.answeringQuestionId = null;
      ctx.session.isAuthorAnswer = null;
      ctx.session.confirmingAnswer = false;
      ctx.session.answerData = null;
    }
    
    await ctx.reply('❌ Error posting answer. Please try again later.', Markup.removeKeyboard());
  }
};

module.exports = {
  askQuestionHandler,
  handleQuestionContent,
  handleGradeSelection,
  handleApproval,
  handleAnswerButton,
  handleAnswer,
  handleViewAnswers,
  handleAnswerReaction,
  handleStartReplyToAnswer,
  formatGradeLevel,
  updateChannelMessage,
  postAnswerToQuestion,
  handleReply
}; 