# Authentication System Implementation Guide

## Overview

This document provides a complete guide for implementing the authentication system in your React Native Android app and web dashboard.

---

## Backend API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. Register User
```
POST /api/auth/register
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "username": "myusername",
  "password": "mypassword123",
  "deviceId": "uuid-generated-once"
}

Success Response (201):
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "username": "myusername",
      "deviceId": "uuid-generated-once"
    }
  }
}

Error Responses:
- 400: Missing fields or validation failed
- 409: Email/username/deviceId already exists
- 500: Server error
```

#### 2. Login
```
POST /api/auth/login
Content-Type: application/json

Request Body:
{
  "username": "myusername",
  "password": "mypassword123"
}

Success Response (200):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "username": "myusername",
      "deviceId": "device-id-from-db"
    }
  }
}

Error Responses:
- 400: Missing username or password
- 401: Invalid username or password
- 500: Server error
```

#### 3. Check Username Availability
```
GET /api/auth/check-username?username=myusername

Success Response (200):
{
  "success": true,
  "available": true  // or false
}
```

#### 4. Check Email Existence
```
GET /api/auth/check-email?email=user@example.com

Success Response (200):
{
  "success": true,
  "exists": true  // or false
}
```

### Protected Endpoints (Require JWT Token)

All protected endpoints require Authorization header:
```
Authorization: Bearer <jwt-token>
```

#### 5. Get Current User Info
```
GET /api/auth/me
Authorization: Bearer <token>

Success Response (200):
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "myusername",
    "deviceId": "device-id"
  }
}
```

#### 6. Submit Location
```
POST /api/location
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10.5
}

Note: deviceId is automatically derived from authenticated user
```

#### 7. Get Latest Location
```
GET /api/location/latest
Authorization: Bearer <token>
```

#### 8. Get Location History
```
GET /api/location/history?page=1&limit=50
Authorization: Bearer <token>
```

#### 9. Get Device Status
```
GET /api/device/status
Authorization: Bearer <token>
```

---

## Android App Implementation (React Native)

### Step 1: Install Dependencies

```bash
npm install @react-native-async-storage/async-storage
# Already installed in your project
```

### Step 2: Create Auth Storage Keys

```typescript
// constants/storage.ts
export const STORAGE_KEYS = {
  DEVICE_ID: 'device_id',
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
};
```

### Step 3: Create Auth Service

