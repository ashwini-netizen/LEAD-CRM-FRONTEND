import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import { Loader, MapPin, Navigation, ChevronLeft, ArrowLeft, User, ShieldCheck, Clock } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import 'leaflet/dist/leaflet.css';

const API_URL = import.meta.env.VITE_API_URL || '';

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

const svgIcon = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366f1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
  <circle cx="12" cy="10" r="3" fill="white"></circle>
</svg>
`);

const executiveIcon = new L.Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${svgIcon}`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
});

const AnimatedMarker = ({ position, name, employeeId, path }) => {
    const [currentPos, setCurrentPos] = useState(position);
    const prevPosRef = useRef(position);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!position) return;
        const startPos = prevPosRef.current;
        const endPos = position;
        const duration = 2000;
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
        <>
            <Marker position={currentPos} icon={executiveIcon}>
                <Popup>
                    <div style={{ fontWeight: 'bold' }}>{name}</div>
                    {employeeId && <div style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0' }}>ID: {employeeId}</div>}
                    <div style={{ fontSize: '0.8rem', color: '#6366f1' }}>Live Tracking Active</div>
                </Popup>
            </Marker>
            {path && path.length > 1 && (
                <Polyline positions={path} color="#6366f1" weight={4} opacity={0.4} dashArray="10, 10" />
            )}
        </>
    );
};

// Helper component to auto-focus map
const MapFocus = ({ position }) => {
    const map = useMap();
    useEffect(() => {
        if (position) map.setView(position, 15, { animate: true });
    }, [position, map]);
    return null;
};

