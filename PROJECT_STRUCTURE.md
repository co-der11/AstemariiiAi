# Project Structure (Updated)

## Core Features
- **Q&A Service**: Users can ask and answer questions. Admins approve or reject questions.
- **Channel Subscription & Contact**: Users must subscribe to a channel and share contact to use the bot.

## Directory Layout

```
src/
  config/
    config.js                # Configuration (tokens, DB, etc.)
  handlers/
    authHandler.js           # Handles /start, subscription, contact sharing
    qaHandler.js             # Q&A logic (ask, answer, approve, reject)
    adminHandler.js          # Admin logic (question approvals, broadcast)
  middlewares/
    channelSubscription.js   # Channel subscription check (untouched)
  models/
    User.js                  # User schema
    Question.js              # Q&A questions
  index.js                   # Main bot entry point

# Removed
- All exam, achievement, library, material, profile, and help handlers/models/services/utilities.
- All logs, test-db.js, and unrelated middleware.
```

## Usage
- Bot is QA-only. Tutoring and Expert Support features have been removed.