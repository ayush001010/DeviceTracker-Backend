# Quick Deployment Guide - Mee

This guide provides step-by-step instructions to deploy the server, web dashboard, and mobile app.

## 🚀 Quick Start (Docker - Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- [Git](https://git-scm.com/downloads) installed

### Steps

1. **Create `.env` file** (if it doesn't exist):
   ```cmd
   echo JWT_SECRET=your-secret-key-here > .env
   ```
   
   **Important:** Replace `your-secret-key-here` with a secure random string. Generate one:
   ```cmd
   powershell -Command "[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))"
   ```

2. **Start all services**:
   ```cmd
   docker-compose up -d
   ```

3. **Verify services are running**:
   ```cmd
   docker-compose ps
   ```

4. **Access your services**:
   - **Backend API**: http://localhost:4000
   - **Web Dashboard**: http://localhost
   - **MongoDB**: localhost:27017

5. **View logs** (if needed):
   ```cmd
   docker-compose logs -f
   ```

6. **Stop services**:
   ```cmd
   docker-compose down
   ```

---

## 📦 Manual Deployment

### Backend Server

1. **Install dependencies**:
   ```cmd
   npm install --production
   ```

2. **Set environment variables** (PowerShell):
   ```powershell
   $env:PORT=4000
   $env:MONGO_URI="mongodb://localhost:27017/mee"
   $env:JWT_SECRET="your-secret-key-here"
   $env:NODE_ENV="production"
   ```

3. **Start MongoDB** (if not using Docker):
   - Windows: Start MongoDB service from Services panel
   - Or install MongoDB and run: `mongod`

4. **Start the server**:
   ```cmd
   npm run server
   ```

   **For production**, use PM2:
   ```cmd
   npm install -g pm2
   pm2 start server.js --name mee-backend
   pm2 save
   pm2 startup
   ```

### Web Dashboard

#### Option 1: Using Docker (Already included in docker-compose)
The web dashboard is automatically deployed when you run `docker-compose up`.

#### Option 2: Static Hosting (Netlify, Vercel, etc.)

1. **Update API URL** in `web/app.js` (line 35):
   ```javascript
   // Change to your production backend URL
   return `${protocol}//your-backend-domain.com:4000/api`;
   ```

2. **Deploy to Netlify**:
   - Go to [Netlify](https://www.netlify.com/)
   - Drag and drop the `web/` folder
   - Done!

3. **Deploy to Vercel**:
   ```cmd
   npm install -g vercel
   cd web
   vercel deploy
   ```

#### Option 3: Nginx/Apache Server

1. **Copy web files** to your web server directory:
   ```cmd
   xcopy /E /I web C:\inetpub\wwwroot\mee
   ```

2. **Update API URL** in `web/app.js` to point to your backend

3. **Configure IIS** or your web server to serve the files

---

## 📱 Mobile App Deployment

### Android App

#### Build Debug APK (for testing):
```cmd
cd android
gradlew.bat assembleDebug
```
APK location: `android\app\build\outputs\apk\debug\app-debug.apk`

#### Build Release APK (for production):

1. **Update `config.ts`** with production server URL:
   ```typescript
   export const SERVER_HOST = 'your-production-server.com';
   export const SERVER_PORT = '4000';
   export const SERVER_URL = `https://${SERVER_HOST}:${SERVER_PORT}`;
   ```

2. **Generate signing key** (first time only):
   ```cmd
   cd android\app
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

3. **Configure signing** in `android/app/build.gradle`:
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

4. **Build release APK**:
   ```cmd
   cd android
   gradlew.bat assembleRelease
   ```
   APK location: `android\app\build\outputs\apk\release\app-release.apk`

5. **Build AAB** (for Google Play Store):
   ```cmd
   gradlew.bat bundleRelease
   ```
   AAB location: `android\app\build\outputs\bundle\release\app-release.aab`

### iOS App

1. **Update `config.ts`** with production server URL (same as Android)

2. **Install CocoaPods dependencies**:
   ```cmd
   cd ios
   bundle install
   bundle exec pod install
   ```

3. **Open in Xcode**:
   ```cmd
   start ios\Mee.xcworkspace
   ```

4. **Configure signing**:
   - Select your development team
   - Choose bundle identifier
   - Enable automatic signing

5. **Build and run**:
   - Select device/simulator
   - Press Cmd+R (or Product → Run)

6. **Archive for App Store**:
   - Product → Archive
   - Distribute App → App Store Connect

---

## 🌐 Production Deployment Checklist

### Backend
- [ ] Set strong `JWT_SECRET` (use random generator)
- [ ] Use production MongoDB (MongoDB Atlas recommended)
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS (restrict to your domains)
- [ ] Set up firewall rules
- [ ] Configure monitoring/logging
- [ ] Set up MongoDB backups

### Web Dashboard
- [ ] Update API URL to production backend
- [ ] Enable HTTPS
- [ ] Test on multiple browsers
- [ ] Verify CORS settings

### Mobile Apps
- [ ] Update `config.ts` with production server URL
- [ ] Use HTTPS for API calls
- [ ] Test on real devices
- [ ] Configure app icons
- [ ] Set up app signing (Android) / certificates (iOS)
- [ ] Test location permissions
- [ ] Test background location tracking

---

## 🔧 Troubleshooting

### Backend won't start
- Check MongoDB is running: `mongosh` or check Services panel
- Verify environment variables are set
- Check port 4000 is not in use: `netstat -ano | findstr :4000`

### Web dashboard can't connect to backend
- Verify backend is running and accessible
- Check CORS settings in `server.js`
- Update API URL in `web/app.js`
- Check browser console for errors

### Mobile app can't connect
- Verify `config.ts` has correct server URL
- Check server is accessible from device network
- For local testing, ensure device and server are on same network
- For production, use HTTPS and verify certificate

---

## 📚 Additional Resources

- Full deployment guide: See `DEPLOYMENT.md`
- Server configuration: See `server.js`
- Web dashboard config: See `web/app.js`
- Mobile app config: See `config.ts`

---

## 🆘 Need Help?

Check the main `README.md` or `DEPLOYMENT.md` for more detailed information.

