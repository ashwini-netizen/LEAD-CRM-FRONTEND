import { App as CapApp } from '@capacitor/app';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { MessageSquare, Bell, X } from 'lucide-react';
import io from 'socket.io-client';
import useLocationTracker from './utils/useLocationTracker';
import { formatNotificationMessage } from './utils/notificationSync';
import EntryScreen from './pages/EntryScreen';
import LoginScreen from './pages/LoginScreen';
import Dashboard from './pages/Dashboard';
import LeadForm from './pages/LeadForm';
import LeadList from './pages/LeadList';
import LeadDetail from './pages/LeadDetail';
import AdminPanel from './pages/AdminPanel';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import InterestedLeads from './pages/InterestedLeads';
import ManageLead from './pages/ManageLead';
import MeetingFollowupLeads from './pages/MeetingFollowupLeads';
import LeadGenFollowupLeads from './pages/LeadGenFollowupLeads';
import QuotationNeededLeads from './pages/QuotationNeededLeads';
import EmployeeOperations from './pages/EmployeeOperations';
import CallFollowupManage from './pages/CallFollowupManage';
import PaymentPendingLeads from './pages/PaymentPendingLeads';
import LiveTracking from './pages/LiveTracking';
import LeadHistory from './pages/LeadHistory';
import Notifications from './pages/Notifications';
import ClientList from './pages/ClientList';
import TimeLogs from './pages/TimeLogs';

import Chat from './pages/Chat';
import ChatBox from './components/ChatBox';
import FinalizedLeads from './pages/FinalizedLeads';
import AssignedLeads from './pages/AssignedLeads';
import CallHistory from './pages/CallHistory';
import GlobalModal from './components/GlobalModal';

