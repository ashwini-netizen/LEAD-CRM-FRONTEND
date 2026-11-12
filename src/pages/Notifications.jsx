import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft, Loader, Calendar, Trash2, CheckCircle, AlertTriangle, Check } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import {
    isNotificationUnread,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    syncWithServerList
} from '../utils/notificationSync';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const Notifications = ({ user }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const fetchNotifications = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch notifications');
            const data = await res.json();
            
            // Reconcile server response with local immediate cache
            syncWithServerList(data);
            
            // Explicit descending sort to ensure newest notifications are on top
            const sorted = Array.isArray(data) ? data.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)) : [];
            setNotifications(sorted);
        } catch (err) {
            setError(err.message);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications(false);
        
        const handleRefresh = (e) => {
            if (e?.detail?.allRead) {
                setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
            } else if (e?.detail?.markedId) {
                setNotifications(prev => prev.map(n => n.NotificationID === e.detail.markedId ? { ...n, IsRead: true } : n));
            }
            fetchNotifications(true);
        };
        window.addEventListener('refresh_notifications', handleRefresh);
        
        return () => window.removeEventListener('refresh_notifications', handleRefresh);
    }, [fetchNotifications]);

    const markAllRead = async () => {
        // Immediate optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
        const token = localStorage.getItem('crm_token') || '';
        await markAllNotificationsAsRead(API_URL, token);
    };

    const requestDeleteNotification = (id) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Delete Notification',
            message: 'Are you sure you want to delete this notification? This action cannot be undone.',
            onConfirm: () => executeDeleteNotification(id)
        });
    };

    const executeDeleteNotification = async (id) => {
        // Optimistic delete
        setNotifications(prev => prev.filter(n => n.NotificationID !== id));
        window.dispatchEvent(new CustomEvent('refresh_notifications'));

        try {
            const res = await fetch(`${API_URL}/api/notifications/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) {
                const msg = await res.text();
                alert(`Error deleting notification: ${msg}`);
                fetchNotifications(true);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Cannot connect to server to delete notification.');
            fetchNotifications(true);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        
        return d.toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        }) + ' at ' + 
        d.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).toLowerCase();
    };

    const markAsReadOnly = async (n) => {
        if (isNotificationUnread(n)) {
            setNotifications(prev => prev.map(item => item.NotificationID === n.NotificationID ? { ...item, IsRead: true } : item));
            const token = localStorage.getItem('crm_token') || '';
            await markNotificationAsRead(n.NotificationID, API_URL, token);
        }
    };

    const handleNotificationClick = async (n) => {
        await markAsReadOnly(n);

        if (n.Type === 'Chat' && n.TargetID) {
            window.dispatchEvent(new CustomEvent('open_chat', {
                detail: { UserID: n.TargetID, EmployeeName: 'Chat Partner', Role: 'Member' }
            }));
        } else if (n.LeadID) {
            if (user?.role === 'Call Executive') {
                navigate(`/leads/call-manage/${n.LeadID}`, { state: { from: '/notifications', label: 'Notifications' } });
            } else {
                navigate(`/leads/${n.LeadID}`);
            }
        } else if (n.Type === 'Payment') {
            navigate('/leads/payment-pending');
        }
    };

    const handleBack = () => {
        if (user?.role === 'Admin') {
            navigate('/admin', { replace: true });
        } else {
            navigate('/dashboard', { replace: true });
        }
    };

    const unreadItemsCount = notifications.filter(n => isNotificationUnread(n)).length;

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Notifications" />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <button
                        onClick={handleBack}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                    >
                        <ArrowLeft size={18} /> Back
                    </button>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <button
                            onClick={() => fetchNotifications(false)}
                            disabled={loading}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#6366f1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}
                        >
                            <Loader size={16} className={loading ? 'spin' : ''} /> Refresh
                        </button>
                        {unreadItemsCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Check size={16} /> Mark all as read ({unreadItemsCount})
                            </button>
                        )}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                    {loading ? (
                        <div style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>
                            <Loader size={30} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                            <p>Loading your notifications...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>
                            <Bell size={48} style={{ marginBottom: '20px', opacity: 0.2 }} />
                            <h3>No notifications yet</h3>
                            <p>We'll notify you when there's an update on your leads.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {notifications.map((n, index) => {
                                const unread = isNotificationUnread(n);
                                return (
                                    <div
                                        key={n.NotificationID}
                                        onClick={() => {
                                            if (unread) {
                                                markAsReadOnly(n);
                                            }
                                        }}
                                        style={{
                                            padding: '20px 28px',
                                            borderBottom: index === notifications.length - 1 ? 'none' : '1px solid #f1f5f9',
                                            background: unread ? 'rgba(99, 102, 241, 0.03)' : 'white',
                                            borderLeft: unread ? '4px solid #6366f1' : '4px solid transparent',
                                            display: 'flex',
                                            gap: '20px',
                                            alignItems: 'center',
                                            transition: '0.2s',
                                            cursor: 'pointer'
                                        }}
                                        className="notif-row"
                                    >
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '12px',
                                            background: unread ? 'rgba(99, 102, 241, 0.1)' : '#f8fafc',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: unread ? '#6366f1' : '#94a3b8',
                                            flexShrink: 0
                                        }}>
                                            <Bell size={20} />
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: unread ? '700' : '600', color: '#1e293b' }}>
                                                    {n.Message}
                                                </h4>
                                                {unread ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: '700',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        background: '#e0e7ff',
                                                        color: '#4338ca'
                                                    }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }} />
                                                        Unread
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: '600',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        background: '#f1f5f9',
                                                        color: '#64748b'
                                                    }}>
                                                        <Check size={11} strokeWidth={2.5} />
                                                        Read
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.82rem' }}>
                                                    <Calendar size={13} />
                                                    {formatDate(n.CreatedAt)}
                                                </div>
                                                {n.LeadID && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleNotificationClick(n);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem', padding: 0 }}
                                                    >
                                                        {user?.role === 'Call Executive' ? 'Manage Call →' : 'View Lead Details →'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            {unread && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsReadOnly(n);
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        background: '#f8fafc',
                                                        border: '1px solid #e2e8f0',
                                                        color: '#475569',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = '#e0e7ff';
                                                        e.currentTarget.style.borderColor = '#c7d2fe';
                                                        e.currentTarget.style.color = '#4338ca';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = '#f8fafc';
                                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                                        e.currentTarget.style.color = '#475569';
                                                    }}
                                                >
                                                    <Check size={13} strokeWidth={2.5} /> Mark as read
                                                </button>
                                            )}

                                            <button
                                                onClick={(e) => { e.stopPropagation(); requestDeleteNotification(n.NotificationID); }}
                                                title="Delete notification"
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '10px', borderRadius: '8px', transition: '0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                            >
                                                <Trash2 size={18} style={{ strokeWidth: 2 }} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <style>{`
                    .notif-row:hover { background-color: #f8fafc !important; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>

            {/* Custom Confirm Modal for Notifications */}
            {confirmConfig.isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
                }}>
                    <div style={{
                        background: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '50%' }}>
                                <AlertTriangle size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>{confirmConfig.title}</h2>
                        </div>
                        
                        <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.5', marginBottom: '24px' }}>
                            {confirmConfig.message}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null })}
                                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}
                                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    confirmConfig.onConfirm();
                                    setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null });
                                }}
                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                                onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                                onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
