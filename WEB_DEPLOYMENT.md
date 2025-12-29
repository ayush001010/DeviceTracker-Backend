# Web Dashboard Deployment Guide

This guide covers deploying the Mee web dashboard to various hosting platforms.

## ✅ Pre-Deployment Checklist

- [x] Backend is deployed and working: `https://devicetracker-backend.onrender.com`
- [x] Web dashboard is configured to use production backend (already done in `web/app.js`)
- [ ] Choose a hosting platform
- [ ] Deploy the `web/` folder

---

## Option 1: Netlify (Easiest - Recommended) ⭐

### Method A: Drag & Drop (No account needed for testing)

1. **Go to**: https://app.netlify.com/drop
2. **Drag and drop** the entire `web/` folder onto the page
3. **Wait** for deployment (30-60 seconds)
4. **Your site is live!** You'll get a URL like `https://random-name-12345.netlify.app`

### Method B: With Netlify Account (Better for production)

1. **Sign up/Login**: https://app.netlify.com (use GitHub, Google, or Email)
2. **Click**: "Add new site" → "Deploy manually"
3. **Drag and drop** the `web/` folder
4. **Wait** for deployment
5. **Optional**: Add custom domain in Site settings → Domain management

### Method C: Git Integration (Best for updates)

1. **Push your code to GitHub** (if not already)
2. **Go to**: https://app.netlify.com
3. **Click**: "Add new site" → "Import an existing project"
4. **Connect GitHub** and select your repository
5. **Configure**:
   - **Base directory**: `web`
   - **Build command**: (leave empty - it's a static site)
   - **Publish directory**: `web`
6. **Deploy!**

**Advantages**: 
- ✅ Free SSL certificate
- ✅ Custom domain support
- ✅ Automatic deployments on git push
- ✅ CDN included

---

## Option 2: Vercel

### Method A: Using Vercel CLI

```bash
# Navigate to web folder
cd web

# Login to Vercel (first time only)
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? mee-dashboard (or any name)
# - Directory? ./
# - Override settings? No
```

### Method B: Using Vercel Website

1. **Go to**: https://vercel.com
2. **Sign up/Login** (use GitHub recommended)
3. **Click**: "Add New Project"
4. **Import** your GitHub repository (or upload manually)
5. **Configure**:
   - **Framework Preset**: Other
   - **Root Directory**: `web`
   - **Build Command**: (leave empty)
   - **Output Directory**: `web`
6. **Deploy!**

**Advantages**:
- ✅ Free SSL certificate
- ✅ Custom domain support
- ✅ Automatic deployments
- ✅ Fast CDN

---

## Option 3: GitHub Pages

1. **Push your code to GitHub** (if not already)
2. **Go to your repository** on GitHub
3. **Click**: Settings → Pages
4. **Source**: Deploy from a branch
5. **Branch**: `main` (or your default branch)
6. **Folder**: `/web` (or select root if web is root)
7. **Save** and wait for deployment
8. **Your site**: `https://yourusername.github.io/repository-name/`

**Note**: If your `web` folder is not at root, you may need to:
- Move `web/` contents to root, OR
- Use a GitHub Actions workflow to deploy from subdirectory

---

## Option 4: Render.com Static Site

1. **Go to**: https://dashboard.render.com
2. **Click**: "New +" → "Static Site"
3. **Connect** your GitHub repository
4. **Configure**:
   - **Name**: `mee-dashboard` (or any name)
   - **Branch**: `main`
   - **Root Directory**: `web`
   - **Build Command**: (leave empty)
   - **Publish Directory**: `web`
5. **Create Static Site**

**Advantages**:
- ✅ Same platform as your backend
- ✅ Easy to manage both services together

---

## Option 5: Cloudflare Pages

1. **Go to**: https://pages.cloudflare.com
2. **Sign up/Login**
3. **Click**: "Create a project"
4. **Connect** your GitHub repository
5. **Configure**:
   - **Project name**: `mee-dashboard`
   - **Production branch**: `main`
   - **Build command**: (leave empty)
   - **Build output directory**: `web`
6. **Save and Deploy**

**Advantages**:
- ✅ Free SSL
- ✅ Fast global CDN
- ✅ Custom domain support

---

## Option 6: Traditional Web Server (Nginx/Apache)

### For Linux Server:

```bash
# Copy web files to server
scp -r web/* user@your-server.com:/var/www/mee/

# Or use rsync
rsync -avz web/ user@your-server.com:/var/www/mee/
```

### Nginx Configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/mee;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🧪 Testing After Deployment

1. **Open your deployed URL** in a browser
2. **Open browser console** (F12)
3. **Check**: You should see `Using API URL: https://devicetracker-backend.onrender.com/api`
4. **Enter a device UUID** and test tracking

---

## 🔧 Troubleshooting

### Web dashboard can't connect to backend

**Check**:
- Browser console for CORS errors
- Backend is running: `https://devicetracker-backend.onrender.com/health`
- `web/app.js` has correct `PRODUCTION_BACKEND_URL`

**Fix**: Update `PRODUCTION_BACKEND_URL` in `web/app.js` if needed

### 404 errors on refresh

**Fix**: Ensure your hosting platform supports SPA routing:
- Netlify: Create `web/_redirects` file with: `/* /index.html 200`
- Vercel: Create `web/vercel.json` with routing config
- Nginx: Use `try_files $uri $uri/ /index.html;`

### CORS errors

**Fix**: Your backend already allows all origins (`*`), but if you want to restrict:
- Update `server.js` CORS settings to allow your web domain

---

## 📝 Quick Deploy Commands

### Netlify (CLI)
```bash
npm install -g netlify-cli
cd web
netlify deploy --prod
```

### Vercel (CLI)
```bash
npm install -g vercel
cd web
vercel --prod
```

---

## 🎯 Recommended: Netlify Drag & Drop

**Fastest way to deploy**:
1. Go to https://app.netlify.com/drop
2. Drag `web/` folder
3. Done! 🎉

Your dashboard will be live in under a minute!

