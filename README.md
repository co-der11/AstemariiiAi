# Student Helper Telegram Bot

## Features

- **Q&A Service**: Users can ask and answer questions. Admins approve or reject questions.
- **Channel Subscription & Contact**: Users must subscribe to a channel and share contact to use the bot.

## Project Structure

See `PROJECT_STRUCTURE.md` for a detailed directory layout.

## Usage

1. **Q&A Service**
   - Users: Use `/ask` to submit a question. Answer questions posted by others.
   - Admins: Approve or reject questions before they are posted.

2. **Channel Subscription & Contact**
   - Users must subscribe to the specified channel and share their contact to use the bot.

## Removed Features

- Tutoring sessions and Expert support features have been removed.
- Exam system, achievements, library, material sharing, profile, and unrelated features remain removed for a focused, minimal bot.

## Setup

1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure environment variables in `.env` and `src/config/config.js`.
4. Start the bot: `node src/index.js`

---

For more details, see the code and comments in each handler file.