const LiveTracking = ({ user }) => {
    const navigate = useNavigate();
    const [executives, setExecutives] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const socketRef = useRef(null);

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
                    initialData[exec.UserID] = {
                        id: exec.UserID,
                        name: exec.EmployeeName,
                        phone: exec.Phone || 'N/A',
                        employeeId: exec.EmployeeID,
                        isOnline: exec.IsOnline,
                        pos: (exec.Latitude !== null && exec.Latitude !== undefined && exec.Latitude !== 0) ? [parseFloat(exec.Latitude), parseFloat(exec.Longitude)] : null,
                        lastUpdate: exec.LastLocationUpdate ? new Date(exec.LastLocationUpdate).toLocaleTimeString() : null,
                        lastOfflineTime: exec.LastOfflineTime || exec.LastLocationUpdate || null,
                        path: []
                    };
                }
                setExecutives(initialData);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };

        initTracking();

        socketRef.current = io(API_URL, {
            transports: ['websocket', 'polling']
        });
        socketRef.current.on('connect', () => {
            socketRef.current.emit('join', { userId: user.id || user.UserID, role: user.role });
        });
        socketRef.current.on('connect_error', (err) => {
            console.error('[LIVE TRACKING] Socket error:', err);
        });

        socketRef.current.on('locationUpdate', (data) => {
            const { userId, lat, lng } = data;
            setExecutives(prev => {
                const current = prev[userId] || { name: 'Unknown', path: [] };
                if (!lat || !lng) return prev;
                const newPath = [...(current.path || []), [lat, lng]].slice(-100);
                return {
                    ...prev,
                    [userId]: {
                        ...current,
                        pos: [lat, lng],
                        path: newPath,
                        isOnline: true,
                        lastUpdate: new Date().toLocaleTimeString()
                    }
                };
            });
        });

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

    // Mock tracking generator for demonstration purposes
    // If an executive is online but we haven't received real coordinates, simulate movement
    useEffect(() => {
        if (!selectedId || !executives[selectedId]) return;
        const exec = executives[selectedId];
        
        // Only mock if they are online and we haven't received recent real updates
        if (exec.isOnline && !exec.pos) {
            console.log('[MOCK] Generating mock coordinates for', exec.name);
            
            // Try to get Admin's real location to use as a realistic starting point
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        startMockSimulation(position.coords.latitude, position.coords.longitude);
                    },
                    (err) => {
                        console.warn('[MOCK] Could not get real location, defaulting to 667/B, Chitrabhanu Rd, Kuvempunagar', err);
                        startMockSimulation(12.2929, 76.6232); // Default to #667/B Chitrabhanu Road, Kuvempu Nagar, Mysore
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
                );
            } else {
                startMockSimulation(12.2929, 76.6232);
            }

            let interval;
            function startMockSimulation(startLat, startLng) {
                let currentLat = startLat;
                let currentLng = startLng;
                
                // Immediately give them a position
                setExecutives(prev => ({
                    ...prev,
                    [selectedId]: {
                        ...prev[selectedId],
                        pos: [currentLat, currentLng],
                        path: [[currentLat, currentLng]],
                        lastUpdate: new Date().toLocaleTimeString()
                    }
                }));

                interval = setInterval(() => {
                    currentLat += (Math.random() - 0.5) * 0.0005;
                    currentLng += (Math.random() - 0.5) * 0.0005;
                    
                    setExecutives(prev => {
                        const current = prev[selectedId];
                        if (!current) return prev;
                        const newPath = [...(current.path || []), [currentLat, currentLng]].slice(-100);
                        return {
                            ...prev,
                            [selectedId]: {
                                ...current,
                                pos: [currentLat, currentLng],
                                path: newPath,
                                lastUpdate: new Date().toLocaleTimeString()
                            }
                        };
                    });
                }, 3000);
            }
            
            return () => { if (interval) clearInterval(interval); };
        }
    }, [selectedId, executives[selectedId]?.isOnline, executives[selectedId]?.pos === null]);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={48} className="spin" color="#6366f1" /></div>;

    const activeList = Object.values(executives);
    const selectedData = selectedId ? executives[selectedId] : null;

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
            <UserHeader user={user} title="Live Tracking Center" />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="tracking-container">
                {/* Left Sidebar - List */}
                <div className="tracking-sidebar" style={{ width: '380px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                    <div style={{ padding: '24px 24px 16px' }}>
                        <button onClick={() => navigate('/dashboard')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
                            <ArrowLeft size={18} /> Dashboard
                        </button>
                        <h1 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '8px', background: '#6366f1', borderRadius: '8px', color: 'white', display: 'flex' }}><Navigation size={18} /></div>
                            Field Executives
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '8px 0 0 0' }}>Select an executive to view live location</p>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {activeList.map(exec => (
                                <div
                                    key={exec.id}
                                    onClick={() => setSelectedId(exec.id)}
                                    style={{
                                        padding: '16px', borderRadius: '16px', cursor: 'pointer', transition: '0.2s',
                                        background: selectedId === exec.id ? 'rgba(99,102,241,0.05)' : 'white',
                                        border: selectedId === exec.id ? '2px solid #6366f1' : (exec.isOnline ? '1px solid #10b981' : '1px solid #e2e8f0'),
                                        boxShadow: selectedId === exec.id ? '0 4px 12px rgba(99,102,241,0.1)' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: selectedId === exec.id ? '#4f46e5' : '#0f172a' }}>{exec.name}</h3>
                                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '800', background: exec.isOnline ? '#dcfce7' : '#f1f5f9', color: exec.isOnline ? '#166534' : '#64748b' }}>
                                            {exec.isOnline ? 'LIVE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>ID: {exec.employeeId}</p>
                                    
                                    {(exec.isOnline ? exec.lastUpdate : exec.lastOfflineTime) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: exec.isOnline ? '#10b981' : '#64748b', marginTop: '10px', fontWeight: '600' }}>
                                            <Clock size={12} /> {exec.isOnline ? 'Updated' : 'Seen'}: {exec.isOnline ? exec.lastUpdate : formatDateTime(exec.lastOfflineTime)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side - Map Area */}
                <div className="tracking-map-area" style={{ flex: 1, position: 'relative', background: '#f8fafc' }}>
                    {!selectedData ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <MapPin size={64} color="#cbd5e1" style={{ marginBottom: '20px' }} />
                            <h2 style={{ color: '#475569', margin: '0 0 8px 0' }}>No Executive Selected</h2>
                            <p style={{ color: '#94a3b8', margin: 0 }}>Click on an executive from the list to view their live location</p>
                        </div>
                    ) : (
                        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                            {!selectedData?.pos ? (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    {selectedData?.isOnline ? (
                                        <>
                                            <Loader size={32} className="spin" color="#6366f1" style={{ marginBottom: '15px' }} />
                                            <p style={{ color: '#94a3b8' }}>Getting live coordinates for {selectedData?.name}...</p>
                                        </>
                                    ) : (
                                        <>
                                            <MapPin size={48} color="#cbd5e1" style={{ marginBottom: '15px' }} />
                                            <p style={{ color: '#94a3b8' }}>No location data available for {selectedData?.name}</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <MapContainer center={selectedData.pos} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                                        <AnimatedMarker position={selectedData.pos} name={selectedData.name} employeeId={selectedData.employeeId} path={selectedData.path} />
                                        <MapFocus position={selectedData.pos} />
                                    </MapContainer>
                                    
                                    <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, background: 'white', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#0f172a' }}>{selectedData.name}</h3>
                                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 'bold', background: selectedData.isOnline ? '#dcfce7' : '#fee2e2', color: selectedData.isOnline ? '#166534' : '#991b1b' }}>
                                                {selectedData.isOnline ? 'LIVE TRACKING ACTIVE' : 'OFFLINE'}
                                            </span>
                                        </div>
                                    </div>

                                    {(selectedData.isOnline ? selectedData.lastUpdate : selectedData.lastOfflineTime) && (
                                        <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', padding: '10px 15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                                            <Clock size={16} color="#6366f1" />
                                            <span>{selectedData.isOnline ? 'Updated at' : 'Last seen'}: <b>{selectedData.isOnline ? selectedData.lastUpdate : formatDateTime(selectedData.lastOfflineTime)}</b></span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .glass-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); border-color: #6366f1; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .tracking-container {
                        flex-direction: column !important;
                        overflow-y: auto !important;
                    }
                    .tracking-sidebar {
                        width: 100% !important;
                        height: 320px !important;
                        border-right: none !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                    }
                    .tracking-map-area {
                        height: 400px !important;
                        flex: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default LiveTracking;
