# ✅ Deployment Checklist

## 🔧 Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All changes committed to GitHub
- [ ] `package.json` updated with new dependencies
- [ ] `render.yaml` created
- [ ] `Dockerfile` created
- [ ] `.dockerignore` created
- [ ] `ecosystem.config.js` created
- [ ] Health check endpoints added

### 2. Environment Variables Ready
- [ ] `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
- [ ] `TELEGRAM_CHANNEL_ID` - Your channel ID or username
- [ ] `TELEGRAM_CHANNEL_LINK` - Your channel link
- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `ADMIN_IDS` - Admin Telegram IDs (comma-separated)
- [ ] `NODE_ENV` - Set to `production`
- [ ] `LOG_LEVEL` - Set to `info`

### 3. Database Setup
- [ ] MongoDB Atlas account created
- [ ] Database cluster running
- [ ] Connection string copied
- [ ] Network access configured (0.0.0.0/0 for Render)

### 4. Bot Setup
- [ ] Bot created with @BotFather
- [ ] Bot token copied
- [ ] Bot added to your channel as admin
- [ ] Channel ID/username noted

## 🚀 Deployment Steps

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign in/Sign up
3. Click **"New +"** → **"Web Service"**
4. Connect GitHub repository
5. Select `studenthelperbot` repository
6. Configure service settings
7. Set environment variables
8. Deploy

### Step 3: Verify Deployment
- [ ] Build completes successfully
- [ ] Service shows "Live" status
- [ ] Health check endpoint responds
- [ ] Bot responds to commands
- [ ] Admin commands work
- [ ] Database connection established

## 🔍 Post-Deployment Verification

### 1. Health Check
- Visit: `https://your-bot-name.onrender.com/health`
- Should return JSON with status: "healthy"

### 2. Bot Functionality
- [ ] `/start` command works
- [ ] `/help` command works
- [ ] `/ask` command works
- [ ] Admin commands work (if you're admin)
- [ ] Questions can be asked and answered

### 3. Database
- [ ] Users can register
- [ ] Questions are saved
- [ ] Admin can see pending questions

## 🚨 Troubleshooting

### Common Issues:
1. **Build Fails**: Check package.json dependencies
2. **Bot Won't Start**: Verify environment variables
3. **Database Connection**: Check MongoDB URI and network access
4. **Bot Not Responding**: Check logs for errors

### Debug Commands:
- Check logs in Render dashboard
- Test health endpoint
- Verify environment variables
- Check MongoDB connection

## 📞 Support Resources

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Help](https://docs.atlas.mongodb.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Node.js Documentation](https://nodejs.org/docs/)

---

**Ready to Deploy! 🚀**
