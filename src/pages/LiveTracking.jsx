import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import { Loader, MapPin, Navigation, ArrowLeft, Clock, Calendar, RotateCcw, Route, Phone, Flag, List, Map as MapIcon, CheckCircle2, AlertTriangle, ShieldCheck, Briefcase, ExternalLink } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import 'leaflet/dist/leaflet.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Indian Standard Time Helpers
const getTodayDateStr = () => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch { }
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const checkIsWithinOfficeHoursIST = () => {
    try {
        const istFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            hour: 'numeric',
            minute: 'numeric'
        });
        const parts = istFormatter.formatToParts(new Date());
        let hour = 0, minute = 0;
        for (const p of parts) {
            if (p.type === 'hour') hour = parseInt(p.value, 10);
            if (p.type === 'minute') minute = parseInt(p.value, 10);
        }
        const totalMinutes = hour * 60 + minute;
        // 9:30 AM (570) to 6:00 PM (1080)
        return totalMinutes >= 570 && totalMinutes < 1080;
    } catch {
        const now = new Date();
        const ist = new Date(now.getTime() + (330 * 60 * 1000));
        const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
        return totalMinutes >= 570 && totalMinutes < 1080;
    }
};

const formatDateTime = (dateVal) => {
    if (!dateVal) return 'N/A';
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return String(dateVal);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

const formatTimeOnly = (dateVal) => {
    if (!dateVal) return 'N/A';
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return String(dateVal);
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

// Calculate travel distance in km using the Haversine formula
const calculateDistanceKm = (coords) => {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lat1, lon1] = coords[i];
        const [lat2, lon2] = coords[i + 1];
        if (lat1 === lat2 && lon1 === lon2) continue;
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        total += R * c;
    }
    return total;
};

// SVG Icon Data URLs
const currentPosSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4f46e5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
  <circle cx="12" cy="10" r="3" fill="white"></circle>
</svg>
`);

const startPosSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
  <circle cx="12" cy="10" r="3" fill="white"></circle>
</svg>
`);

const currentMarkerIcon = new L.Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${currentPosSvg}`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
});

const startMarkerIcon = new L.Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${startPosSvg}`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
});

// Stop marker generator for intermediate visited locations
const createStopMarkerIcon = (stopNumber) => {
    const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="13" fill="#f59e0b" stroke="white" stroke-width="2.5" />
      <text x="16" y="21" font-size="12" font-weight="bold" fill="white" text-anchor="middle" font-family="sans-serif">${stopNumber}</text>
    </svg>
    `);
    return new L.Icon({
        iconUrl: `data:image/svg+xml;charset=utf-8,${svg}`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
    });
};

// Client Drop-Pin Marker: Vibrant red drop-pin indicating assigned client locations
const clientDropPinSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46">
  <defs>
    <filter id="clientPinShadow" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <path d="M18 1 C8.6 1 1 8.6 1 18 C1 29 18 45 18 45 C18 45 35 29 35 18 C35 8.6 27.4 1 18 1 Z" fill="#e11d48" stroke="#ffffff" stroke-width="2.5" filter="url(#clientPinShadow)"/>
  <circle cx="18" cy="17" r="7.5" fill="#ffffff"/>
  <path d="M14 14 h8 v6 h-8 Z" fill="#e11d48" rx="1.5"/>
</svg>
`);

