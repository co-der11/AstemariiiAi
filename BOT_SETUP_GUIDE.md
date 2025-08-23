# Telegram Bot Setup Guide

## 🔧 Current Issue
Your bot token is invalid and returning "Unauthorized" error. Here's how to fix it:

## 📱 Step 1: Create a New Bot

1. **Open Telegram** and search for `@BotFather`
2. **Send the command**: `/newbot`
3. **Follow the prompts**:
   - Enter a name for your bot (e.g., "Student Helper Bot")
   - Enter a username for your bot (must end with 'bot', e.g., "student_helper_bot")
4. **Copy the token** provided by BotFather (it looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## 🔑 Step 2: Update Your .env File

1. **Open your `.env` file** in the project root
2. **Replace the current token** with your new token:
   ```
   TELEGRAM_BOT_TOKEN=your_new_token_here
   ```
3. **Make sure there are no extra spaces** around the equals sign
4. **Save the file**

## ✅ Step 3: Test Your Bot

Run the test script to verify your token:
```bash
node test-bot.js
```

You should see:
```
✅ Bot token is valid!
Bot name: Your Bot Name
Bot username: @your_bot_username
Bot ID: 123456789
```

## 🚀 Step 4: Start Your Bot

Once the token is valid, start your bot:
```bash
npm start
```

## 🔍 Troubleshooting

### If you still get "Unauthorized":
1. **Double-check the token** - Make sure you copied it exactly
2. **Check for extra characters** - No spaces, quotes, or extra characters
3. **Verify the bot exists** - Go to @BotFather and send `/mybots` to see your bots
4. **Try a new bot** - Create a completely new bot with a different username

### Common Token Format Issues:
- ❌ `TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"`
- ❌ `TELEGRAM_BOT_TOKEN= 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
- ✅ `TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

## 📋 Example .env File

```
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHANNEL_ID=your_channel_id_here
TELEGRAM_CHANNEL_LINK=your_channel_link_here
ADMIN_IDS=5752137292

# MongoDB Configuration
MONGODB_URI=mongodb+srv://amirhusengh:10203040Ye@cluster0.qjwdzxl.mongodb.net/studenthelperbot?retryWrites=true&w=majority&appName=Cluster0

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=bot.log
```

## 🆘 Need Help?

If you're still having issues:
1. Run `node test-bot.js` to check your token
2. Make sure your bot is not deleted or banned
3. Try creating a new bot with a different username
4. Check that your `.env` file is in the project root directory 