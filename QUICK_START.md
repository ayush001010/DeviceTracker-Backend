# Quick Start - Mee Deployment

## 🚀 Fastest Way to Deploy (Docker)

### 1. Set up environment

```bash
# Create .env file (copy from example if available, or create manually)
# Set JWT_SECRET (generate with: openssl rand -base64 32)
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
echo "PORT=4000" >> .env
echo "MONGO_URI=mongodb://mongodb:27017/mee" >> .env
echo "NODE_ENV=production" >> .env
```

### 2. Deploy everything

```bash
# Start all services (backend, web, MongoDB)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Access your services

- **Backend API**: http://localhost:4000
- **Web Dashboard**: http://localhost
- **MongoDB**: localhost:27017

---

## 📱 Build Mobile Apps

### Android

```bash
# Debug APK
./scripts/build-android.sh debug
# or on Windows: scripts\build-android.bat debug

# Release APK (for production)
./scripts/build-android.sh release
```

### iOS

```bash
# Prepare dependencies
./scripts/build-ios.sh

# Then open in Xcode
open ios/Mee.xcworkspace
```

**Important**: Update `config.ts` with your production server URL before building!

---

## 🔧 Manual Deployment

### Backend Only

```bash
# Install dependencies
npm install --production

# Set environment variables
export PORT=4000
export MONGO_URI=mongodb://localhost:27017/mee
export JWT_SECRET=your-secret-key-here
export NODE_ENV=production

# Start server
npm run server
```

### Web Dashboard

1. Update `web/app.js` - change the default API URL (line ~30) to your backend URL
2. Deploy `web/` folder to any static hosting:
   - Netlify (drag & drop)
   - Vercel (`vercel deploy web`)
   - GitHub Pages
   - Your own web server

---

## 📋 Before Production

- [ ] Change `JWT_SECRET` to a secure random string
- [ ] Use production MongoDB (MongoDB Atlas recommended)
- [ ] Enable HTTPS for backend and web
- [ ] Update `config.ts` in mobile app with production server URL
- [ ] Test on real devices
- [ ] Configure proper CORS in `server.js`

---

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

---

## 🆘 Troubleshooting

**Backend won't start?**
- Check MongoDB is running
- Verify environment variables
- Check port 4000 is available

**Web can't connect?**
- Update API URL in `web/app.js`
- Check CORS settings in `server.js`
- Verify backend is running

**Mobile app can't connect?**
- Update `config.ts` with correct server URL
- Ensure server is accessible from device network
- Check firewall settings


