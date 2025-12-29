// Configuration - change these to match your backend
// Auto-detect backend URL based on where the page is hosted
const getBackendURL = () => {
  // Priority 1: URL parameter override (for testing/debugging)
  const urlParams = new URLSearchParams(window.location.search);
  const customApiUrl = urlParams.get('apiUrl');
  if (customApiUrl) {
    return customApiUrl.endsWith('/api') ? customApiUrl : `${customApiUrl}/api`;
  }
  
  // Priority 2: Check if running on same machine (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:4000/api';
  }
  
  // Priority 3: Production - use same hostname with port 4000
  // For production, if web and backend are on same domain, use same hostname
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = window.location.hostname;
  
  // If web is on port 80/443, backend might be on same hostname with different port
  // Or if using subdomain, backend might be at api.yourdomain.com
  // Default: assume backend is on same hostname, port 4000
  // For production, you may want to change this to your actual backend URL
  if (hostname.includes('localhost') || hostname.match(/^192\.168\.|^10\.|^172\./)) {
    // Local network IP
    return `http://${hostname}:4000/api`;
  }
  
  // Production: Update this to your actual backend URL
  // Examples:
  // - Same domain, different port: `${protocol}//${hostname}:4000/api`
  // - Subdomain: `${protocol}//api.${hostname}/api`
  // - Different domain: `${protocol}//your-backend-domain.com/api`
  return `${protocol}//${hostname}:4000/api`;
};

const API_BASE_URL = getBackendURL();
console.log('Using API URL:', API_BASE_URL);
const POLL_INTERVAL = 10000; // 10 seconds
const STATUS_POLL_INTERVAL = 12000; // 12 seconds for status polling
const OFFLINE_THRESHOLD = 60000; // 60 seconds - device considered offline if no update

// Storage key
const STORAGE_DEVICE_ID = 'device_uuid';

// Global state
let deviceId = null;

// UUID helper functions
function getStoredDeviceId() {
  return localStorage.getItem(STORAGE_DEVICE_ID);
}

function storeDeviceId(uuid) {
  localStorage.setItem(STORAGE_DEVICE_ID, uuid);
  deviceId = uuid;
}

function clearDeviceId() {
  localStorage.removeItem(STORAGE_DEVICE_ID);
  deviceId = null;
}

// Check UUID on page load
function checkUUID() {
  const storedUUID = getStoredDeviceId();
  
  if (storedUUID) {
    deviceId = storedUUID;
    startTracking();
  } else {
    showUUIDInput();
  }
}

// Show UUID input form
function showUUIDInput() {
  document.getElementById('uuidContainer').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'none';
  
  // Pre-fill UUID input if stored
  const uuidInput = document.getElementById('uuidInput');
  const storedUUID = getStoredDeviceId();
  if (storedUUID) {
    uuidInput.value = storedUUID;
  } else {
    uuidInput.value = '';
  }
  
  // Handle track button (remove old listener first to avoid duplicates)
  const trackButton = document.getElementById('trackButton');
  const newTrackButton = trackButton.cloneNode(true);
  trackButton.parentNode.replaceChild(newTrackButton, trackButton);
  newTrackButton.addEventListener('click', handleUUIDSubmit);
  
  // Handle Enter key
  uuidInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleUUIDSubmit();
    }
  });
}

// Handle UUID submit
function handleUUIDSubmit() {
  const uuid = document.getElementById('uuidInput').value.trim();
  const errorDiv = document.getElementById('uuidError');
  
  // Clear previous errors
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';
  
  if (!uuid) {
    errorDiv.textContent = 'Device UUID is required';
    errorDiv.style.display = 'block';
    return;
  }
  
  // Store UUID and start tracking
  storeDeviceId(uuid);
  startTracking();
}

// Start tracking
function startTracking() {
  // Hide UUID input, show main content
  document.getElementById('uuidContainer').style.display = 'none';
  document.getElementById('mainContent').style.display = 'flex';
  
  // Update device ID display
  document.getElementById('deviceId').textContent = deviceId || '-';
  
  // Initialize map and start tracking
  init();
}

// Initialize on page load
checkUUID();

// Initialize map
let map;
let marker;
let polyline;
let pathCoordinates = [];
let baseLayers = {};
let currentLayer = null;

