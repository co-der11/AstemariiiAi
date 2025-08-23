const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  userId: {
    type: Number,  // Telegram user ID
    required: true
  },
  username: String,    // Telegram username if available
  firstName: String,   // User's first name if available
  content: String,     // Text or caption for the question
  mediaType: {
    type: String,
    enum: ['text', 'photo', 'video', 'audio', 'voice', 'document', null],
    default: 'text'
  },
  mediaId: String,     // Telegram file_id for media (if any)
  mediaCaption: String, // Caption for media files (if any)
  gradeLevel: {
    type: String,
    enum: ['grade6', 'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12', 'university'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending'
  },
  adminMessageId: Number,  // Message ID in admin channel
  channelMessageId: Number, // Message ID in main channel after approval
  createdAt: {
    type: Date,
    default: Date.now
  },
  approvedBy: String,  // Admin ID who approved
  approvedAt: Date,
  rejectedBy: String,  // Admin ID who rejected
  rejectedAt: Date,
  rejectionReason: String,  // Reason for rejection
  answers: [{
    userId: Number,
    username: String,
    content: String,
    mediaType: {
      type: String,
      enum: ['text', 'photo', 'video', 'audio', 'voice', 'document'],
      default: 'text'
    },
    mediaId: String,  // Telegram file_id for media
    mediaCaption: String, // Caption for media files
    createdAt: {
      type: Date,
      default: Date.now
    },
    isAuthorUpdate: {
      type: Boolean,
      default: false
    },
    reactions: {
      right: {
        type: Number,
        default: 0
      },
      wrong: {
        type: Number,
        default: 0
      }
    },
    replies: [{
      userId: Number,
      username: String,
      content: String,
      mediaType: {
        type: String,
        enum: ['text', 'photo', 'video', 'audio', 'voice', 'document'],
        default: 'text'
      },
      mediaId: String,
      mediaCaption: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }]
});

// Static method to find question by ID with validation
questionSchema.statics.findByIdSafe = async function(id) {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await this.findById(id);
  } catch (error) {
    console.error('Error finding question by ID:', error);
    return null;
  }
};

// Method to add an answer to a question
questionSchema.methods.addAnswer = async function(userId, content, options = {}) {
  this.answers = this.answers || [];
  
  const answer = {
    userId,
    username: options.username || 'Anonymous',
    content,
    mediaType: options.mediaType || 'text',
    mediaId: options.mediaId || null,
    mediaCaption: options.mediaCaption || null,
    createdAt: new Date(),
    isAuthorUpdate: options.isAuthorUpdate || false
  };
  
  this.answers.push(answer);
  await this.save();
  return answer;
};

// Method to get regular answers (not author updates)
questionSchema.methods.getRegularAnswers = function() {
  if (!this.answers || this.answers.length === 0) {
    return [];
  }
  return this.answers.filter(answer => !answer.isAuthorUpdate);
};

// Method to get author updates
questionSchema.methods.getAuthorUpdates = function() {
  if (!this.answers || this.answers.length === 0) {
    return [];
  }
  return this.answers.filter(answer => answer.isAuthorUpdate);
};

const Question = mongoose.model('Question', questionSchema);

module.exports = Question; 