// Load persisted session
const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem('crm_user')); } catch { return null; }
})();

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const isPublicPage = ['/', '/login', '/reset-password'].some(path => location.pathname === path) || location.pathname.includes('index.html');
    const [user, setUser] = useState(savedUser);
    const [selectedRole, setSelectedRole] = useState(localStorage.getItem('selected_role'));
    const [chatPartner, setChatPartner] = useState(null);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    // Call Executive Follow-up Reminder Top-Center Pop-up Banner State
    const [activeFollowupBanner, setActiveFollowupBanner] = useState(null);
    const bannerTimerRef = useRef(null);

    const triggerFollowupBanner = (data) => {
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        const cleanedMsg = formatNotificationMessage(data.message, data.type);
        setActiveFollowupBanner({
            leadId: data.leadId,
            message: cleanedMsg,
            timestamp: Date.now()
        });
        // Auto-dismiss after 6 seconds while keeping notification saved in the notification bell
        bannerTimerRef.current = setTimeout(() => {
            setActiveFollowupBanner(null);
        }, 6000);
    };

    const handleBannerClick = () => {
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        const targetLeadId = activeFollowupBanner?.leadId;
        setActiveFollowupBanner(null);
        if (targetLeadId) {
            navigate(`/leads/call-manage/${targetLeadId}`, { state: { from: '/dashboard', label: 'Follow-up Reminder' } });
        }
    };

    const handleBannerDismiss = (e) => {
        e.stopPropagation();
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        setActiveFollowupBanner(null);
        // Preserves notification unread in the notification bell
    };

    // Keep navigate in a ref so the listener doesn't need to re-register on location change
    const navigateRef = useRef(navigate);
    const locationRef = useRef(location);

    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate]);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        const handleUpdateChatBadge = (e) => {
            setUnreadChatCount(e.detail);
        };
        window.addEventListener('update_chat_badge', handleUpdateChatBadge);
        return () => window.removeEventListener('update_chat_badge', handleUpdateChatBadge);
    }, []);

    // Global listener to close select dropdowns when clicked again on mobile/tablet (Capacitor)
    useEffect(() => {
        const isNativeCapacitor = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web';
        if (!isNativeCapacitor) return;

        let lastFocusTarget = null;
        let lastFocusTime = 0;

        const handleFocus = (e) => {
            if (e.target && e.target.tagName === 'SELECT') {
                lastFocusTarget = e.target;
                lastFocusTime = Date.now();
            }
        };

        const handleBlur = (e) => {
            if (e.target && e.target.tagName === 'SELECT') {
                if (lastFocusTarget === e.target) {
                    lastFocusTarget = null;
                    lastFocusTime = 0;
                }
            }
        };

        const handleChange = (e) => {
            if (e.target && e.target.tagName === 'SELECT') {
                e.target.blur();
            }
        };

        const handleSelectToggle = (e) => {
            if (e.target && e.target.tagName === 'SELECT') {
                const now = Date.now();
                // If the select is already focused and was focused more than 300ms ago
                if (document.activeElement === e.target && lastFocusTarget === e.target && (now - lastFocusTime) > 300) {
                    e.preventDefault();
                    e.target.blur();
                }
            } else if (document.activeElement && document.activeElement.tagName === 'SELECT') {
                // If clicking outside the focused select, blur the select immediately
                document.activeElement.blur();
            }
        };

        document.addEventListener('focus', handleFocus, { capture: true });
        document.addEventListener('blur', handleBlur, { capture: true });
        document.addEventListener('change', handleChange, { capture: true });
        document.addEventListener('touchstart', handleSelectToggle, { capture: true, passive: false });
        document.addEventListener('mousedown', handleSelectToggle, { capture: true });

        return () => {
            document.removeEventListener('focus', handleFocus, { capture: true });
            document.removeEventListener('blur', handleBlur, { capture: true });
            document.removeEventListener('change', handleChange, { capture: true });
            document.removeEventListener('touchstart', handleSelectToggle, { capture: true });
            document.removeEventListener('mousedown', handleSelectToggle, { capture: true });
        };
    }, []);

    // Physical back button navigation for Android (registered once on mount)
    useEffect(() => {
        let backListener;
        const initBackButton = async () => {
            const isNativeCapacitor = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web';
            if (isNativeCapacitor) {
                try {
                    backListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
                        const path = locationRef.current.pathname;
                        if (path === '/' || path === '/dashboard') {
                            CapApp.exitApp();
                        } else {
                            // Always go back using React Router's internal history stack
                            // This prevents exiting the app and respects previous pages
                            navigateRef.current(-1);
                        }
                    });
                } catch (err) {
                    console.error('Failed to set up native back button listener:', err);
                }
            }
        };
        initBackButton();
        return () => {
            if (backListener && typeof backListener.remove === 'function') {
                backListener.remove();
            }
        };
    }, []);

    const openChat = (partner) => {
        setChatPartner(partner);
    };

    const handleSetRole = (role) => {
        setSelectedRole(role);
        if (role) {
            localStorage.setItem('selected_role', role);
        } else {
            localStorage.removeItem('selected_role');
        }
    };

    // Global Location Tracking (Only for Field Executives)
    useLocationTracker(user);

    useEffect(() => {
        const handleStorageUpdate = () => {
            const updated = JSON.parse(localStorage.getItem('crm_user'));
            if (updated) setUser(updated);
        };
        window.addEventListener('user_updated', handleStorageUpdate);
        return () => window.removeEventListener('user_updated', handleStorageUpdate);
    }, []);

    // Global auth expiration listener
    useEffect(() => {
        const handleAuthExpired = (e) => {
            setUser(null);
            setChatPartner(null);
            toast.error(e.detail?.message || 'Session expired. Please log in again.');
            const currentRole = localStorage.getItem('selected_role');
            navigate(currentRole ? '/login' : '/', { replace: true });
        };
        window.addEventListener('auth_expired', handleAuthExpired);
        return () => window.removeEventListener('auth_expired', handleAuthExpired);
    }, [navigate]);

    // Sync latest user profile on mount (updates stale localStorage sessions with Nickname)
    useEffect(() => {
        const syncProfile = async () => {
            const token = localStorage.getItem('crm_token');
            if (!token || !user) return;
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';
                const res = await fetch(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.status === 401) {
                    localStorage.removeItem('crm_token');
                    localStorage.removeItem('crm_user');
                    setUser(null);
                    toast.error('Session expired. Please log in again.');
                    const currentRole = localStorage.getItem('selected_role');
                    navigate(currentRole ? '/login' : '/', { replace: true });
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        const updatedUser = {
                            id: data.UserID,
                            name: data.EmployeeName,
                            email: data.Email,
                            role: data.Role,
                            isFirstLogin: data.IsFirstLogin,
                            IsOnline: data.IsOnline,
                            nickName: data.NickName || data.EmployeeName,
                            NickName: data.NickName || data.EmployeeName
                        };
                        localStorage.setItem('crm_user', JSON.stringify(updatedUser));
                        setUser(updatedUser);
                    }
                }
            } catch (err) {
                console.error('[APP] Profile sync failed:', err);
            }
        };
        syncProfile();
    }, []);

    // Real-time Notifications
    useEffect(() => {
        if (!user || isPublicPage) return;

        const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';
        
        // Use forceNew to prevent socket conflicts between components and ensure clean connection
        const socket = io(API_URL, { 
            forceNew: true,
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('[SOCKET] Connected to notifications channel');
            socket.emit('join', { userId: user.id || user.UserID, role: user.role });
        });

        socket.on('connect_error', (err) => {
            console.error('[SOCKET] Connection error:', err);
        });

        socket.on('notification', (data) => {
            const isCe = user?.role === 'Call Executive';
            const isFollowup = data.type === 'FollowupReminder' || (data.message && data.message.includes('Scheduled:'));

            if (isCe && isFollowup) {
                // Display as top-center pop-up banner for Call Executive
                triggerFollowupBanner(data);
            } else {
                // Provide a unique ID using just the message to aggressively deduplicate simultaneous toasts
                toast.custom(
                    (t) => (
                        <div 
                            onClick={() => {
                                toast.dismiss(t.id);
                                if (data.type === 'Chat' && data.targetId) {
                                    openChat({ UserID: data.targetId, EmployeeName: 'Chat Partner', Role: 'Member' });
                                } else if (data.leadId) {
                                    navigate(`/leads/${data.leadId}`);
                                } else if (data.type === 'Payment') {
                                    navigate('/leads/payment-pending');
                                }
                            }}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: '#ffffff',
                                color: '#1e293b',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '0.85rem',
                                padding: '16px 20px',
                                border: '1px solid #e2e8f0',
                                fontWeight: '600',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                borderRadius: '16px',
                                borderLeft: '5px solid #6366f1',
                                maxWidth: '400px',
                                width: '100%',
                                transition: 'all 0.2s ease-in-out',
                                opacity: t.visible ? 1 : 0,
                                transform: t.visible ? 'scale(1)' : 'scale(0.9)'
                            }}
                        >
                            <span style={{ fontSize: '1.4rem' }}>
                                {data.type === 'Chat' ? '💬' : '🔔'}
                            </span>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.88rem', color: '#1e293b' }}>
                                    {data.type === 'Chat' ? 'New Internal Chat' : 'New Notification'}
                                </p>
                                <p style={{ margin: '4px 0 0 0', fontWeight: '500', color: '#64748b', fontSize: '0.82rem', lineHeight: '1.4' }}>
                                    {formatNotificationMessage(data.message, data.type)}
                                </p>
                            </div>
                        </div>
                    ),
                    {
                        id: data.message,
                        duration: 6000,
                        position: 'bottom-right'
                    }
                );
            }
            
            // Dispatch event for real-time list updates
            window.dispatchEvent(new CustomEvent('refresh_notifications'));
        });

        return () => {
            socket.off('notification');
            socket.disconnect();
        };
    }, [user?.id, user?.UserID, user?.role, isPublicPage]);

    const handleLogin = (userData) => {
        setUser(userData);
        setChatPartner(null);
    };

    const handleLevelUp = (updatedUser) => {
        setUser(updatedUser);
    };

    const handleLogout = () => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        setUser(null);
        setSelectedRole(null);
        localStorage.removeItem('selected_role');
        setChatPartner(null);
    };

    const ProtectedRoute = ({ element }) => {
        const token = localStorage.getItem('crm_token');
        const currentUser = user || (() => {
            try { return JSON.parse(localStorage.getItem('crm_user')); } catch { return null; }
        })();

        if (!currentUser || !token) {
            const currentRole = localStorage.getItem('selected_role');
            return <Navigate to={currentRole ? "/login" : "/"} replace />;
        }
        // Enforce password reset on first login for non-admins
        if (currentUser.role !== 'Admin' && currentUser.isFirstLogin) {
            return <Navigate to="/reset-password" replace />;
        }
        return element;
    };

    return (
        <>
            <style>{`
                @keyframes ceBannerSlideDown {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -24px) scale(0.96);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(-50%, 0) scale(1);
                    }
                }
            `}</style>

            {/* Top-Center Mobile-Style Pop-up Banner for Call Executive Follow-up Reminders */}
            {activeFollowupBanner && user?.role === 'Call Executive' && (
                <div
                    role="alert"
                    aria-live="assertive"
                    onClick={handleBannerClick}
                    style={{
                        position: 'fixed',
                        top: '16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 999999,
                        width: 'calc(100vw - 28px)',
                        maxWidth: '440px',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        padding: '10px 14px',
                        borderRadius: '16px',
                        border: '1px solid #cbd5e1',
                        borderLeft: '4px solid #4f46e5',
                        boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.2), 0 4px 12px rgba(0, 0, 0, 0.08)',
                        animation: 'ceBannerSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        pointerEvents: 'auto',
                        transition: 'transform 0.15s ease'
                    }}
                >
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)'
                    }}>
                        <Bell size={18} strokeWidth={2.2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                            display: 'block',
                            fontSize: '0.68rem',
                            fontWeight: '800',
                            color: '#4f46e5',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '2px'
                        }}>
                            Follow-up Reminder
                        </span>
                        <p style={{
                            margin: 0,
                            fontWeight: '700',
                            fontSize: '0.86rem',
                            color: '#0f172a',
                            lineHeight: '1.35',
                            wordBreak: 'break-word'
                        }}>
                            {activeFollowupBanner.message}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleBannerDismiss}
                        title="Dismiss banner"
                        style={{
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            padding: 0,
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                    >
                        <X size={14} strokeWidth={2.5} />
                    </button>
                </div>
            )}

            <Toaster position="top-right" />
            <GlobalModal />
            <Routes>
                <Route path="/" element={<EntryScreen onSelectRole={handleSetRole} />} />
                <Route path="/login" element={<LoginScreen role={selectedRole} onLogin={handleLogin} />} />
                <Route path="/reset-password" element={user && user.isFirstLogin ? <ResetPassword user={user} onComplete={handleLevelUp} /> : <Navigate to="/dashboard" />} />

                <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard user={user} onLogout={handleLogout} />} />} />
                <Route path="/leads/new" element={<ProtectedRoute element={<LeadForm user={user} />} />} />
                <Route path="/leads" element={<ProtectedRoute element={<LeadList user={user} />} />} />
                <Route path="/leads/my-created" element={<ProtectedRoute element={<LeadList user={user} isMyCreated={true} />} />} />
                <Route path="/leads/:id" element={<ProtectedRoute element={<LeadDetail user={user} />} />} />
                <Route path="/profile" element={<ProtectedRoute element={<Profile user={user} />} />} />
                <Route path="/admin" element={<ProtectedRoute element={user?.role === 'Admin' ? <AdminPanel user={user} /> : <Navigate to="/dashboard" />} />} />
                <Route path="/leads/interested" element={<ProtectedRoute element={<InterestedLeads user={user} />} />} />
                <Route path="/leads/lead-gen-followup" element={<ProtectedRoute element={<LeadGenFollowupLeads user={user} />} />} />
                <Route path="/leads/meeting-followup" element={<ProtectedRoute element={<MeetingFollowupLeads user={user} />} />} />
                <Route path="/leads/quotation-needed" element={<ProtectedRoute element={<QuotationNeededLeads user={user} />} />} />
                <Route path="/leads/assigned" element={<ProtectedRoute element={<AssignedLeads user={user} />} />} />
                <Route path="/admin/operations/:id" element={<ProtectedRoute element={user?.role === 'Admin' ? <EmployeeOperations user={user} /> : <Navigate to="/dashboard" />} />} />
                <Route path="/leads/payment-pending" element={<ProtectedRoute element={<PaymentPendingLeads user={user} />} />} />
                <Route path="/leads/manage/:id" element={<ProtectedRoute element={<ManageLead user={user} />} />} />
                <Route path="/leads/call-manage/:id" element={<ProtectedRoute element={<CallFollowupManage user={user} />} />} />
                <Route path="/tracking" element={<ProtectedRoute element={(user?.role === 'Admin' || user?.role === 'Team Lead') ? <LiveTracking user={user} /> : <Navigate to="/dashboard" />} />} />
                <Route path="/admin/history" element={<ProtectedRoute element={user?.role === 'Admin' ? <LeadHistory user={user} /> : <Navigate to="/dashboard" />} />} />
                <Route path="/admin/clients" element={<ProtectedRoute element={(user?.role === 'Admin' || user?.role === 'Team Lead') ? <ClientList user={user} /> : <Navigate to="/dashboard" />} />} />

                <Route path="/admin/time-logs/:id" element={<ProtectedRoute element={(user?.role === 'Admin' || user?.role === 'Team Lead') ? <TimeLogs user={user} /> : <Navigate to="/dashboard" />} />} />
                <Route path="/chat" element={<ProtectedRoute element={<Chat user={user} />} />} />
                <Route path="/leads/finalized" element={<ProtectedRoute element={<FinalizedLeads user={user} />} />} />
                <Route path="/leads/call-history" element={<ProtectedRoute element={<CallHistory user={user} />} />} />
                <Route path="/notifications" element={<ProtectedRoute element={<Notifications user={user} />} />} />
            </Routes>
            {user && chatPartner && (
                <ChatBox
                    user={user}
                    partner={chatPartner}
                    onClose={() => setChatPartner(null)}
                />
            )}
            {/* Global Chat Listener */}
            <ChatTrigger onOpenChat={openChat} />

            {user && !isPublicPage && location.pathname !== '/chat' && !chatPartner && (
                <button
                    onClick={() => navigate('/chat')}
                    className="floating-chat-btn"
                    title="Open Internal Chat"
                    style={{ position: 'fixed' /* just to ensure relative positioning context for absolute span if not in CSS */ }}
                >
                    <MessageSquare size={26} />
                    {unreadChatCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid white',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }}>
                            {unreadChatCount}
                        </span>
                    )}
                </button>
            )}

        </>
    );
}

// Small utility to listen for chat triggers
const ChatTrigger = ({ onOpenChat }) => {
    useEffect(() => {
        const handleOpenChat = (e) => onOpenChat(e.detail);
        window.addEventListener('open_chat', handleOpenChat);
        return () => window.removeEventListener('open_chat', handleOpenChat);
    }, [onOpenChat]);
    return null;
};

export default App;
