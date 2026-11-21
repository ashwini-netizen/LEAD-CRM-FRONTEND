import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

const useLocationTracker = (user) => {
    const socketRef = useRef(null);
    const watchIdRef = useRef(null);
    const lastSendRef = useRef(0);
    const [trackingActive, setTrackingActive] = useState(false);

    const isFieldExecutive = (user?.role === 'Field Executive' || user?.Role === 'Field Executive');
    const isOnline = Boolean(user?.IsOnline);

    useEffect(() => {
        if (!user || !isFieldExecutive || !isOnline) {
            setTrackingActive(false);
            return;
        }

        const userId = user.id || user.UserID;
        const role = user.role || user.Role;

        // 1. Initialize Socket
        socketRef.current = io(API_URL, {
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('[TRACKER] Connected to tracking server');
            socketRef.current.emit('join', { userId, role });
            setTrackingActive(true);
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('[TRACKER] Socket connection error:', err);
        });

        // 2. Start Watching Position
        if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const now = Date.now();

                    // Throttle: Send every 3 seconds to avoid overloading
                    if (now - lastSendRef.current > 3000) {
                        lastSendRef.current = now;
                        if (socketRef.current && socketRef.current.connected) {
                            socketRef.current.emit('updateLocation', {
                                userId,
                                lat: latitude,
                                lng: longitude
                            });
                        }
                        setTrackingActive(true);
                    }
                },
                (error) => {
                    console.warn('[TRACKER] Geolocation error or permission denied:', error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 3000
                }
            );
        } else {
            console.warn('[TRACKER] Geolocation is not supported by this browser/device.');
        }

        return () => {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setTrackingActive(false);
        };
    }, [user?.id, user?.UserID, user?.role, user?.Role, user?.IsOnline, isFieldExecutive, isOnline]);

    // Transparent notice display for Field Executives when tracking is active
    useEffect(() => {
        const BANNER_ID = 'fe-tracking-notice-banner';
        let banner = document.getElementById(BANNER_ID);

        if (isFieldExecutive && isOnline && trackingActive) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = BANNER_ID;
                banner.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9999;background:rgba(15,23,42,0.92);color:white;padding:10px 16px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;gap:10px;font-size:0.78rem;font-weight:600;font-family:sans-serif;pointer-events:none;transition:opacity 0.3s ease;';
                banner.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;display:inline-block;"></span><span>Field Visit Tracking Active &bull; Sharing live location with TL &amp; Admin</span>';
                document.body.appendChild(banner);
            }
        } else {
            if (banner) banner.remove();
        }

        return () => {
            const b = document.getElementById(BANNER_ID);
            if (b) b.remove();
        };
    }, [isFieldExecutive, isOnline, trackingActive]);

    return null;
};

export default useLocationTracker;