// Create custom marker icon with status-based color
function createCustomIcon(status = 'OK') {
  const isSuspicious = status === 'SUSPICIOUS';
  const bgColor = isSuspicious 
    ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
  const shadowColor = isSuspicious 
    ? 'rgba(239, 68, 68, 0.4)'
    : 'rgba(16, 185, 129, 0.4)';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${bgColor};
        border: 3px solid #FFFFFF;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px ${shadowColor};
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
          width: 8px;
          height: 8px;
          background: #FFFFFF;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// Initialize Leaflet map with multiple layers
function initMap(lat = 0, lng = 0) {
  if (map) {
    map.remove();
  }

  // Ensure map container has height before initializing
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.style.height = '100%';
    mapElement.style.minHeight = '400px';
  }

  map = L.map('map', {
    zoomControl: true,
    fullscreenControl: true,
    attributionControl: false, // Disable attribution control (black footer)
    preferCanvas: false,
  }).setView([lat, lng], 13);
  
  // Ensure map container has no bottom spacing
  const mapContainer = map.getContainer();
  if (mapContainer) {
    mapContainer.style.marginBottom = '0';
    mapContainer.style.paddingBottom = '0';
  }
  
  // Remove attribution control if it was created
  if (map.attributionControl) {
    map.removeControl(map.attributionControl);
  }
  
  // Force map to invalidate size after a short delay to ensure proper rendering
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      removeAttributionFooter();
    }
  }, 100);
  
  // Also remove after a longer delay to catch any late-rendering attribution
  setTimeout(() => {
    removeAttributionFooter();
  }, 500);

  // Add multiple base layers
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  });

  const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  });

  const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  });

  // Add layer control
  baseLayers = {
    'OpenStreetMap': osmLayer,
    'Dark Mode': cartoDark,
    'Light Mode': cartoLight,
  };

  // Add default layer
  currentLayer = osmLayer;
  currentLayer.addTo(map);

  // Add layer control to map
  L.control.layers(baseLayers).addTo(map);

  // Add marker for current location with custom icon (default to OK status)
  marker = L.marker([lat, lng], {
    icon: createCustomIcon('OK'),
    draggable: false,
  }).addTo(map);

  // Add pulsing circle around marker
  const pulseCircle = L.circle([lat, lng], {
    radius: 100,
    fillColor: '#EF4444',
    fillOpacity: 0.2,
    color: '#EF4444',
    weight: 2,
  }).addTo(map);

  // Animate pulse circle
  setInterval(() => {
    const radius = pulseCircle.getRadius();
    if (radius > 200) {
      pulseCircle.setRadius(100);
    } else {
      pulseCircle.setRadius(radius + 10);
    }
    pulseCircle.setStyle({
      fillOpacity: Math.max(0, 0.2 - (radius - 100) / 1000),
    });
  }, 100);

  // Initialize polyline for path with gradient effect
  polyline = L.polyline([], {
    color: '#3B82F6',
    weight: 4,
    opacity: 0.8,
    lineJoin: 'round',
    lineCap: 'round',
  }).addTo(map);

  // Add start marker
  if (pathCoordinates.length > 0) {
    const startPoint = pathCoordinates[pathCoordinates.length - 1];
    L.marker([startPoint.latitude, startPoint.longitude], {
      icon: L.divIcon({
        className: 'start-marker',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #10B981;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map).bindPopup('Start Point');
  }
}

// Format timestamp
function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} min ago`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} hour${Math.floor(diff / 3600000) > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleString();
  }
}

// Update status indicator
function updateStatus(lastUpdateTime) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const now = new Date();
  const lastUpdate = new Date(lastUpdateTime);
  const diff = now - lastUpdate;

  if (diff < OFFLINE_THRESHOLD) {
    statusDot.className = 'status-dot online';
    statusText.className = 'status-text online';
    statusText.textContent = 'Online';
  } else {
    statusDot.className = 'status-dot offline';
    statusText.className = 'status-text offline';
    statusText.textContent = 'Offline';
  }
}

// Update refresh indicator
let lastUpdateTime = null;
let isUpdating = false;

function updateRefreshIndicator() {
  const refreshIndicator = document.getElementById('refreshIndicator');
  const refreshText = document.getElementById('refreshText');
  
  if (lastUpdateTime) {
    refreshIndicator.style.display = 'flex';
    
    // Add/remove updating class for animation
    if (isUpdating) {
      refreshIndicator.classList.add('updating');
    } else {
      refreshIndicator.classList.remove('updating');
    }
    
    const diff = Date.now() - lastUpdateTime;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      refreshText.textContent = `Updated ${seconds}s ago`;
    } else if (seconds < 3600) {
      refreshText.textContent = `Updated ${Math.floor(seconds / 60)}m ago`;
    } else {
      refreshText.textContent = `Updated ${new Date(lastUpdateTime).toLocaleTimeString()}`;
    }
  }
}

// Update info panel with enhanced data
function updateInfoPanel(data) {
  document.getElementById('deviceId').textContent = data.deviceId || '-';
  document.getElementById('lastUpdated').textContent = formatTime(data.createdAt);
  document.getElementById('accuracy').textContent = data.accuracy
    ? `${data.accuracy.toFixed(1)} m`
    : '-';
  document.getElementById('coordinates').textContent = data.latitude && data.longitude
    ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`
    : '-';
  document.getElementById('totalPoints').textContent = pathCoordinates.length;

  if (data.createdAt) {
    updateStatus(data.createdAt);
  }
}

// Update map marker with enhanced popup and status-based color
function updateMarker(lat, lng, accuracy, securityStatus = 'OK') {
  if (!map || !marker) return;

  marker.setLatLng([lat, lng]);
  
  // Update marker icon based on security status
  const newIcon = createCustomIcon(securityStatus);
  marker.setIcon(newIcon);

  // Enhanced popup with more info
  const popupContent = `
    <div style="text-align: center; min-width: 200px;">
      <div style="
        font-size: 16px;
        font-weight: 700;
        color: #FFFFFF;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      ">
        📍 Current Location
      </div>
      <div style="text-align: left; font-size: 13px; line-height: 1.8;">
        <div><strong>Latitude:</strong> ${lat.toFixed(6)}</div>
        <div><strong>Longitude:</strong> ${lng.toFixed(6)}</div>
        ${accuracy ? `<div><strong>Accuracy:</strong> ${accuracy.toFixed(1)} m</div>` : ''}
        <div><strong>Time:</strong> ${formatTime(new Date())}</div>
      </div>
    </div>
  `;

  marker.bindPopup(popupContent, {
    className: 'custom-popup',
    maxWidth: 250,
  });

  // Smoothly center map on marker
  map.setView([lat, lng], map.getZoom(), {
    animate: true,
    duration: 0.5,
    easeLinearity: 0.25,
  });
  
  // Remove attribution footer after view change
  setTimeout(() => {
    removeAttributionFooter();
  }, 100);
}

// Update path polyline with enhanced visualization
function updatePath(points) {
  if (!map || !polyline) return;

  // Convert points to lat/lng array
  const coordinates = points.map(point => [point.latitude, point.longitude]);

  // Update polyline
  polyline.setLatLngs(coordinates);

  // Update total points display
  document.getElementById('totalPoints').textContent = points.length;
}

// Fit bounds to show entire path
function fitBoundsToPath() {
  if (!map || !polyline || pathCoordinates.length === 0) return;
  
  const coordinates = pathCoordinates.map(p => [p.latitude, p.longitude]);
  if (coordinates.length > 0) {
    const bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 16,
      animate: true,
      duration: 1,
    });
  }
}

