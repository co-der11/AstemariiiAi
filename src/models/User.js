const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  username: String,
  firstName: String,
  lastName: String,
  phoneNumber: String,
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: String,
  bannedAt: Date,
  bannedBy: String,
  isAdmin: {
    type: Boolean,
    default: false
  },
  adminRole: {
    type: String,
    enum: ['super', 'content', 'support', null],
    default: null
  },
  adminPermissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_content',
      'manage_settings',
      'send_broadcast',
      'view_stats',
      'approve_content',
      'handle_reports'
    ]
  }],
  adminAddedBy: String,
  adminAddedAt: Date,
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  answers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Answer'
  }],
  materials: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material'
  }],
  downloads: {
    materials: [{
      materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material'
      },
      downloadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    totalDownloads: {
      type: Number,
      default: 0
    }
  },
  examAttempts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt'
  }],
  // expertRequests removed in QA-only mode
  lastActive: {
    type: Date,
    default: Date.now
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  settings: {
    notifications: {
      type: Boolean,
      default: true
    }
  },
  // New user onboarding fields
  hasSubscribedToChannel: {
    type: Boolean,
    default: false
  },
  hasSharedContact: {
    type: Boolean,
    default: false
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  stats: {
    questionsAsked: {
      type: Number,
      default: 0
  },
    answersGiven: {
      type: Number,
      default: 0
    },
    materialsUploaded: {
      type: Number,
      default: 0
    },
    examsCompleted: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Helper method to create or update user
userSchema.statics.createOrUpdate = async function(userData) {
  try {
    const { id, username, first_name, last_name } = userData;
    
    if (!id) {
      console.error('User ID is missing in createOrUpdate');
      throw new Error('User ID is required');
    }
    
    const telegramId = id.toString();
    console.log(`Attempting to createOrUpdate user with telegramId: ${telegramId}`);
    
    try {
      // First try to find the user
      let user = await this.findOne({ telegramId });
      
      if (user) {
        console.log(`User found, updating: ${telegramId}`);
        // Update existing user
        user.username = username || user.username;
        user.firstName = first_name || user.firstName;
        user.lastName = last_name || user.lastName;
        user.lastActive = new Date();
        
        // Handle potential data corruption in downloads.materials
        if (user.downloads && typeof user.downloads.materials === 'string') {
          try {
            // If it's a string but should be an array, try to fix it
            console.log(`Fixing corrupted downloads.materials for user ${telegramId}`);
            user.downloads.materials = [];
          } catch (parseError) {
            console.error(`Failed to fix corrupted downloads.materials for user ${telegramId}:`, parseError);
            user.downloads.materials = [];
          }
        }
        
        await user.save();
        console.log(`User updated successfully: ${telegramId}`);
        return user;
      } else {
        console.log(`User not found, creating new: ${telegramId}`);
        // Create new user
        user = new this({
          telegramId,
          username,
          firstName: first_name,
          lastName: last_name,
          lastActive: new Date(),
          isActive: true
        });
        await user.save();
        console.log(`New user created successfully: ${telegramId}`);
        return user;
      }
    } catch (dbError) {
      console.error(`Database operation failed for user ${telegramId}:`, dbError);
      
      // Try a simpler approach as fallback
      if (dbError.name === 'MongoServerError' && dbError.code === 11000) {
        // Handle duplicate key error
        console.log(`Duplicate key error for ${telegramId}, trying to retrieve existing user`);
        const existingUser = await this.findOne({ telegramId });
        if (existingUser) {
          console.log(`Retrieved existing user: ${telegramId}`);
          return existingUser;
        }
      }
      
      // If error is related to downloads.materials, try to fix it
      if (dbError.message && dbError.message.includes('downloads.materials')) {
        console.log(`Attempting to fix downloads.materials error for user ${telegramId}`);
        try {
          // Find the user without validation
          const userToFix = await this.findOne({ telegramId }).lean();
          if (userToFix) {
            // Create a new user object with fixed data
            const fixedUser = {
              ...userToFix,
              downloads: {
                materials: [],
                totalDownloads: userToFix.downloads?.totalDownloads || 0
              }
            };
            
            // Update the user with the fixed data
            await this.findOneAndUpdate({ telegramId }, fixedUser, { 
              runValidators: false,
              upsert: false
            });
            
            console.log(`Fixed user data for ${telegramId}`);
            return await this.findOne({ telegramId });
          }
        } catch (fixError) {
          console.error(`Failed to fix user data for ${telegramId}:`, fixError);
        }
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('Error in createOrUpdate:', error);
    throw error;
  }
};

// Method to check if user has specific admin permission
userSchema.methods.hasPermission = function(permission) {
  return this.isAdmin && this.adminPermissions.includes(permission);
};

// Method to add admin permission
userSchema.methods.addPermission = async function(permission) {
  if (!this.adminPermissions.includes(permission)) {
    this.adminPermissions.push(permission);
    await this.save();
  }
  return this;
};

// Method to remove admin permission
userSchema.methods.removePermission = async function(permission) {
  this.adminPermissions = this.adminPermissions.filter(p => p !== permission);
  await this.save();
  return this;
};

// Method to make user an admin
userSchema.methods.makeAdmin = async function(addedBy, role = 'support') {
  this.isAdmin = true;
  this.adminRole = role;
  this.adminAddedBy = addedBy;
  this.adminAddedAt = new Date();
  
  // Set default permissions based on role
  switch (role) {
    case 'super':
      this.adminPermissions = [
        'manage_users',
        'manage_content',
        'manage_settings',
        'send_broadcast',
        'view_stats',
        'approve_content',
        'handle_reports'
      ];
      break;
    case 'content':
      this.adminPermissions = [
        'manage_content',
        'approve_content',
        'view_stats'
      ];
      break;
    case 'support':
      this.adminPermissions = [
        'view_stats',
        'handle_reports'
      ];
      break;
  }

  await this.save();
  return this;
};

// Method to remove admin status
userSchema.methods.removeAdmin = async function() {
  this.isAdmin = false;
  this.adminRole = null;
  this.adminPermissions = [];
  this.adminAddedBy = null;
  this.adminAddedAt = null;
  await this.save();
  return this;
};

// Method to ban user
userSchema.methods.ban = async function(reason, bannedBy) {
  this.isBanned = true;
  this.banReason = reason;
  this.bannedBy = bannedBy;
  this.bannedAt = new Date();
  await this.save();
  return this;
};

// Method to unban user
userSchema.methods.unban = async function() {
  this.isBanned = false;
  this.banReason = null;
  this.bannedBy = null;
  this.bannedAt = null;
  await this.save();
  return this;
};

// Static method to get admin statistics
userSchema.statics.getAdminStats = async function() {
  return {
    total: await this.countDocuments(),
    active: await this.countDocuments({ isActive: true }),
    banned: await this.countDocuments({ isBanned: true }),
    admins: await this.countDocuments({ isAdmin: true }),
    todayActive: await this.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24*60*60*1000) }
    })
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User; 