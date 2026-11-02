import { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const useLocationTracker = (user) => {
    const socketRef = useRef(null);
    const watchIdRef = useRef(null);
    const lastSendRef = useRef(0);

    useEffect(() => {
        if (!user || user.role !== 'Field Executive' || !user.IsOnline) return;

        // 1. Initialize Socket
        socketRef.current = io(API_URL, {
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('[TRACKER] Connected to server');
            socketRef.current.emit('join', { userId: user.id || user.UserID, role: user.role });
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('[TRACKER] Socket error:', err);
        });

        // Mock simulation fallback
        let mockInterval;
        const startMockTracking = () => {
            console.log('[TRACKER] Starting mock location tracking...');
            let currentLat = 12.9716; // Bangalore
            let currentLng = 77.5946;
            
            mockInterval = setInterval(() => {
                // Simulate random movement
                currentLat += (Math.random() - 0.5) * 0.001;
                currentLng += (Math.random() - 0.5) * 0.001;
                
                socketRef.current.emit('updateLocation', {
                    userId: user.id || user.UserID,
                    lat: currentLat,
                    lng: currentLng
                });
                console.log(`[TRACKER-MOCK] Sent location: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`);
            }, 3000);
        };

        // 2. Start Watching Position
        if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const now = Date.now();

                    // Throttle: Send every 3 seconds
                    if (now - lastSendRef.current > 3000) {
                        lastSendRef.current = now;
                        socketRef.current.emit('updateLocation', {
                            userId: user.id || user.UserID,
                            lat: latitude,
                            lng: longitude
                        });
                        console.log(`[TRACKER] Sent location: ${latitude}, ${longitude}`);
                    }
                },
                (error) => {
                    console.error('[TRACKER] Geolocation error:', error.message);
                    startMockTracking(); // Fallback to mock if user denies or it fails
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        } else {
            console.warn('[TRACKER] Geolocation not supported');
            startMockTracking(); // Fallback
        }

        return () => {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
            if (mockInterval) clearInterval(mockInterval);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [user?.id, user?.UserID, user?.role, user?.IsOnline]);

    return null;
};

export default useLocationTracker;
