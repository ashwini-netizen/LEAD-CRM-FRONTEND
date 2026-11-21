import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import { Loader, MapPin, Navigation, ArrowLeft, User, ShieldCheck, Clock, Calendar, RotateCcw, Route, Activity, Phone, Flag, ChevronRight, AlertCircle } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import 'leaflet/dist/leaflet.css';

const API_URL = import.meta.env.VITE_API_URL || '';

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

const formatDateTime = (dateVal) => {
    if (!dateVal) return 'N/A';
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return dateVal;
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
    if (isNaN(date.getTime())) return dateVal;
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

// Calculate total travel distance in km using the Haversine formula
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

// Animated Marker for smooth movement updates
const AnimatedMarker = ({ position, name, employeeId, isLive }) => {
    const [currentPos, setCurrentPos] = useState(position);
    const prevPosRef = useRef(position);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!position) return;
        const startPos = prevPosRef.current || position;
        const endPos = position;
        const duration = 1500;
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
                <div style={{ fontSize: '0.78rem', color: isLive ? '#10b981' : '#6366f1', marginTop: '4px', fontWeight: '700' }}>
                    {isLive ? '● Live Location (Active)' : 'Latest Recorded Point'}
                </div>
            </Popup>
        </Marker>
    );
};

// Auto-focus and fit map bounds to the route
const MapFocus = ({ position, path }) => {
    const map = useMap();
    useEffect(() => {
        if (path && path.length > 1) {
            try {
                const bounds = L.latLngBounds(path);
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
                }
            } catch (e) {
                if (position) map.setView(position, 15, { animate: true });
            }
        } else if (position) {
            map.setView(position, 15, { animate: true });
        }
    }, [position, path, map]);
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
    const [availableDates, setAvailableDates] = useState([]);
    const [activeTab, setActiveTab] = useState('map'); // 'map' | 'timeline'
    const socketRef = useRef(null);

    const isToday = selectedDate === todayStr;

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
                        phone: exec.Phone || exec.ContactNumber || 'N/A',
                        employeeId: exec.EmployeeID || 'N/A',
                        isOnline: Boolean(exec.IsOnline),
                        pos: hasValidPos ? [lat, lng] : null,
                        lastUpdate: exec.LastLocationUpdate ? new Date(exec.LastLocationUpdate).toLocaleTimeString() : null,
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
            const { userId, lat, lng } = data;
            const parsedLat = parseFloat(lat);
            const parsedLng = parseFloat(lng);
            if (isNaN(parsedLat) || isNaN(parsedLng)) return;

            setExecutives(prev => {
                const current = prev[userId] || { name: 'Unknown', path: [] };
                const newPath = [...(current.path || []), [parsedLat, parsedLng]].slice(-500);
                return {
                    ...prev,
                    [userId]: {
                        ...current,
                        pos: [parsedLat, parsedLng],
                        path: newPath,
                        isOnline: true,
                        lastUpdate: new Date().toLocaleTimeString()
                    }
                };
            });

            // If this update belongs to the currently viewed executive on today's date, append to routePoints
            setRoutePoints(prevPoints => {
                if (selectedId && parseInt(userId, 10) === parseInt(selectedId, 10) && isToday) {
                    return [...prevPoints, {
                        HistoryID: Date.now(),
                        UserID: userId,
                        Latitude: parsedLat,
                        Longitude: parsedLng,
                        Timestamp: new Date().toISOString()
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
    }, [user]);

    // 3. Fetch travel route history for selected executive & selected date
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

            // Also fetch available dates with history
            const datesRes = await fetch(`${API_URL}/api/users/${userId}/location-history/dates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (datesRes.ok) {
                const datesData = await datesRes.json();
                setAvailableDates(datesData || []);
            }
        } catch (err) {
            console.error('[LIVE TRACKING] Route fetch error:', err);
            setRoutePoints([]);
        } finally {
            setLoadingRoute(false);
        }
    }, []);

    useEffect(() => {
        if (selectedId) {
            fetchRouteHistory(selectedId, selectedDate);
        }
    }, [selectedId, selectedDate, fetchRouteHistory]);

    // Compute route path coordinates
    const routeCoords = useMemo(() => {
        if (!routePoints || routePoints.length === 0) {
            const exec = executives[selectedId];
            return exec?.pos ? [exec.pos] : [];
        }
        return routePoints
            .filter(p => p.Latitude && p.Longitude && !isNaN(p.Latitude) && !isNaN(p.Longitude))
            .map(p => [parseFloat(p.Latitude), parseFloat(p.Longitude)]);
    }, [routePoints, executives, selectedId]);

    // Route Metrics
    const totalDistance = useMemo(() => calculateDistanceKm(routeCoords), [routeCoords]);
    const startPoint = routePoints.length > 0 ? routePoints[0] : null;
    const endPoint = routePoints.length > 0 ? routePoints[routePoints.length - 1] : null;
    const startCoords = startPoint ? [parseFloat(startPoint.Latitude), parseFloat(startPoint.Longitude)] : null;
    const latestCoords = endPoint ? [parseFloat(endPoint.Latitude), parseFloat(endPoint.Longitude)] : (executives[selectedId]?.pos || null);

    const activeList = Object.values(executives);
    const selectedData = selectedId ? executives[selectedId] : null;

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
                    <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#475569' }}
                            >
                                <ArrowLeft size={15} /> Dashboard
                            </button>
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: isToday ? '#dcfce7' : '#e0e7ff', color: isToday ? '#166534' : '#3730a3' }}>
                                {isToday ? 'LIVE MODE' : 'HISTORY MODE'}
                            </span>
                        </div>

                        <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                            <div style={{ padding: '6px', background: '#4f46e5', borderRadius: '8px', color: 'white', display: 'flex' }}>
                                <Navigation size={18} />
                            </div>
                            Field Visit Tracking
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.78rem', margin: 0 }}>
                            Real-time GPS location & date-wise travel route history
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
                                {activeList.filter(e => e.isOnline).length} Online
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activeList.map(exec => {
                                const isSelected = selectedId === exec.id;
                                return (
                                    <div
                                        key={exec.id}
                                        onClick={() => setSelectedId(exec.id)}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            background: isSelected ? '#f5f3ff' : 'white',
                                            border: isSelected ? '2px solid #6366f1' : (exec.isOnline ? '1px solid #86efac' : '1px solid #e2e8f0'),
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
                                                background: exec.isOnline ? '#dcfce7' : '#f1f5f9',
                                                color: exec.isOnline ? '#166534' : '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: exec.isOnline ? '#22c55e' : '#94a3b8' }} />
                                                {exec.isOnline ? 'ONLINE' : 'OFFLINE'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f8fafc', fontSize: '0.72rem', color: '#64748b' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Phone size={11} /> {exec.phone}
                                            </span>
                                            <span>
                                                {exec.isOnline ? `Updated: ${exec.lastUpdate || 'Now'}` : `Seen: ${formatDateTime(exec.lastOfflineTime)}`}
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
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>Choose an executive from the list to view live location and travel routes</p>
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
                                minWidth: '320px',
                                maxWidth: '90%'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: '800' }}>{selectedData.name}</h3>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                background: selectedData.isOnline ? '#dcfce7' : '#fee2e2',
                                                color: selectedData.isOnline ? '#166534' : '#991b1b'
                                            }}>
                                                {selectedData.isOnline ? 'LIVE' : 'OFFLINE'}
                                            </span>
                                        </div>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                            Date: <b>{selectedDate.split('-').reverse().join('-')}</b> {isToday && '(Today)'}
                                        </p>
                                    </div>

                                    {loadingRoute && <Loader size={18} className="spin" color="#6366f1" />}
                                </div>

                                {/* Metrics Badges */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', fontWeight: '600' }}>Distance</span>
                                        <b style={{ fontSize: '0.95rem', color: '#4f46e5' }}>{totalDistance.toFixed(2)} km</b>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', fontWeight: '600' }}>Location Points</span>
                                        <b style={{ fontSize: '0.95rem', color: '#059669' }}>{routePoints.length}</b>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', fontWeight: '600' }}>Duration</span>
                                        <b style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                                            {startPoint && endPoint ? `${formatTimeOnly(startPoint.Timestamp).split(' ')[0]} - ${formatTimeOnly(endPoint.Timestamp).split(' ')[0]}` : 'N/A'}
                                        </b>
                                    </div>
                                </div>

                                {startPoint && (
                                    <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                            <span>Start: <b>{formatTimeOnly(startPoint.Timestamp)}</b></span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4f46e5', display: 'inline-block' }} />
                                            <span>Latest: <b>{formatTimeOnly(endPoint?.Timestamp)}</b></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Map View */}
                            {routeCoords.length === 0 ? (
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
                                        center={latestCoords || [12.2929, 76.6232]}
                                        zoom={15}
                                        style={{ height: '100%', width: '100%', zIndex: 1 }}
                                    >
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; OpenStreetMap contributors'
                                        />

                                        {/* Travel Route Polyline */}
                                        {routeCoords.length > 1 && (
                                            <>
                                                {/* Route glow/shadow */}
                                                <Polyline
                                                    positions={routeCoords}
                                                    color="#6366f1"
                                                    weight={8}
                                                    opacity={0.3}
                                                />
                                                {/* Primary solid travel route */}
                                                <Polyline
                                                    positions={routeCoords}
                                                    color="#4338ca"
                                                    weight={4}
                                                    opacity={0.9}
                                                />
                                            </>
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

                                        {/* Current / Latest Position Marker (Indigo Animated) */}
                                        {latestCoords && (
                                            <AnimatedMarker
                                                position={latestCoords}
                                                name={selectedData.name}
                                                employeeId={selectedData.employeeId}
                                                isLive={isToday && selectedData.isOnline}
                                            />
                                        )}

                                        <MapFocus position={latestCoords} path={routeCoords} />
                                    </MapContainer>

                                    {/* Bottom Right Info Card */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '20px',
                                        right: '20px',
                                        zIndex: 1000,
                                        background: 'rgba(255,255,255,0.92)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '10px 16px',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                        border: '1px solid rgba(0,0,0,0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.82rem',
                                        color: '#1e293b'
                                    }}>
                                        <Clock size={16} color="#4f46e5" />
                                        <span>
                                            {isToday ? 'Live Updates Active' : `Showing Complete Route for ${selectedDate.split('-').reverse().join('-')}`}
                                        </span>
                                    </div>
                                </>
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
