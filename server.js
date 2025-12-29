import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';

import connectDB from './config/db.js';
import locationRoutes from './routes/locationRoutes.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mee';

// CORS middleware - allow web dashboard to access API
app.use((req, res, next) => {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  next();
});

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({status: 'ok'});
});

// Auth routes (public - no authentication required)
app.use('/api/auth', authRoutes);

// Location routes (protected - require authentication)
app.use('/api', locationRoutes);

app.use((req, res) => {
  res.status(404).json({success: false, message: 'Route not found'});
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({success: false, message: 'Internal server error'});
});

async function start() {
  await connectDB(MONGO_URI);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Get network IP dynamically (optional - can be configured via env)
    const networkIP = process.env.NETWORK_IP || '0.0.0.0';
    if (networkIP !== '0.0.0.0') {
      console.log(`Server accessible on network at http://${networkIP}:${PORT}`);
    }
  });
}

start();

