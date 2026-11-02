import { Bell, BellOff, Check, ChevronRight, LogOut, User, Settings, Trash2, Loader, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import logo from '../assets/logo.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const UserHeader = ({ user, title, onLogout, onToggleSidebar }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const res = await fetch(`${API_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                const data = await res.json();
                
                // Separate System vs Chat
                const systemNotifs = data.filter(n => n.Type !== 'Chat');
                const chatNotifs = data.filter(n => n.Type === 'Chat');
                
                const unreadSystem = systemNotifs.filter(n => !n.IsRead);
                const unreadChats = chatNotifs.filter(n => !n.IsRead);

                const sortedSystem = Array.isArray(systemNotifs) ? systemNotifs.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)) : [];
                setNotifications(sortedSystem);
                setUnreadCount(unreadSystem.length);
                
                // Tell App.jsx about unread chats
                window.dispatchEvent(new CustomEvent('update_chat_badge', { detail: unreadChats.length }));
            }
        } catch (err) {
            // console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();
            
            const handleRefresh = () => fetchNotifications();
            window.addEventListener('refresh_notifications', handleRefresh);
            
            return () => {
                window.removeEventListener('refresh_notifications', handleRefresh);
            };
        }
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id) => {
        try {
            const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n.NotificationID === id ? { ...n, IsRead: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const deleteNotification = async (id) => {
        try {
            const res = await fetch(`${API_URL}/api/notifications/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                const deletedNotif = notifications.find(n => n.NotificationID === id);
                if (deletedNotif && !deletedNotif.IsRead) {
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
                setNotifications(prev => prev.filter(n => n.NotificationID !== id));
            }
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    return (
        <header className="main-user-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {onToggleSidebar && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSidebar();
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            borderRadius: '8px',
                            color: '#475569'
                        }}
                    >
                        <Menu size={24} />
                    </button>
                )}
                <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}
                    onClick={() => navigate('/dashboard')}
                    title="Go to Dashboard"
                >
                    <img src={logo} alt="Navabharath Logo" />
                    <h3 className="header-title" style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>{title || 'Overview'}</h3>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

                {user && (
                    <div style={{ position: 'relative' }} ref={dropdownRef}>
                        <div
                            style={{ position: 'relative', cursor: 'pointer', padding: '8px', borderRadius: '10px', transition: '0.2s', background: 'transparent' }}
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <Bell size={22} color={unreadCount > 0 ? "#6366f1" : "#94a3b8"} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: '#ef4444',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid white',
                                    fontWeight: 'bold'
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </div>

                        {showNotifications && (
                            <div className="notification-dropdown" style={{
                                position: 'absolute',
                                top: '45px',
                                right: '0',
                                width: '360px',
                                background: 'rgba(255, 255, 255, 0.98)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '16px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                padding: '16px 0',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                animation: 'slideIn 0.2s ease-out'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e293b' }}>Notifications</span>
                                    {unreadCount > 0 && (
                                        <button 
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    const res = await fetch(`${API_URL}/api/notifications/read-all`, {
                                                        method: 'PUT',
                                                        headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                                                    });
                                                    if (res.ok) {
                                                        setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
                                                        setUnreadCount(0);
                                                    }
                                                } catch (err) {}
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Check size={14} /> Mark all read
                                        </button>
                                    )}
                                </div>
                                
                                <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '0 8px' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            No notifications
                                        </div>
                                    ) : (
                                        notifications.slice(0, 5).map(n => (
                                            <div
                                                key={n.NotificationID}
                                                onClick={() => {
                                                    setShowNotifications(false);
                                                    markAsRead(n.NotificationID);
                                                    if (n.Type === 'Chat' && n.TargetID) {
                                                        window.dispatchEvent(new CustomEvent('open_chat', { 
                                                            detail: { UserID: n.TargetID, EmployeeName: 'Chat Partner', Role: 'Member' } 
                                                        }));
                                                    } else if (n.LeadID) {
                                                        navigate(`/leads/${n.LeadID}`);
                                                    } else if (n.Type === 'Payment') {
                                                        navigate('/leads/payment-pending');
                                                    } else {
                                                        navigate('/notifications');
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    gap: '12px',
                                                    padding: '10px 12px',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    transition: '0.2s',
                                                    background: n.IsRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                                                    marginBottom: '4px'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(241, 245, 249, 0.8)'}
                                                onMouseLeave={e => e.currentTarget.style.background = n.IsRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)'}
                                            >
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: n.Type === 'Chat' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                    color: n.Type === 'Chat' ? '#6366f1' : '#f59e0b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <Bell size={15} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        fontSize: '0.82rem',
                                                        margin: 0,
                                                        color: '#334155',
                                                        fontWeight: n.IsRead ? '500' : '600',
                                                        lineHeight: '1.3',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'normal',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical'
                                                    }}>
                                                        {n.Message}
                                                    </p>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                                        {new Date(n.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {!n.IsRead && (
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', alignSelf: 'center', flexShrink: 0 }} />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                
                                <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 16px 0 16px', display: 'flex', justifyContent: 'center' }}>
                                    <button 
                                        onClick={() => {
                                            setShowNotifications(false);
                                            navigate('/notifications');
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        View all notifications <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        transition: '0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate('/profile')}
                >
                    <div className="header-user-info" style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e293b', margin: 0, lineHeight: 1 }}>{user.NickName || user.nickName || user.name || user.EmployeeName}</p>
                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', margin: '4px 0 0 0', letterSpacing: '0.5px' }}>{user.role}</p>
                    </div>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
                        border: '2px solid white'
                    }}>
                        <User size={20} />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @media (max-width: 1024px) {
                    .header-user-info {
                        display: none !important;
                    }
                    .main-user-header {
                        padding: 0 16px !important;
                        height: 65px !important;
                    }
                    .main-user-header img {
                        height: 48px !important;
                    }
                    .header-title {
                        font-size: 0.95rem !important;
                    }
                    .notification-dropdown {
                        position: fixed !important;
                        top: 70px !important;
                        right: 16px !important;
                        left: 16px !important;
                        width: auto !important;
                        z-index: 9999 !important;
                    }
                }
            `}</style>
        </header>
    );
};

export default UserHeader;