```typescript
// services/authService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../constants/storage';

const API_BASE_URL = 'http://your-server-ip:4000/api'; // Change to your server URL

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  deviceId: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      username: string;
      deviceId: string;
    };
  };
}

export const authService = {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Registration failed');
    }

    // Store token and user data
    if (result.success && result.data.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, result.data.token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.data.user));
    }

    return result;
  },

  /**
   * Login with username and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Login failed');
    }

    // Store token and user data
    if (result.success && result.data.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, result.data.token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.data.user));
    }

    return result;
  },

  /**
   * Check if username is available
   */
  async checkUsername(username: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(username)}`);
    const result = await response.json();
    return result.success && result.available === true;
  },

  /**
   * Check if email exists
   */
  async checkEmail(email: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/auth/check-email?email=${encodeURIComponent(email)}`);
    const result = await response.json();
    return result.success && result.exists === true;
  },

  /**
   * Get stored auth token
   */
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  /**
   * Get stored user data
   */
  async getUser(): Promise<any | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Logout - clear stored data
   */
  async logout(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  },
};
```

### Step 4: Create Device ID Service

```typescript
// services/deviceService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {v4 as uuidv4} from 'uuid';
import {STORAGE_KEYS} from '../constants/storage';

export const deviceService = {
  /**
   * Get or create device ID (generated once on first install)
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (existing) {
        return existing;
      }
      
      // Generate new device ID
      const deviceId = uuidv4();
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      return deviceId;
    } catch (err) {
      console.error('Error getting device ID:', err);
      // Fallback: generate temporary ID
      return uuidv4();
    }
  },
};
```

### Step 5: Create Auth Screen Component

```typescript
// screens/AuthScreen.tsx
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {authService} from '../services/authService';
import {deviceService} from '../services/deviceService';

type AuthMode = 'login' | 'register';

export default function AuthScreen({onAuthSuccess}: {onAuthSuccess: () => void}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Validation
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);

  // Check username availability (debounced)
  useEffect(() => {
    if (mode === 'register' && username.length >= 3) {
      const timeoutId = setTimeout(async () => {
        setCheckingUsername(true);
        try {
          const available = await authService.checkUsername(username);
          setUsernameAvailable(available);
        } catch (err) {
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      }, 500); // Wait 500ms after user stops typing

      return () => clearTimeout(timeoutId);
    } else {
      setUsernameAvailable(null);
    }
  }, [username, mode]);

  const handleRegister = async () => {
    // Validate fields
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (usernameAvailable === false) {
      Alert.alert('Error', 'Username is already taken');
      return;
    }

    setLoading(true);
    try {
      // Get or create device ID
      const deviceId = await deviceService.getOrCreateDeviceId();

      // Register user
      await authService.register({
        email,
        username,
        password,
        deviceId,
      });

      Alert.alert('Success', 'Registration successful!', [
        {text: 'OK', onPress: onAuthSuccess},
      ]);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }

    setLoading(true);
    try {
      await authService.login({username, password});
      onAuthSuccess();
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.form}>
        <Text style={styles.title}>
          {mode === 'login' ? 'Login' : 'Register'}
        </Text>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        <View>
          <TextInput
            style={[
              styles.input,
              usernameAvailable === false && styles.inputError,
            ]}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {mode === 'register' && checkingUsername && (
            <Text style={styles.hint}>Checking...</Text>
          )}
          {mode === 'register' && usernameAvailable === true && (
            <Text style={styles.successHint}>✓ Username available</Text>
          )}
          {mode === 'register' && usernameAvailable === false && (
            <Text style={styles.errorHint}>✗ Username taken</Text>
          )}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Login' : 'Register'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setEmail('');
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setUsernameAvailable(null);
          }}>
          <Text style={styles.switchText}>
            {mode === 'login'
              ? "Don't have an account? Register"
              : 'Already have an account? Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: -5,
    marginBottom: 10,
  },
  successHint: {
    fontSize: 12,
    color: '#10b981',
    marginTop: -5,
    marginBottom: 10,
  },
  errorHint: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: -5,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  switchText: {
    color: '#3b82f6',
    fontSize: 14,
  },
});
```

### Step 6: Update Main App Component

```typescript
// App.tsx (simplified structure)
import React, {useState, useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import AuthScreen from './screens/AuthScreen';
import MainTrackingScreen from './screens/MainTrackingScreen'; // Your existing tracking UI
import {authService} from './services/authService';
import {PermissionsAndroid, Platform} from 'react-native';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (err) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    // After successful auth, request permissions
    requestPermissions();
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      // Request foreground location permission
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location for tracking.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        // Request background location (Android 10+)
        if (Platform.Version >= 29) {
          await PermissionsAndroid.request(
            'android.permission.ACCESS_BACKGROUND_LOCATION',
            {
              title: 'Background Location Permission',
              message: 'This app needs background location access for continuous tracking.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
        }

        // Request foreground service permission (Android 14+)
        if (Platform.Version >= 34) {
          await PermissionsAndroid.request(
            'android.permission.FOREGROUND_SERVICE',
            {
              title: 'Foreground Service Permission',
              message: 'This app needs to run a foreground service for location tracking.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
        }
      }
    } catch (err) {
      console.error('Permission request error:', err);
    }
  };

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Show main tracking screen after authentication
  return <MainTrackingScreen />;
}
```

### Step 7: Update Location Tracking to Use JWT

```typescript
// services/locationService.ts
import {authService} from './authService';

const API_BASE_URL = 'http://your-server-ip:4000/api';

export const locationService = {
  /**
   * Send location update to server (requires authentication)
   */
  async sendLocation(latitude: number, longitude: number, accuracy?: number): Promise<boolean> {
    try {
      const token = await authService.getToken();
      
      if (!token) {
        console.error('No auth token available');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
        }),
      });

      return response.ok;
    } catch (err) {
      console.error('Error sending location:', err);
      return false;
    }
  },
};
```

---

## Critical Flow Control Rules

### ✅ DO:
1. **First screen is ALWAYS auth screen** - No tracking UI until authenticated
2. **Request permissions AFTER successful auth** - Never before
3. **Store JWT token** - Use it for all protected API calls
4. **Generate deviceId once** - Store in AsyncStorage, send only during registration
5. **Handle errors gracefully** - Show clear error messages

### ❌ DON'T:
1. **Don't request permissions on app launch** - Only after auth
2. **Don't start tracking before auth** - Wait for successful login/register
3. **Don't send deviceId in login** - Backend finds it from user record
4. **Don't expose deviceId in UI** - User never needs to see it
5. **Don't skip validation** - Always validate on both client and server

---

## Environment Variables

Create a `.env` file in your server root:

```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/devicetracker
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**IMPORTANT**: Change `JWT_SECRET` to a strong random string in production!

---

## Testing the System

### 1. Test Registration
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "deviceId": "test-device-id-123"
  }'
```

### 2. Test Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### 3. Test Protected Endpoint
```bash
curl -X GET http://localhost:4000/api/location/latest \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Troubleshooting

### "Registration failed" errors:
- Check all required fields are provided
- Verify email format is valid
- Ensure username is unique (3-30 chars, alphanumeric + underscore)
- Check deviceId is not already registered

### "Login failed" errors:
- Verify username exists
- Check password is correct
- Ensure backend is running
- Check network connectivity

### "Token expired" errors (legacy tokens only):
- New tokens do not expire (valid indefinitely)
- Old tokens with expiration may still exist
- If you see this error, user needs to login again to get a new non-expiring token

### Permission issues:
- Ensure permissions are requested AFTER authentication
- Check Android version for background location requirements
- Verify permissions in AndroidManifest.xml

---

## Next Steps

1. Install backend dependencies: `npm install`
2. Set up `.env` file with JWT_SECRET
3. Start backend server: `npm run server`
4. Implement AuthScreen in React Native app
5. Update App.tsx to show auth screen first
6. Test registration and login flows
7. Update location tracking to use JWT tokens

