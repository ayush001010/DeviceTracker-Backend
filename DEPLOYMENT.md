# DeviceTracker Deployment Guide

This guide covers deploying the DeviceTracker application (Backend, Web Dashboard, and Mobile Apps).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment](#backend-deployment)
3. [Web Dashboard Deployment](#web-dashboard-deployment)
4. [Mobile App Deployment](#mobile-app-deployment)
5. [Production Checklist](#production-checklist)

---

## Prerequisites

- Node.js 20+ installed
- MongoDB installed (or use Docker)
- For mobile apps: Android Studio / Xcode
- For Docker deployment: Docker and Docker Compose

---

## Backend Deployment

### Option 1: Docker Deployment (Recommended)

1. **Set up environment variables:**
   ```bash
   # Create .env file
   cp .env.example .env
   # Edit .env and set JWT_SECRET (generate with: openssl rand -base64 32)
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Check status:**
   ```bash
   docker-compose ps
   docker-compose logs -f backend
   ```

4. **Stop services:**
   ```bash
   docker-compose down
   ```

### Option 2: Manual Deployment

1. **Install dependencies:**
   ```bash
   npm install --production
   ```

2. **Set environment variables:**
   ```bash
   export PORT=4000
   export MONGO_URI=mongodb://localhost:27017/devicetracker
   export JWT_SECRET=your-secret-key-here
   export NODE_ENV=production
   ```

3. **Start MongoDB:**
   ```bash
   # On Linux/Mac
   sudo systemctl start mongod
   
   # On Windows
   # Start MongoDB service from Services panel
   ```

4. **Start the server:**
   ```bash
   npm run server
   # Or use PM2 for production:
   npm install -g pm2
   pm2 start server.js --name devicetracker-backend
   pm2 save
   pm2 startup
   ```

### Option 3: Cloud Deployment (Heroku, Railway, Render, etc.)

1. **Set environment variables in your platform:**
   - `PORT` (usually auto-set by platform)
   - `MONGO_URI` (use MongoDB Atlas or platform's MongoDB)
   - `JWT_SECRET` (generate a secure random string)
   - `NODE_ENV=production`

2. **Deploy:**
   ```bash
   # Example for Heroku
   heroku create devicetracker-backend
   heroku config:set JWT_SECRET=your-secret-key
   heroku config:set MONGO_URI=your-mongodb-uri
   git push heroku main
   ```

---

## Web Dashboard Deployment

### Option 1: Docker (with docker-compose)

The web dashboard is automatically deployed when using `docker-compose up`. It will be available at `http://localhost`.

### Option 2: Static Hosting (Netlify, Vercel, GitHub Pages, etc.)

1. **Update API URL in `web/app.js`:**
   ```javascript
   // Change line 15 to your production backend URL
   return 'https://your-backend-domain.com/api';
   ```

2. **Deploy:**
   - **Netlify:** Drag and drop the `web/` folder
   - **Vercel:** `vercel deploy web`
   - **GitHub Pages:** Push `web/` folder to `gh-pages` branch

### Option 3: Nginx/Apache Server

1. **Copy web files:**
   ```bash
   sudo cp -r web/* /var/www/devicetracker/
   ```

2. **Configure Nginx:**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /var/www/devicetracker;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **Update API URL in `web/app.js`** to point to your backend server.

---

## Mobile App Deployment

### Android App

#### Build APK (Debug)

```bash
cd android
./gradlew assembleDebug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

#### Build APK (Release)

1. **Update `config.ts` with production server URL:**
   ```typescript
   export const SERVER_HOST = 'your-production-server.com';
   export const SERVER_PORT = '4000'; // or 443 for HTTPS
   export const SERVER_URL = `https://${SERVER_HOST}:${SERVER_PORT}`;
   ```

2. **Generate signing key (first time only):**
   ```bash
   cd android/app
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

3. **Configure signing in `android/app/build.gradle`:**
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file('my-release-key.keystore')
               storePassword 'your-password'
               keyAlias 'my-key-alias'
               keyPassword 'your-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

4. **Build release APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   # APK will be at: android/app/build/outputs/apk/release/app-release.apk
   ```

5. **Build AAB (for Google Play Store):**
   ```bash
   ./gradlew bundleRelease
   # AAB will be at: android/app/build/outputs/bundle/release/app-release.aab
   ```

#### Upload to Google Play Store

1. Create a Google Play Console account
2. Create a new app
3. Upload the AAB file
4. Fill in store listing, screenshots, etc.
5. Submit for review

### iOS App

#### Build for Testing

1. **Update `config.ts` with production server URL** (same as Android)

2. **Install CocoaPods dependencies:**
   ```bash
   cd ios
   bundle install
   bundle exec pod install
   ```

3. **Open in Xcode:**
   ```bash
   open ios/DeviceTracker.xcworkspace
   ```

4. **Configure signing:**
   - Select your development team in Xcode
   - Choose a bundle identifier
   - Enable automatic signing

5. **Build and run:**
   - Select a device/simulator
   - Press Cmd+R to build and run

#### Build for App Store

1. **Archive the app:**
   - In Xcode: Product → Archive
   - Wait for archive to complete

2. **Distribute:**
   - Click "Distribute App"
   - Choose "App Store Connect"
   - Follow the wizard

3. **Upload to App Store Connect:**
   - App will appear in App Store Connect
   - Fill in app information, screenshots, etc.
   - Submit for review

---

## Production Checklist

### Backend

- [ ] Set strong `JWT_SECRET` (use `openssl rand -base64 32`)
- [ ] Use production MongoDB (MongoDB Atlas or managed service)
- [ ] Enable HTTPS/SSL
- [ ] Set up proper CORS (restrict to your domains)
- [ ] Configure firewall rules
- [ ] Set up monitoring/logging
- [ ] Configure backups for MongoDB
- [ ] Use environment variables (never hardcode secrets)

### Web Dashboard

- [ ] Update API URL to production backend
- [ ] Enable HTTPS
- [ ] Test on multiple browsers
- [ ] Verify CORS settings allow your domain
- [ ] Set up custom domain (optional)
- [ ] Configure CDN for static assets (optional)

### Mobile Apps

- [ ] Update `config.ts` with production server URL
- [ ] Use HTTPS for API calls
- [ ] Test on real devices
- [ ] Configure app icons and splash screens
- [ ] Set up app signing (Android) / certificates (iOS)
- [ ] Test location permissions on devices
- [ ] Test background location tracking
- [ ] Submit to app stores

### Security

- [ ] Change default JWT_SECRET
- [ ] Use strong passwords for MongoDB
- [ ] Enable rate limiting (consider adding express-rate-limit)
- [ ] Validate all inputs
- [ ] Use HTTPS everywhere
- [ ] Keep dependencies updated
- [ ] Review and restrict CORS origins

---

## Troubleshooting

### Backend won't start

- Check MongoDB is running: `mongosh` or `mongo`
- Verify environment variables are set
- Check port 4000 is not in use: `lsof -i :4000` (Mac/Linux) or `netstat -ano | findstr :4000` (Windows)

### Web dashboard can't connect to backend

- Verify backend is running and accessible
- Check CORS settings in `server.js`
- Update API URL in `web/app.js`
- Check browser console for errors

### Mobile app can't connect

- Verify `config.ts` has correct server URL
- Check server is accessible from device network
- For local testing, ensure device and server are on same network
- For production, use HTTPS and verify certificate is valid

---

## Quick Start (Docker)

```bash
# 1. Set JWT_SECRET in .env file
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 2. Start all services
docker-compose up -d

# 3. Check logs
docker-compose logs -f

# 4. Access services
# Backend: http://localhost:4000
# Web Dashboard: http://localhost
# MongoDB: localhost:27017
```

---

## Support

For issues or questions, check the main README.md or open an issue in the repository.


