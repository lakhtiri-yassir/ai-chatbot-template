# 🚀 Deployment Guide - Vercel

This guide will help you deploy your AI chatbot template to Vercel, which provides excellent support for both frontend and backend deployments.

## 📋 Prerequisites

Before deploying, ensure you have:

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)
4. **External Services**: Set up the following external services:
   - **MongoDB Atlas** (or any MongoDB instance)
   - **Redis Cloud** (or any Redis instance)
   - **OpenRouter API Key**

## 🔧 External Services Setup

### 1. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create a database user with read/write permissions
4. Get your connection string
5. Add your IP to the whitelist (or use `0.0.0.0/0` for all IPs)

### 2. Redis Cloud Setup

1. Go to [Redis Cloud](https://redis.com/try-free/)
2. Create a free database
3. Get your connection string
4. Note down your password

### 3. OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up and get your API key
3. Choose your preferred AI model

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

Ensure your repository structure is correct:

```
ai-chatbot-template/
├── apps/
│   ├── backend/
│   │   ├── api/
│   │   │   └── index.js          # Vercel API handler
│   │   ├── src/
│   │   ├── package.json
│   │   └── vercel.json
│   └── frontend/
│       ├── src/
│       ├── package.json
│       └── vercel.json
├── vercel.json                   # Root Vercel config
└── README.md
```

### Step 2: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 3: Login to Vercel

```bash
vercel login
```

### Step 4: Configure Environment Variables

Create a `.env.local` file in your project root (for local development):

```env
# Backend Environment Variables
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-chatbot
REDIS_URL=redis://username:password@host:port
OPENROUTER_API_KEY=your-openrouter-api-key
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app

# Frontend Environment Variables
VITE_API_URL=https://your-app.vercel.app/api
VITE_APP_NAME=AI Chatbot
```

### Step 5: Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Connect Repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your Git repository
   - Select the repository

2. **Configure Project**:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root of your project)
   - **Build Command**: Leave empty (handled by vercel.json)
   - **Output Directory**: Leave empty (handled by vercel.json)

3. **Set Environment Variables**:
   - Add all environment variables from Step 4
   - Make sure to set `NODE_ENV=production`

4. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete

#### Option B: Deploy via CLI

```bash
# Navigate to your project root
cd ai-chatbot-template

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? [Select your account]
# - Link to existing project? N
# - What's your project's name? ai-chatbot-template
# - In which directory is your code located? ./
```

### Step 6: Configure Custom Domain (Optional)

1. Go to your Vercel dashboard
2. Select your project
3. Go to "Settings" → "Domains"
4. Add your custom domain
5. Update your environment variables with the new domain

## 🔧 Post-Deployment Configuration

### 1. Update Frontend API URL

After deployment, update your frontend environment variables with the actual Vercel URL:

```env
VITE_API_URL=https://your-app.vercel.app/api
VITE_SOCKET_URL=https://your-app.vercel.app
```

### 2. Test Your Deployment

1. **Health Check**: Visit `https://your-app.vercel.app/api/health`
2. **Frontend**: Visit `https://your-app.vercel.app`
3. **API Endpoints**: Test your API endpoints

### 3. Monitor Your Application

- Check Vercel dashboard for deployment status
- Monitor function logs in the Vercel dashboard
- Set up error tracking (optional)

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit sensitive data to your repository
- Use Vercel's environment variable management
- Rotate API keys regularly

### 2. CORS Configuration
- Update CORS settings in your backend to allow your Vercel domain
- Remove localhost from production CORS settings

### 3. Rate Limiting
- Ensure rate limiting is properly configured
- Monitor API usage in Vercel dashboard

## 📊 Monitoring and Analytics

### Vercel Analytics
- Enable Vercel Analytics in your dashboard
- Monitor performance metrics
- Track user behavior

### Error Tracking
- Set up error tracking (e.g., Sentry)
- Monitor function errors in Vercel dashboard
- Set up alerts for critical errors

## 🔄 Continuous Deployment

### Automatic Deployments
- Vercel automatically deploys on every push to your main branch
- Set up branch deployments for testing
- Configure preview deployments for pull requests

### Environment Management
- Use different environment variables for different environments
- Set up staging and production environments
- Use Vercel's environment variable management

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are properly installed
   - Verify Node.js version compatibility

2. **API Errors**:
   - Check function logs in Vercel dashboard
   - Verify environment variables are set correctly
   - Test API endpoints locally first

3. **Database Connection Issues**:
   - Verify MongoDB connection string
   - Check IP whitelist settings
   - Ensure Redis connection is working

4. **CORS Errors**:
   - Update CORS configuration with correct domain
   - Check frontend API URL configuration

### Debug Commands

```bash
# Check Vercel CLI version
vercel --version

# List your projects
vercel ls

# View deployment logs
vercel logs

# Pull environment variables
vercel env pull .env.local

# Redeploy
vercel --prod
```

## 📈 Performance Optimization

### 1. Function Optimization
- Keep functions lightweight
- Use connection pooling for databases
- Implement proper caching strategies

### 2. Frontend Optimization
- Optimize bundle size
- Use CDN for static assets
- Implement proper caching headers

### 3. Database Optimization
- Use indexes for frequently queried fields
- Implement connection pooling
- Monitor query performance

## 🔄 Updates and Maintenance

### Regular Updates
- Keep dependencies updated
- Monitor security advisories
- Update environment variables as needed

### Backup Strategy
- Regular database backups
- Version control for configuration
- Document deployment procedures

## 📞 Support

If you encounter issues:

1. Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
2. Review Vercel community: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
3. Contact Vercel support for account-specific issues

---

**Happy Deploying! 🚀** 