const clientDropPinIcon = new L.Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${clientDropPinSvg}`,
    iconSize: [36, 46],
    iconAnchor: [18, 45],
    popupAnchor: [0, -45],
});

// Comprehensive Mysore locality dictionary for instant, accurate address geocoding
const MYSORE_LOCALITIES = {
    'kuvempunagar': [12.2855, 76.6268],
    'hebbal': [12.3601, 76.6025],
    'metagalli': [12.3486, 76.6272],
    'vijayanagar': [12.3364, 76.6111],
    'gokulam': [12.3323, 76.6322],
    'saraswathipuram': [12.3021, 76.6347],
    'jayalakshmipuram': [12.3188, 76.6267],
    'mandi mohalla': [12.3162, 76.6542],
    'bannimantap': [12.3392, 76.6514],
    'dattagalli': [12.2681, 76.6125],
    'ramakrishna nagar': [12.2745, 76.6247],
    'vidyaranyapuram': [12.2842, 76.6521],
    'jp nagar': [12.2662, 76.6481],
    'j p nagar': [12.2662, 76.6481],
    'yadavagiri': [12.3275, 76.6382],
    'nazarbad': [12.3105, 76.6661],
    'siddhartha layout': [12.3045, 76.6805],
    'alanahalli': [12.2961, 76.6914],
    'bogadi': [12.3072, 76.6015],
    'krs road': [12.3521, 76.6212],
    'hootagalli': [12.3481, 76.5781],
    'chamundipuram': [12.2932, 76.6565],
    'lashkar mohalla': [12.3142, 76.6582],
    'srirampura': [12.2642, 76.6301],
    'shivarampete': [12.3092, 76.6492],
    'devaraja': [12.3071, 76.6485],
    'vishwamanava': [12.2882, 76.6291],
    'navilu road': [12.2905, 76.6315],
    'prerana hospital': [12.2871, 76.6302],
    'chandramani circle': [12.2841, 76.6310],
    'subash nagar': [12.3211, 76.6589],
    'ashokapuram': [12.2891, 76.6455],
    'lakshmipuram': [12.2991, 76.6489],
    'mysore': [12.2958, 76.6394]
};

const resolveAddressToCoords = (address) => {
    if (!address || typeof address !== 'string') return null;
    const lower = address.toLowerCase();

    // Check direct coordinates if present like "12.345, 76.543"
    const coordMatch = lower.match(/([0-9]+\.[0-9]+)[,\s]+([0-9]+\.[0-9]+)/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }

    // Match locality from dictionary
    for (const [key, coords] of Object.entries(MYSORE_LOCALITIES)) {
        if (lower.includes(key)) {
            // Apply slight deterministic micro-jitter so multiple client locations in same locality don't stack directly
            let hash = 0;
            for (let i = 0; i < address.length; i++) hash = (hash << 5) - hash + address.charCodeAt(i);
            const jitterLat = ((Math.abs(hash) % 100) - 50) * 0.00003;
            const jitterLng = ((Math.abs(hash >> 2) % 100) - 50) * 0.00003;
            return [coords[0] + jitterLat, coords[1] + jitterLng];
        }
    }

    // Fallback: central Mysore area with hash dispersion
    let hash = 0;
    for (let i = 0; i < address.length; i++) hash = (hash << 5) - hash + address.charCodeAt(i);
    const offsetLat = ((Math.abs(hash) % 200) - 100) * 0.0001;
    const offsetLng = ((Math.abs(hash >> 3) % 200) - 100) * 0.0001;
    return [12.3051 + offsetLat, 76.6455 + offsetLng];
};

// Animated Marker for smooth live movement updates
const AnimatedMarker = ({ position, name, employeeId, isLive, lastUpdateTime }) => {
    const [currentPos, setCurrentPos] = useState(position);
    const prevPosRef = useRef(position);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!position) return;
        const startPos = prevPosRef.current || position;
        const endPos = position;
        const duration = 1200;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const lat = startPos[0] + (endPos[0] - startPos[0]) * progress;
            const lng = startPos[1] + (endPos[1] - startPos[1]) * progress;
            setCurrentPos([lat, lng]);
            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                prevPosRef.current = endPos;
            }
        };
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [position]);

    return (
        <Marker position={currentPos || position} icon={currentMarkerIcon}>
            <Popup>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>{name}</div>
                {employeeId && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {employeeId}</div>}
                <div style={{
                    fontSize: '0.78rem',
                    color: isLive ? '#10b981' : '#64748b',
                    marginTop: '4px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLive ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
                    {isLive ? 'Live GPS Location (Active)' : 'Last Known Location'}
                </div>
                {lastUpdateTime && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        Time: {formatDateTime(lastUpdateTime)}
                    </div>
                )}
            </Popup>
        </Marker>
    );
};

// Auto-focus and fit map bounds to the route and client locations
const MapFocus = ({ position, path, clientCoords, focusedLocation }) => {
    const map = useMap();
    useEffect(() => {
        if (focusedLocation) {
            map.setView(focusedLocation, 16, { animate: true });
            return;
        }

        const allPoints = [...(path || [])];
        if (clientCoords && clientCoords.length > 0) {
            allPoints.push(...clientCoords);
        }

        if (allPoints.length > 1) {
            try {
                const bounds = L.latLngBounds(allPoints);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
                }
            } catch (e) {
                if (position) map.setView(position, 15, { animate: true });
            }
        } else if (position) {
            map.setView(position, 15, { animate: true });
        }
    }, [position, path, clientCoords, focusedLocation, map]);
    return null;
};

const LiveTracking = ({ user }) => {
    const navigate = useNavigate();

    // Strict access control: Only Admin and Team Lead
    useEffect(() => {
        const role = user?.role || user?.Role;
        if (role !== 'Admin' && role !== 'Team Lead') {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    const todayStr = useMemo(() => getTodayDateStr(), []);
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [executives, setExecutives] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [routePoints, setRoutePoints] = useState([]);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [assignedClients, setAssignedClients] = useState([]);
    const [availableDates, setAvailableDates] = useState([]);
    const [viewMode, setViewMode] = useState('map'); // 'map' | 'timeline' | 'clients'
    const [inOfficeHours, setInOfficeHours] = useState(checkIsWithinOfficeHoursIST());
    const [focusedLocation, setFocusedLocation] = useState(null);
    const socketRef = useRef(null);

    const isToday = selectedDate === todayStr;

    // Periodically update office hours status
    useEffect(() => {
        const timer = setInterval(() => {
            setInOfficeHours(checkIsWithinOfficeHoursIST());
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    // 1. Fetch Field Executives list
    useEffect(() => {
        const initTracking = async () => {
            try {
                const res = await fetch(`${API_URL}/api/users/role/Field Executive`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (!res.ok) throw new Error('Failed to fetch executives');
                const users = await res.json();

                const initialData = {};
                for (const exec of users) {
                    const lat = parseFloat(exec.Latitude);
                    const lng = parseFloat(exec.Longitude);
                    const hasValidPos = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
                    initialData[exec.UserID] = {
                        id: exec.UserID,
                        name: exec.EmployeeName,
                        phone: exec.ContactNumber || exec.Phone || 'N/A',
                        employeeId: exec.EmployeeID || 'N/A',
                        isOnline: Boolean(exec.IsOnline),
                        pos: hasValidPos ? [lat, lng] : null,
                        lastUpdate: exec.LastLocationUpdate || null,
                        lastOfflineTime: exec.LastOfflineTime || exec.LastLocationUpdate || null,
                        path: hasValidPos ? [[lat, lng]] : []
                    };
                }
                setExecutives(initialData);

                // Auto-select first executive if none selected
                const firstId = Object.keys(initialData)[0];
                if (firstId && !selectedId) {
                    setSelectedId(parseInt(firstId, 10));
                }
                setLoading(false);
            } catch (err) {
                console.error('[LIVE TRACKING] Init error:', err);
                setLoading(false);
            }
        };

        initTracking();

        // 2. Connect to Socket for continuous real-time updates
        socketRef.current = io(API_URL, {
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join', {
                userId: user.id || user.UserID,
                role: user.role || user.Role
            });
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('[LIVE TRACKING] Socket error:', err);
        });

        // Real-time location update event from Field Executives
        socketRef.current.on('locationUpdate', (data) => {
            const { userId, lat, lng, timestamp } = data;
            const parsedLat = parseFloat(lat);
            const parsedLng = parseFloat(lng);
            if (isNaN(parsedLat) || isNaN(parsedLng)) return;

            const updateTime = timestamp ? new Date(timestamp) : new Date();

            setExecutives(prev => {
                const current = prev[userId] || { name: 'Field Executive', path: [] };
                const newPath = [...(current.path || []), [parsedLat, parsedLng]].slice(-500);
                return {
                    ...prev,
                    [userId]: {
                        ...current,
                        pos: [parsedLat, parsedLng],
                        path: newPath,
                        isOnline: true,
                        lastUpdate: updateTime.toISOString()
                    }
                };
            });

            // If update belongs to viewed executive on today's date, append to routePoints
            setRoutePoints(prevPoints => {
                if (selectedId && parseInt(userId, 10) === parseInt(selectedId, 10) && isToday) {
                    return [...prevPoints, {
                        HistoryID: Date.now(),
                        UserID: userId,
                        Latitude: parsedLat,
                        Longitude: parsedLng,
                        Timestamp: updateTime.toISOString()
                    }];
                }
                return prevPoints;
            });
        });

        // Online / Offline status changes
        socketRef.current.on('executiveStatusChange', (data) => {
            const { userId, status, time } = data;
            setExecutives(prev => {
                if (!prev[userId]) return prev;
                return {
                    ...prev,
                    [userId]: {
                        ...prev[userId],
                        isOnline: status === 'Online',
                        lastOfflineTime: status === 'Offline' ? (time || new Date().toISOString()) : prev[userId].lastOfflineTime
                    }
                };
            });
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [user, isToday, selectedId]);

    // 3. Fetch travel route history and assigned client locations for selected executive & date
    const fetchRouteHistory = useCallback(async (userId, date) => {
        if (!userId) return;
        setLoadingRoute(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/api/users/${userId}/location-history?date=${date}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load route history');
            const points = await res.json();
            setRoutePoints(points || []);

            // Fetch available dates with history
            const datesRes = await fetch(`${API_URL}/api/users/${userId}/location-history/dates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (datesRes.ok) {
                const datesData = await datesRes.json();
                setAvailableDates(datesData || []);
            }

            // Fetch client locations assigned by Call Executive to this Field Executive
            const clientsRes = await fetch(`${API_URL}/api/users/${userId}/assigned-clients?date=${date}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (clientsRes.ok) {
                const clientsData = await clientsRes.json();
                setAssignedClients(clientsData || []);
            } else {
                setAssignedClients([]);
            }
        } catch (err) {
            console.error('[LIVE TRACKING] Route fetch error:', err);
            setRoutePoints([]);
            setAssignedClients([]);
        } finally {
            setLoadingRoute(false);
        }
    }, []);

    useEffect(() => {
        if (selectedId) {
            setFocusedLocation(null);
            fetchRouteHistory(selectedId, selectedDate);
        }
    }, [selectedId, selectedDate, fetchRouteHistory]);

    // Compute clean route path coordinates without jitter (< 6 meters)
    const routeCoords = useMemo(() => {
        if (!routePoints || routePoints.length === 0) {
            const exec = executives[selectedId];
            return exec?.pos ? [exec.pos] : [];
        }
        const raw = routePoints
            .filter(p => p.Latitude && p.Longitude && !isNaN(p.Latitude) && !isNaN(p.Longitude))
            .map(p => [parseFloat(p.Latitude), parseFloat(p.Longitude)]);

        if (raw.length <= 2) return raw;

        const clean = [raw[0]];
        let lastPt = raw[0];
        for (let i = 1; i < raw.length; i++) {
            const pt = raw[i];
            const dLat = (pt[0] - lastPt[0]) * 111320;
            const dLng = (pt[1] - lastPt[1]) * 111320 * Math.cos(lastPt[0] * Math.PI / 180);
            const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);
            if (distMeters >= 6 || i === raw.length - 1) {
                clean.push(pt);
                lastPt = pt;
            }
        }
        return clean;
    }, [routePoints, executives, selectedId]);

    // Compute intermediate visited stops from chronological route points
    const visitedStops = useMemo(() => {
        if (!routePoints || routePoints.length < 4) return [];
        const stops = [];
        let currentCluster = [routePoints[0]];

        for (let i = 1; i < routePoints.length; i++) {
            const pt = routePoints[i];
            const clusterStart = currentCluster[0];
            const dLat = (parseFloat(pt.Latitude) - parseFloat(clusterStart.Latitude)) * 111320;
            const dLng = (parseFloat(pt.Longitude) - parseFloat(clusterStart.Longitude)) * 111320 * Math.cos(parseFloat(clusterStart.Latitude) * Math.PI / 180);
            const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);

            if (distMeters < 35) {
                currentCluster.push(pt);
            } else {
                const startTime = new Date(currentCluster[0].Timestamp).getTime();
                const endTime = new Date(currentCluster[currentCluster.length - 1].Timestamp).getTime();
                const durationMinutes = Math.round((endTime - startTime) / 60000);

                // If stayed >= 4 minutes, record as a stop
                if (durationMinutes >= 4 && currentCluster.length >= 3) {
                    const avgLat = currentCluster.reduce((sum, p) => sum + parseFloat(p.Latitude), 0) / currentCluster.length;
                    const avgLng = currentCluster.reduce((sum, p) => sum + parseFloat(p.Longitude), 0) / currentCluster.length;
                    stops.push({
                        stopIndex: stops.length + 1,
                        coords: [avgLat, avgLng],
                        startTime: currentCluster[0].Timestamp,
                        endTime: currentCluster[currentCluster.length - 1].Timestamp,
                        durationMinutes,
                        pointsCount: currentCluster.length
                    });
                }
                currentCluster = [pt];
            }
        }
        return stops;
    }, [routePoints]);

    // Process assigned client locations with Mysore geocoding
    const geocodedClients = useMemo(() => {
        if (!assignedClients || assignedClients.length === 0) return [];
        return assignedClients.map(client => {
            const addressStr = `${client.Address || ''} ${client.CompanyName || ''} ${client.FullName || ''}`;
            const coords = resolveAddressToCoords(addressStr);
            return {
                ...client,
                coords
            };
        }).filter(c => c.coords !== null);
    }, [assignedClients]);

    // Road network snapping: follow actual streets route-wise
    const [snappedRoute, setSnappedRoute] = useState([]);

    useEffect(() => {
        let isMounted = true;
        if (!routePoints || routePoints.length < 2) {
            setSnappedRoute([]);
            return;
        }

        const validPoints = routePoints.filter(p => p.Latitude && p.Longitude && !isNaN(p.Latitude) && !isNaN(p.Longitude));
        if (validPoints.length < 2) {
            setSnappedRoute([]);
            return;
        }

        const maxSample = 15;
        const sampled = [];
        if (validPoints.length <= maxSample) {
            sampled.push(...validPoints);
        } else {
            const step = (validPoints.length - 1) / (maxSample - 1);
            for (let i = 0; i < maxSample; i++) {
                sampled.push(validPoints[Math.min(Math.round(i * step), validPoints.length - 1)]);
            }
        }

        const coordsStr = sampled.map(p => `${parseFloat(p.Longitude).toFixed(6)},${parseFloat(p.Latitude).toFixed(6)}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
                    const roadCoords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                    setSnappedRoute(roadCoords);
                }
            })
            .catch(() => {
                // Fallback gracefully to routeCoords
            });

        return () => { isMounted = false; };
    }, [routePoints]);

    const displayRoute = useMemo(() => {
        if (snappedRoute && snappedRoute.length > 0) return snappedRoute;
        return routeCoords;
    }, [snappedRoute, routeCoords]);

    // Route Metrics
    const totalDistance = useMemo(() => calculateDistanceKm(displayRoute), [displayRoute]);
    const startPoint = routePoints.length > 0 ? routePoints[0] : null;
    const endPoint = routePoints.length > 0 ? routePoints[routePoints.length - 1] : null;
    const startCoords = startPoint ? [parseFloat(startPoint.Latitude), parseFloat(startPoint.Longitude)] : null;
    const latestCoords = endPoint ? [parseFloat(endPoint.Latitude), parseFloat(endPoint.Longitude)] : (executives[selectedId]?.pos || null);

    const activeList = Object.values(executives);
    const selectedData = selectedId ? executives[selectedId] : null;

    // Distinguish live locations vs. outdated locations
    const isExecutiveLive = useMemo(() => {
        if (!isToday || !inOfficeHours || !selectedData || !selectedData.isOnline) return false;
        if (!selectedData.lastUpdate) return false;
        const lastUpTime = new Date(selectedData.lastUpdate).getTime();
        const diffMinutes = (Date.now() - lastUpTime) / 60000;
        return diffMinutes <= 5;
    }, [isToday, inOfficeHours, selectedData]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <Loader size={44} className="spin" color="#6366f1" />
                <p style={{ marginTop: '16px', color: '#64748b', fontWeight: '600' }}>Loading Live Tracking Center...</p>
                <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
            <UserHeader user={user} title="Field Visit Live Tracking & Route History" />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="tracking-container">
                {/* Left Sidebar */}
                <div className="tracking-sidebar" style={{ width: '380px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                    {/* Header */}
                    <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#475569' }}
                            >
                                <ArrowLeft size={15} /> Dashboard
                            </button>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: isToday ? (inOfficeHours ? '#dcfce7' : '#fef3c7') : '#e0e7ff',
                                color: isToday ? (inOfficeHours ? '#166534' : '#92400e') : '#3730a3'
                            }}>
                                {isToday ? (inOfficeHours ? 'LIVE TRACKING' : 'OUTSIDE HOURS') : 'HISTORY MODE'}
                            </span>
                        </div>

                        <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                            <div style={{ padding: '6px', background: '#4f46e5', borderRadius: '8px', color: 'white', display: 'flex' }}>
                                <Navigation size={18} />
                            </div>
                            Field Visit Tracking
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.78rem', margin: 0 }}>
                            Automatic schedule: <b>9:30 AM – 6:00 PM IST</b>
                        </p>
                    </div>

                    {/* Date Selector */}
                    <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Calendar size={13} color="#4f46e5" /> Select Travel Date
                            </label>
                            {!isToday && (
                                <button
                                    onClick={() => setSelectedDate(todayStr)}
                                    style={{
                                        border: 'none',
                                        background: '#4f46e5',
                                        color: 'white',
                                        fontSize: '0.72rem',
                                        fontWeight: '700',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <RotateCcw size={11} /> Back to Today (Live)
                                </button>
                            )}
                        </div>
                        <input
                            type="date"
                            value={selectedDate}
                            max={todayStr}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val && val > todayStr) {
                                    setSelectedDate(todayStr);
                                } else if (val) {
                                    setSelectedDate(val);
                                }
                            }}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                fontSize: '0.85rem',
                                color: '#1e293b',
                                fontWeight: '600',
                                boxSizing: 'border-box'
                            }}
                            title="Filter route by date"
                        />
                    </div>

                    {/* Executive List */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Field Executives ({activeList.length})
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>
                                {activeList.filter(e => e.isOnline).length} Active
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activeList.map(exec => {
                                const isSelected = selectedId === exec.id;
                                const isLiveNow = isToday && inOfficeHours && exec.isOnline;
                                return (
                                    <div
                                        key={exec.id}
                                        onClick={() => {
                                            setSelectedId(exec.id);
                                            setFocusedLocation(null);
                                        }}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            background: isSelected ? '#f5f3ff' : 'white',
                                            border: isSelected ? '2px solid #6366f1' : (isLiveNow ? '1px solid #86efac' : '1px solid #e2e8f0'),
                                            boxShadow: isSelected ? '0 4px 12px rgba(99,102,241,0.12)' : '0 1px 2px rgba(0,0,0,0.03)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isSelected ? '#6366f1' : '#e2e8f0', color: isSelected ? 'white' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem' }}>
                                                    {exec.name?.charAt(0)?.toUpperCase() || 'F'}
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: isSelected ? '#4338ca' : '#1e293b' }}>
                                                        {exec.name}
                                                    </h4>
                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID: {exec.employeeId}</span>
                                                </div>
                                            </div>

                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                background: isLiveNow ? '#dcfce7' : (!inOfficeHours ? '#f1f5f9' : '#fee2e2'),
                                                color: isLiveNow ? '#166534' : (!inOfficeHours ? '#64748b' : '#991b1b'),
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLiveNow ? '#22c55e' : '#94a3b8' }} />
                                                {isLiveNow ? 'LIVE' : (!inOfficeHours ? 'OFF-HOURS' : 'OFFLINE')}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f8fafc', fontSize: '0.72rem', color: '#64748b' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Phone size={11} /> {exec.phone}
                                            </span>
                                            <span>
                                                {exec.lastUpdate ? `Updated: ${formatTimeOnly(exec.lastUpdate)}` : `Seen: ${formatDateTime(exec.lastOfflineTime)}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Side - Map and Route Visualization */}
                <div className="tracking-map-area" style={{ flex: 1, position: 'relative', background: '#f8fafc' }}>
                    {!selectedData ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <MapPin size={56} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                            <h3 style={{ color: '#475569', margin: '0 0 6px 0' }}>No Field Executive Selected</h3>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>Choose an executive from the list to view live location, assigned client pins, and travel routes</p>
                        </div>
                    ) : (
                        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                            {/* Route & Status Overlay Card */}
                            <div style={{
                                position: 'absolute',
                                top: '16px',
                                left: '16px',
                                zIndex: 1000,
                                background: 'rgba(255, 255, 255, 0.96)',
                                backdropFilter: 'blur(10px)',
                                padding: '16px 20px',
                                borderRadius: '16px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                minWidth: '350px',
                                maxWidth: '92%'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: '800' }}>{selectedData.name}</h3>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                background: isExecutiveLive ? '#dcfce7' : '#fee2e2',
                                                color: isExecutiveLive ? '#166534' : '#991b1b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isExecutiveLive ? '#16a34a' : '#dc2626' }} />
                                                {isExecutiveLive ? 'LIVE' : 'LAST KNOWN'}
                                            </span>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '0.65rem',
                                                fontWeight: '700',
                                                background: '#eff6ff',
                                                color: '#2563eb',
                                                border: '1px solid #bfdbfe'
                                            }}>
                                                9:30 AM – 6:00 PM
                                            </span>
                                        </div>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                            Date: <b>{selectedDate.split('-').reverse().join('-')}</b> {isToday && '(Today)'}
                                        </p>
                                    </div>

                                    {/* View Toggle: Map vs Timeline vs Assigned Clients */}
                                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px', flexShrink: 0 }}>
                                        <button
                                            onClick={() => { setViewMode('map'); setFocusedLocation(null); }}
                                            style={{
                                                border: 'none',
                                                background: viewMode === 'map' ? 'white' : 'transparent',
                                                color: viewMode === 'map' ? '#4f46e5' : '#64748b',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                boxShadow: viewMode === 'map' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                            }}
                                        >
                                            <MapIcon size={12} /> Map
                                        </button>
                                        <button
                                            onClick={() => setViewMode('timeline')}
                                            style={{
                                                border: 'none',
                                                background: viewMode === 'timeline' ? 'white' : 'transparent',
                                                color: viewMode === 'timeline' ? '#4f46e5' : '#64748b',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                boxShadow: viewMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                            }}
                                        >
                                            <List size={12} /> Stops ({visitedStops.length})
                                        </button>
                                        <button
                                            onClick={() => setViewMode('clients')}
                                            style={{
                                                border: 'none',
                                                background: viewMode === 'clients' ? '#ffe4e6' : 'transparent',
                                                color: viewMode === 'clients' ? '#e11d48' : '#64748b',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                boxShadow: viewMode === 'clients' ? '0 1px 3px rgba(225,29,72,0.15)' : 'none'
                                            }}
                                            title="View clients assigned by Call Executive"
                                        >
                                            <MapPin size={12} color="#e11d48" /> Clients ({geocodedClients.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Metrics Badges */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ background: '#f8fafc', padding: '6px 4px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', fontWeight: '600' }}>Distance</span>
                                        <b style={{ fontSize: '0.85rem', color: '#4f46e5' }}>{totalDistance.toFixed(2)} km</b>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '6px 4px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', fontWeight: '600' }}>GPS Points</span>
                                        <b style={{ fontSize: '0.85rem', color: '#059669' }}>{routePoints.length}</b>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '6px 4px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', fontWeight: '600' }}>Stops</span>
                                        <b style={{ fontSize: '0.85rem', color: '#d97706' }}>{visitedStops.length}</b>
                                    </div>
                                    <div style={{ background: '#fff1f2', padding: '6px 4px', borderRadius: '10px', textAlign: 'center', border: '1px solid #ffe4e6' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#e11d48', display: 'block', fontWeight: '700' }}>Clients</span>
                                        <b style={{ fontSize: '0.85rem', color: '#e11d48' }}>{geocodedClients.length}</b>
                                    </div>
                                </div>

                                {startPoint && (
                                    <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f8fafc', paddingTop: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                            <span>Start: <b>{formatTimeOnly(startPoint.Timestamp)}</b></span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isExecutiveLive ? '#10b981' : '#4f46e5', display: 'inline-block' }} />
                                            <span>Latest: <b>{formatTimeOnly(endPoint?.Timestamp || selectedData.lastUpdate)}</b></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Assigned Clients List Overlay */}
                            {viewMode === 'clients' ? (
                                <div style={{
                                    height: '100%',
                                    width: '100%',
                                    background: 'white',
                                    overflowY: 'auto',
                                    padding: '160px 30px 40px 30px',
                                    boxSizing: 'border-box'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: 0, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <MapPin size={20} color="#e11d48" /> Assigned Client Locations
                                            </h3>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                                Clients assigned by Call Executive to {selectedData.name} (indicated on map with red drop-pins)
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setViewMode('map')}
                                            style={{
                                                padding: '6px 14px',
                                                background: '#4f46e5',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            View Pins on Map
                                        </button>
                                    </div>

                                    {geocodedClients.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                            <MapPin size={48} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                                            <p style={{ margin: 0, fontWeight: '600' }}>No client locations assigned to this Field Executive for this date.</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                                            {geocodedClients.map(client => (
                                                <div
                                                    key={client.LeadID}
                                                    style={{
                                                        background: '#fff',
                                                        border: '1px solid #fecdd3',
                                                        borderRadius: '14px',
                                                        padding: '16px',
                                                        boxShadow: '0 2px 8px rgba(225,29,72,0.06)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                            <div>
                                                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#0f172a' }}>
                                                                    {client.FullName}
                                                                </h4>
                                                                {client.CompanyName && (
                                                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
                                                                        🏢 {client.CompanyName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span style={{
                                                                background: '#ffe4e6',
                                                                color: '#e11d48',
                                                                padding: '2px 8px',
                                                                borderRadius: '12px',
                                                                fontSize: '0.68rem',
                                                                fontWeight: '800'
                                                            }}>
                                                                PIN #{client.LeadID}
                                                            </span>
                                                        </div>

                                                        <div style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', margin: '10px 0' }}>
                                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                <MapPin size={14} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                                <span><b>Location:</b> {client.Address || 'N/A'}</span>
                                                            </div>
                                                            {client.Phone && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <Phone size={13} color="#6366f1" style={{ flexShrink: 0 }} />
                                                                    <span>{client.Phone}</span>
                                                                </div>
                                                            )}
                                                            {client.AssignedByName && (
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', paddingTop: '4px', borderTop: '1px solid #f8fafc' }}>
                                                                    Assigned by: <b>{client.AssignedByName}</b> {client.AssignedByRole ? `(${client.AssignedByRole})` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                                        <button
                                                            onClick={() => {
                                                                setFocusedLocation(client.coords);
                                                                setViewMode('map');
                                                            }}
                                                            style={{
                                                                flex: 1,
                                                                padding: '6px 12px',
                                                                background: '#e11d48',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '700',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            <MapPin size={12} /> Focus on Map
                                                        </button>
                                                        {client.Address && (
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.Address)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    padding: '6px 10px',
                                                                    background: '#f1f5f9',
                                                                    color: '#475569',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '600',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    textDecoration: 'none'
                                                                }}
                                                            >
                                                                <ExternalLink size={12} /> Google Maps
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : viewMode === 'timeline' ? (
                                /* Timeline View Overlay */
                                <div style={{
                                    height: '100%',
                                    width: '100%',
                                    background: 'white',
                                    overflowY: 'auto',
                                    padding: '160px 30px 40px 30px',
                                    boxSizing: 'border-box'
                                }}>
                                    <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: '0 0 16px 0', fontWeight: '800' }}>
                                        Travel & Visited Stops Timeline
                                    </h3>

                                    {routePoints.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                            No travel route recorded for this date.
                                        </div>
                                    ) : (
                                        <div style={{ position: 'relative', borderLeft: '2px dashed #cbd5e1', marginLeft: '16px', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* Journey Start */}
                                            {startPoint && (
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '-33px', top: '0px', width: '16px', height: '16px', borderRadius: '50%', background: '#10b981', border: '3px solid white', boxShadow: '0 0 0 2px #10b981' }} />
                                                    <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <b style={{ color: '#166534', fontSize: '0.88rem' }}>Route Start (9:30 AM Window)</b>
                                                            <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700' }}>{formatTimeOnly(startPoint.Timestamp)}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '4px' }}>
                                                            Coordinates: {parseFloat(startPoint.Latitude).toFixed(5)}, {parseFloat(startPoint.Longitude).toFixed(5)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Intermediate Visited Stops */}
                                            {visitedStops.map((stop) => (
                                                <div key={stop.stopIndex} style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '-33px', top: '0px', width: '16px', height: '16px', borderRadius: '50%', background: '#f59e0b', border: '3px solid white', boxShadow: '0 0 0 2px #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ fontSize: '8px', color: 'white', fontWeight: 'bold' }}>{stop.stopIndex}</span>
                                                    </div>
                                                    <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <b style={{ color: '#92400e', fontSize: '0.88rem' }}>Stop #{stop.stopIndex} - Stayed ~{stop.durationMinutes} mins</b>
                                                            <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: '700' }}>
                                                                {formatTimeOnly(stop.startTime)} - {formatTimeOnly(stop.endTime)}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: '4px' }}>
                                                            Location: {stop.coords[0].toFixed(5)}, {stop.coords[1].toFixed(5)} ({stop.pointsCount} GPS pings)
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Latest / Final Location */}
                                            {endPoint && (
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '-33px', top: '0px', width: '16px', height: '16px', borderRadius: '50%', background: '#4f46e5', border: '3px solid white', boxShadow: '0 0 0 2px #4f46e5' }} />
                                                    <div style={{ background: '#eef2ff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #c7d2fe' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <b style={{ color: '#3730a3', fontSize: '0.88rem' }}>
                                                                {isToday ? (isExecutiveLive ? 'Current Live Position' : 'Latest Recorded Location') : 'Final End Location'}
                                                            </b>
                                                            <span style={{ fontSize: '0.75rem', color: '#3730a3', fontWeight: '700' }}>{formatTimeOnly(endPoint.Timestamp)}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#4338ca', marginTop: '4px' }}>
                                                            Coordinates: {parseFloat(endPoint.Latitude).toFixed(5)}, {parseFloat(endPoint.Longitude).toFixed(5)} • Cumulative: {totalDistance.toFixed(2)} km
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Map View */
                                displayRoute.length === 0 && geocodedClients.length === 0 ? (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <MapPin size={48} color="#cbd5e1" style={{ marginBottom: '14px' }} />
                                        <h3 style={{ color: '#475569', margin: '0 0 6px 0' }}>No Route Recorded</h3>
                                        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>
                                            No GPS location history was recorded for {selectedData.name} on {selectedDate.split('-').reverse().join('-')}.
                                        </p>
                                        {!isToday && (
                                            <button
                                                onClick={() => setSelectedDate(todayStr)}
                                                style={{
                                                    marginTop: '14px',
                                                    padding: '8px 16px',
                                                    background: '#4f46e5',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    fontSize: '0.82rem'
                                                }}
                                            >
                                                Switch to Today (Live)
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <MapContainer
                                            center={latestCoords || (geocodedClients[0]?.coords) || [12.2929, 76.6232]}
                                            zoom={14}
                                            style={{ height: '100%', width: '100%', zIndex: 1 }}
                                        >
                                            <TileLayer
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                attribution='&copy; OpenStreetMap contributors'
                                            />

                                            {/* Travel Route Polyline */}
                                            {displayRoute.length > 1 && (
                                                <Polyline
                                                    positions={displayRoute}
                                                    color="#4f46e5"
                                                    weight={4}
                                                    opacity={0.9}
                                                    dashArray="8, 10"
                                                />
                                            )}

                                            {/* Route Origin Marker (Green) */}
                                            {startCoords && (
                                                <Marker position={startCoords} icon={startMarkerIcon}>
                                                    <Popup>
                                                        <div style={{ fontWeight: 'bold', color: '#065f46' }}>Route Origin</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                            Started: {formatTimeOnly(startPoint?.Timestamp)}
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            )}

                                            {/* Intermediate Visited Stops (Amber Numbered Badges) */}
                                            {visitedStops.map((stop) => (
                                                <Marker key={stop.stopIndex} position={stop.coords} icon={createStopMarkerIcon(stop.stopIndex)}>
                                                    <Popup>
                                                        <div style={{ fontWeight: 'bold', color: '#92400e' }}>Stop #{stop.stopIndex}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#1e293b', marginTop: '2px' }}>
                                                            Duration: <b>~{stop.durationMinutes} mins</b>
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                            Arrival: {formatTimeOnly(stop.startTime)}<br />
                                                            Departure: {formatTimeOnly(stop.endTime)}
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            ))}

                                            {/* Assigned Client Location Markers (Red Drop-Pin Symbols) */}
                                            {geocodedClients.map((client) => (
                                                <Marker
                                                    key={`client-${client.LeadID}`}
                                                    position={client.coords}
                                                    icon={clientDropPinIcon}
                                                >
                                                    <Popup>
                                                        <div style={{ minWidth: '200px', padding: '2px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                                <span style={{ background: '#ffe4e6', color: '#e11d48', padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800' }}>
                                                                    📍 CLIENT LOCATION
                                                                </span>
                                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                                    #{client.LeadID}
                                                                </span>
                                                            </div>
                                                            <h4 style={{ margin: '0 0 2px 0', fontSize: '0.98rem', fontWeight: '800', color: '#0f172a' }}>
                                                                {client.FullName}
                                                            </h4>
                                                            {client.CompanyName && (
                                                                <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '700', marginBottom: '6px' }}>
                                                                    🏢 {client.CompanyName}
                                                                </div>
                                                            )}
                                                            <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: '4px', lineHeight: '1.4' }}>
                                                                <b>Address:</b> {client.Address || 'N/A'}
                                                            </div>
                                                            {client.Phone && (
                                                                <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: '4px' }}>
                                                                    📞 <b>Phone:</b> <a href={`tel:${client.Phone}`} style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: '600' }}>{client.Phone}</a>
                                                                </div>
                                                            )}
                                                            {client.AssignedByName && (
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                                                                    👤 <b>Assigned by:</b> {client.AssignedByName} {client.AssignedByRole ? `(${client.AssignedByRole})` : ''}
                                                                </div>
                                                            )}
                                                            {client.ScheduledTime && (
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                                    🕒 <b>Time:</b> {client.ScheduledTime}
                                                                </div>
                                                            )}
                                                            {client.Address && (
                                                                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f8fafc' }}>
                                                                    <a
                                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.Address)}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            color: '#e11d48',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: '700',
                                                                            textDecoration: 'none'
                                                                        }}
                                                                    >
                                                                        <ExternalLink size={12} /> Open in Google Maps
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            ))}

                                            {/* Current / Latest Position Marker (Indigo Animated) */}
                                            {latestCoords && (
                                                <AnimatedMarker
                                                    position={latestCoords}
                                                    name={selectedData.name}
                                                    employeeId={selectedData.employeeId}
                                                    isLive={isExecutiveLive}
                                                    lastUpdateTime={endPoint?.Timestamp || selectedData.lastUpdate}
                                                />
                                            )}

                                            <MapFocus
                                                position={latestCoords}
                                                path={displayRoute}
                                                clientCoords={geocodedClients.map(c => c.coords)}
                                                focusedLocation={focusedLocation}
                                            />
                                        </MapContainer>

                                        {/* Bottom Right Working Hours & Status Info Badge */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '20px',
                                            right: '20px',
                                            zIndex: 1000,
                                            background: 'rgba(255,255,255,0.94)',
                                            backdropFilter: 'blur(8px)',
                                            padding: '10px 16px',
                                            borderRadius: '12px',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            fontSize: '0.8rem',
                                            color: '#1e293b'
                                        }}>
                                            <Clock size={16} color="#4f46e5" />
                                            <span>
                                                {isToday ? (
                                                    inOfficeHours ? 'Working Hours Tracking Active (9:30 AM – 6:00 PM IST)' : 'Outside Office Hours (Tracking Stopped)'
                                                ) : (
                                                    `Route History for ${selectedDate.split('-').reverse().join('-')}`
                                                )}
                                                {geocodedClients.length > 0 && (
                                                    <span style={{ marginLeft: '8px', color: '#e11d48', fontWeight: '700' }}>
                                                        • {geocodedClients.length} Assigned Client Pin{geocodedClients.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .tracking-container {
                        flex-direction: column !important;
                        overflow-y: auto !important;
                    }
                    .tracking-sidebar {
                        width: 100% !important;
                        height: 340px !important;
                        border-right: none !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                    }
                    .tracking-map-area {
                        height: 450px !important;
                        flex: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default LiveTracking;