// Clear path
function clearPath() {
  if (!polyline) return;
  pathCoordinates = [];
  polyline.setLatLngs([]);
  document.getElementById('totalPoints').textContent = '0';
  
  // Remove start marker
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer !== marker) {
      map.removeLayer(layer);
    }
  });
}

// Show toast notification
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.classList.remove('hide');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      toast.classList.remove('hide');
    }, 300);
  }, duration);
}

// Copy device ID to clipboard
function copyDeviceId() {
  if (!deviceId) return;
  
  navigator.clipboard.writeText(deviceId).then(() => {
    // Show toast notification
    showToast('Device ID copied to clipboard!', 3000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy. Please try again.', 3000);
  });
}

// Fetch latest location
async function fetchLatestLocation() {
  if (!deviceId) {
    console.error('No device ID available');
    return;
  }
  
  isUpdating = true;
  updateRefreshIndicator();
  
  try {
    const response = await fetch(`${API_BASE_URL}/location/latest?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle 404 - device not found
      if (response.status === 404) {
        throw new Error('Device not found. Please check your UUID.');
      }
      
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || `HTTP ${response.status}: Failed to fetch location`);
    }

    const result = await response.json();

    const data = result.data;
    updateInfoPanel(data);
    
    // Get current security status for marker color
    const currentStatus = window.currentSecurityStatus || 'OK';
    updateMarker(data.latitude, data.longitude, data.accuracy, currentStatus);

    // Add to path if not already there (check by time, not exact coordinates)
    const exists = pathCoordinates.some(
      p => Math.abs(p.latitude - data.latitude) < 0.0001 && 
           Math.abs(p.longitude - data.longitude) < 0.0001
    );
    
    if (!exists) {
      pathCoordinates.push({
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        createdAt: data.createdAt,
      });
      updatePath(pathCoordinates);
    }

    hideError();
    
    // Update refresh indicator
    isUpdating = false;
    if (data && data.createdAt) {
      lastUpdateTime = new Date(data.createdAt).getTime();
    } else {
      lastUpdateTime = Date.now();
    }
    updateRefreshIndicator();
    
    return data;
  } catch (error) {
    console.error('Error fetching latest location:', error);
    
    // More specific error messages
    let errorMsg = error.message;
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMsg = `Cannot connect to backend at ${API_BASE_URL}. Make sure the server is running and accessible.`;
    }
    
    showError(errorMsg);
    
    // Update refresh indicator even on error
    isUpdating = false;
    updateRefreshIndicator();
    
    return null;
  }
}

// Fetch location history
async function fetchHistory() {
  if (!deviceId) {
    console.error('No device ID available');
    return;
  }
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/location/history?deviceId=${encodeURIComponent(deviceId)}&limit=200&page=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      // Handle 404 - device not found
      if (response.status === 404) {
        throw new Error('Device not found. Please check your UUID.');
      }
      
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || `HTTP ${response.status}: Failed to fetch history`);
    }

    const result = await response.json();

    const points = result.data.points;
    pathCoordinates = points;
    updatePath(pathCoordinates);

    // If we have points, center on the latest
    if (points.length > 0) {
      const latest = points[0];
      const currentStatus = window.currentSecurityStatus || 'OK';
      updateMarker(latest.latitude, latest.longitude, latest.accuracy, currentStatus);
      updateInfoPanel(latest);
      
      // Fit bounds to show entire path
      setTimeout(() => fitBoundsToPath(), 500);
    }

    hideError();
  } catch (error) {
    console.error('Error fetching history:', error);
    // Don't show error for history - latest location is more important
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  errorText.textContent = message;
  errorDiv.style.display = 'block';
}

// Hide error message
function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.style.display = 'none';
}

// Remove attribution footer completely
function removeAttributionFooter() {
  // Remove via Leaflet API
  if (map && map.attributionControl) {
    map.removeControl(map.attributionControl);
  }
  
  // Remove via DOM (more aggressive)
  const attribution = document.querySelectorAll('.leaflet-control-attribution');
  attribution.forEach(el => {
    el.remove();
    el.style.display = 'none';
    el.style.height = '0';
    el.style.margin = '0';
    el.style.padding = '0';
  });
  
  // Remove from bottom containers and set height to 0
  const bottomContainers = document.querySelectorAll('.leaflet-bottom');
  bottomContainers.forEach(container => {
    const attr = container.querySelector('.leaflet-control-attribution');
    if (attr) {
      attr.remove();
    }
    
    // Check if container only has attribution (or is empty)
    const children = Array.from(container.children);
    const hasOnlyAttribution = children.length === 0 || 
      (children.length === 1 && children[0].classList.contains('leaflet-control-attribution'));
    
    if (hasOnlyAttribution || container.querySelectorAll('.leaflet-control-attribution').length > 0) {
      container.style.display = 'none';
      container.style.height = '0';
      container.style.margin = '0';
      container.style.padding = '0';
      container.style.marginBottom = '0';
      container.style.paddingBottom = '0';
      container.style.overflow = 'hidden';
    }
  });
  
  // Also target leaflet-bottom.leaflet-right specifically
  const bottomRight = document.querySelectorAll('.leaflet-bottom.leaflet-right');
  bottomRight.forEach(el => {
    el.style.display = 'none';
    el.style.height = '0';
    el.style.margin = '0';
    el.style.padding = '0';
    el.style.marginBottom = '0';
    el.style.paddingBottom = '0';
    el.style.overflow = 'hidden';
  });
  
  // Force body and html to have no bottom spacing
  document.body.style.marginBottom = '0';
  document.body.style.paddingBottom = '0';
  document.documentElement.style.marginBottom = '0';
  document.documentElement.style.paddingBottom = '0';
}

// Fetch device security status
let currentSecurityStatus = 'OK';
async function fetchDeviceStatus() {
  if (!deviceId) {
    console.error('No device ID available');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/device/status?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Handle 404 - device not found
      if (response.status === 404) {
        throw new Error('Device not found. Please check your UUID.');
      }
      
      throw new Error(`HTTP ${response.status}: Failed to fetch status`);
    }

    const result = await response.json();
    const statusData = result.data;
    
    // Update global status
    currentSecurityStatus = statusData.status;
    window.currentSecurityStatus = statusData.status;
    
    // Update security status UI
    updateSecurityStatus(statusData);
    
    // Update marker color if marker exists
    if (marker && map) {
      const newIcon = createCustomIcon(statusData.status);
      marker.setIcon(newIcon);
    }
    
    return statusData;
  } catch (error) {
    console.error('Error fetching device status:', error);
    // Show "Status unavailable" on error
    updateSecurityStatus({
      status: 'UNAVAILABLE',
      reason: null,
    });
    return null;
  }
}

// Update security status panel UI
function updateSecurityStatus(statusData) {
  const badge = document.getElementById('securityBadge');
  const badgeDot = document.getElementById('securityBadgeDot');
  const badgeText = document.getElementById('securityBadgeText');
  const reasonDiv = document.getElementById('securityReason');
  const reasonText = document.getElementById('securityReasonText');
  
  if (statusData.status === 'SUSPICIOUS') {
    // Red badge for suspicious
    badge.className = 'security-badge suspicious';
    badgeDot.className = 'security-badge-dot suspicious';
    badgeText.textContent = 'SUSPICIOUS';
    badgeText.className = 'security-badge-text suspicious';
    
    // Show reason if available
    if (statusData.reason) {
      reasonText.textContent = statusData.reason;
      reasonDiv.style.display = 'block';
    } else {
      reasonDiv.style.display = 'none';
    }
  } else if (statusData.status === 'UNAVAILABLE') {
    // Grey badge for unavailable
    badge.className = 'security-badge unavailable';
    badgeDot.className = 'security-badge-dot unavailable';
    badgeText.textContent = 'Status Unavailable';
    badgeText.className = 'security-badge-text unavailable';
    reasonDiv.style.display = 'none';
  } else {
    // Green badge for OK
    badge.className = 'security-badge ok';
    badgeDot.className = 'security-badge-dot ok';
    badgeText.textContent = 'SECURE';
    badgeText.className = 'security-badge-text ok';
    reasonDiv.style.display = 'none';
  }
}

// Initialize dashboard
async function init() {
  // Show loading state
  document.getElementById('statusText').textContent = 'Loading...';

  // Setup event listeners
  document.getElementById('copyDeviceIdBtn').addEventListener('click', copyDeviceId);
  document.getElementById('fitBoundsBtn').addEventListener('click', fitBoundsToPath);
  document.getElementById('clearPathBtn').addEventListener('click', clearPath);

  // Fetch device status on load
  await fetchDeviceStatus();

  // Try to fetch latest location first to get initial coordinates
  const latest = await fetchLatestLocation();

  // Initialize map with latest location or default
  if (latest) {
    initMap(latest.latitude, latest.longitude);
    updateMarker(latest.latitude, latest.longitude, latest.accuracy, currentSecurityStatus);
  } else {
    // Default to a center point (you can change this)
    initMap(26.1594, 81.7976);
  }

  // Fetch history to draw path
  await fetchHistory();

  // Start polling for location updates
  setInterval(fetchLatestLocation, POLL_INTERVAL);
  
  // Start polling for security status (every 12 seconds)
  setInterval(fetchDeviceStatus, STATUS_POLL_INTERVAL);
  
  // Update refresh indicator every second
  setInterval(updateRefreshIndicator, 1000);
  
  // Continuously remove attribution footer (catches any dynamically added ones)
  setInterval(removeAttributionFooter, 2000);
}
