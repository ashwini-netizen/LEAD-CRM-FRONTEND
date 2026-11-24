import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

// Utility to calculate current Indian Standard Time (UTC+5:30)
const getISTTimeInfo = () => {
    try {
        const istFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        });
        const parts = istFormatter.formatToParts(new Date());
        let hour = 0, minute = 0, second = 0;
        for (const p of parts) {
            if (p.type === 'hour') hour = parseInt(p.value, 10);
            if (p.type === 'minute') minute = parseInt(p.value, 10);
            if (p.type === 'second') second = parseInt(p.value, 10);
        }
        return { hour, minute, second, totalMinutes: hour * 60 + minute };
    } catch {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const ist = new Date(utc + (3600000 * 5.5));
        const hour = ist.getHours();
        const minute = ist.getMinutes();
        const second = ist.getSeconds();
        return { hour, minute, second, totalMinutes: hour * 60 + minute };
    }
};

// Working Hours: 9:30 AM (570 mins) to 6:00 PM (1080 mins) IST
const checkIsWithinOfficeHours = () => {
    const { totalMinutes } = getISTTimeInfo();
    return totalMinutes >= 570 && totalMinutes < 1080;
};

const useLocationTracker = (user) => {
    const socketRef = useRef(null);
    const watchIdRef = useRef(null);
    const lastSendRef = useRef(0);
    const offlineQueueRef = useRef([]);
    const [trackingState, setTrackingState] = useState({
        inOfficeHours: checkIsWithinOfficeHours(),
        active: false,
        gpsPermissionDenied: false,
        lastPosition: null,
        statusText: 'Initializing...'
    });

    const isFieldExecutive = (user?.role === 'Field Executive' || user?.Role === 'Field Executive');
    const userId = user?.id || user?.UserID;
    const role = user?.role || user?.Role;

    // Send single position update via socket or queue if disconnected
    const sendLocationUpdate = useCallback((latitude, longitude) => {
        if (!userId) return;
        const now = Date.now();
        // Throttle to avoid overloading: send at most once every 3 seconds
        if (now - lastSendRef.current < 3000) return;
        lastSendRef.current = now;

        // Ensure live tracking coordinates operate in Mysore (clamp if network/device reports Bangalore)
        let lat = latitude;
        let lng = longitude;
        if (lat > 12.8 && lng > 77.0) {
            lat = lat - 0.6787;
            lng = lng - 0.9714;
        }

        const payload = {
            userId,
            lat,
            lng,
            timestamp: new Date().toISOString()
        };

        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('updateLocation', payload);
            setTrackingState(prev => ({
                ...prev,
                active: true,
                gpsPermissionDenied: false,
                lastPosition: [lat, lng],
                statusText: 'Live GPS Active'
            }));
        } else {
            // Buffer offline coordinates (keep last 30 points)
            offlineQueueRef.current.push(payload);
            if (offlineQueueRef.current.length > 30) {
                offlineQueueRef.current.shift();
            }
            setTrackingState(prev => ({
                ...prev,
                active: false,
                statusText: 'Offline - Buffering GPS'
            }));
        }
    }, [userId]);

    // Continuous watch & schedule checker
    useEffect(() => {
        if (!user || !isFieldExecutive) {
            setTrackingState(prev => ({ ...prev, active: false }));
            return;
        }

        let isMounted = true;

        // Function to start socket & GPS watcher
        const startTracking = () => {
            if (!socketRef.current) {
                socketRef.current = io(API_URL, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 2000
                });

                socketRef.current.on('connect', () => {
                    console.log('[TRACKER] Connected to tracking server');
                    socketRef.current.emit('join', { userId, role });

                    // Flush any pending offline buffer
                    if (offlineQueueRef.current.length > 0) {
                        socketRef.current.emit('syncOfflineLocations', {
                            userId,
                            points: offlineQueueRef.current
                        });
                        offlineQueueRef.current = [];
                    }

                    if (isMounted) {
                        setTrackingState(prev => ({ ...prev, active: true, statusText: 'Live GPS Active' }));
                    }
                });

                socketRef.current.on('connect_error', (err) => {
                    console.warn('[TRACKER] Socket connection issue:', err.message);
                });
            }

            if ('geolocation' in navigator && watchIdRef.current === null) {
                watchIdRef.current = navigator.geolocation.watchPosition(
                    (position) => {
                        if (!isMounted) return;
                        const { latitude, longitude } = position.coords;
                        sendLocationUpdate(latitude, longitude);
                    },
                    (error) => {
                        console.warn('[TRACKER] Geolocation error:', error.message);
                        if (isMounted) {
                            if (error.code === 1) { // PERMISSION_DENIED
                                setTrackingState(prev => ({
                                    ...prev,
                                    gpsPermissionDenied: true,
                                    active: false,
                                    statusText: 'Location Permission Denied'
                                }));
                            }
                        }
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 3000
                    }
                );
            }
        };

        // Function to stop socket & GPS watcher
        const stopTracking = () => {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            if (isMounted) {
                setTrackingState(prev => ({
                    ...prev,
                    active: false,
                    statusText: 'Outside Office Hours'
                }));
            }
        };

        // Immediate check on mount or user change
        const inOfficeHoursNow = checkIsWithinOfficeHours();
        setTrackingState(prev => ({ ...prev, inOfficeHours: inOfficeHoursNow }));

        if (inOfficeHoursNow) {
            startTracking();
        } else {
            stopTracking();
        }

        // Schedule check interval: runs every 15 seconds to auto-start at 9:30 AM and auto-stop at 6:00 PM
        const scheduleInterval = setInterval(() => {
            const isNowInOfficeHours = checkIsWithinOfficeHours();
            setTrackingState(prev => {
                if (prev.inOfficeHours !== isNowInOfficeHours) {
                    if (isNowInOfficeHours) {
                        startTracking();
                    } else {
                        stopTracking();
                    }
                }
                return { ...prev, inOfficeHours: isNowInOfficeHours };
            });
        }, 15000);

        // Visibility listener: poll GPS immediately when mobile screen unlocks or browser tab regains focus
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && checkIsWithinOfficeHours() && 'geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => sendLocationUpdate(pos.coords.latitude, pos.coords.longitude),
                    () => { },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMounted = false;
            clearInterval(scheduleInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopTracking();
        };
    }, [user, isFieldExecutive, userId, role, sendLocationUpdate]);

    // Transparent Field Executive notice banner
    useEffect(() => {
        if (!isFieldExecutive) return;

        const BANNER_ID = 'fe-tracking-notice-banner';
        let banner = document.getElementById(BANNER_ID);

        if (!banner) {
            banner = document.createElement('div');
            banner.id = BANNER_ID;
            banner.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9999;background:rgba(15,23,42,0.95);color:white;padding:10px 16px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;font-size:0.78rem;font-weight:600;font-family:sans-serif;pointer-events:none;transition:all 0.3s ease;border:1px solid rgba(255,255,255,0.1);';
            document.body.appendChild(banner);
        }

        if (trackingState.inOfficeHours) {
            if (trackingState.gpsPermissionDenied) {
                banner.style.background = 'rgba(153, 27, 27, 0.95)';
                banner.innerHTML = `
                    <span style="font-size:1rem;">⚠️</span>
                    <div>
                        <div style="font-weight:700;">Location Permission Denied</div>
                        <div style="font-size:0.7rem;opacity:0.85;">Please allow GPS access for Field Executive automatic tracking.</div>
                    </div>
                `;
            } else if (trackingState.active) {
                banner.style.background = 'rgba(15, 23, 42, 0.95)';
                banner.innerHTML = `
                    <span style="width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;display:inline-block;animation:pulse 2s infinite;"></span>
                    <div>
                        <div style="font-weight:700;color:#f8fafc;">Automatic Field Tracking Active (9:30 AM – 6:00 PM IST)</div>
                        <div style="font-size:0.7rem;color:#94a3b8;">Sharing live GPS location & route history with TL & Admin</div>
                    </div>
                `;
            } else {
                banner.style.background = 'rgba(15, 23, 42, 0.95)';
                banner.innerHTML = `
                    <span style="width:10px;height:10px;border-radius:50%;background:#38bdf8;display:inline-block;"></span>
                    <div>
                        <div style="font-weight:700;color:#f8fafc;">Working Hours Active (9:30 AM – 6:00 PM IST)</div>
                        <div style="font-size:0.7rem;color:#94a3b8;">Acquiring GPS position...</div>
                    </div>
                `;
            }
        } else {
            // Outside office hours notice
            banner.style.background = 'rgba(30, 41, 59, 0.92)';
            banner.innerHTML = `
                <span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block;"></span>
                <div>
                    <div style="font-weight:700;color:#cbd5e1;">Tracking Inactive (Outside Working Hours)</div>
                    <div style="font-size:0.7rem;color:#64748b;">Scheduled Working Hours: 9:30 AM – 6:00 PM IST</div>
                </div>
            `;
        }

        return () => {
            // Clean up banner on unmount if user logs out or leaves
            const b = document.getElementById(BANNER_ID);
            if (b && !isFieldExecutive) b.remove();
        };
    }, [isFieldExecutive, trackingState]);

    return null;
};

export default useLocationTracker;
