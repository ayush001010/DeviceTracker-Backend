# Mee Web Dashboard

A responsive web dashboard to visualize device location tracking on a map.

## Features

- 📍 Real-time location tracking
- 🗺️ Interactive map with OpenStreetMap
- 📊 Movement path visualization
- 📱 Fully responsive (mobile, tablet, desktop)
- 🔄 Auto-refresh every 10 seconds
- 🟢 Online/Offline status indicator

## Setup

1. **Open the dashboard:**
   ```
   Open web/index.html in a web browser
   ```

2. **Add device ID:**
   - Option 1: Add `?deviceId=YOUR_DEVICE_ID` to the URL
   - Option 2: Enter device ID when prompted

   Example:
   ```
   file:///path/to/web/index.html?deviceId=7921da69-7e78-4153-8442-67675e757b11
   ```

3. **Configure backend URL:**
   - Edit `web/app.js`
   - Change `API_BASE_URL` to match your backend:
     ```javascript
     const API_BASE_URL = 'http://YOUR_SERVER_IP:4000/api';
     ```

## How It Works

### Map Updates

1. **Initial Load:**
   - Fetches latest location from `/api/location/latest/:deviceId`
   - Fetches last 100 location points from `/api/location/history/:deviceId`
   - Draws path polyline on map
   - Centers map on latest location

2. **Polling:**
   - Every 10 seconds, fetches latest location
   - Updates marker position if location changed
   - Adds new point to path if different from last point
   - Updates status (Online/Offline) based on last update time

3. **Status Detection:**
   - **Online:** Last update within 60 seconds
   - **Offline:** Last update older than 60 seconds

### Responsive Design

- **Mobile (< 480px):** Stacked info panel, smaller header
- **Tablet (480px - 768px):** Flexible info layout
- **Desktop (> 768px):** Full-width layout with side-by-side info

## Files

- `index.html` - Main HTML structure
- `style.css` - Responsive styling
- `app.js` - Map logic and API integration

## Requirements

- Modern web browser with JavaScript enabled
- Backend server running and accessible
- Device must have location data in database

## Troubleshooting

**Map not loading:**
- Check internet connection (needs to load OpenStreetMap tiles)
- Check browser console for errors

**No location data:**
- Verify deviceId is correct
- Check backend is running
- Verify device has sent location data

**CORS errors:**
- Backend needs to allow CORS from your domain
- Or use a local web server instead of opening HTML file directly

