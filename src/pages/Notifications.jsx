import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowLeft, Loader, Calendar, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import UserHeader from '../components/UserHeader';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const Notifications = ({ user }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const fetchNotifications = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch notifications');
            const data = await res.json();
            // Added explicit descending sort to ensure newest notifications are on top
            const sorted = Array.isArray(data) ? data.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)) : [];
            setNotifications(sorted);
        } catch (err) {
            setError(err.message);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications(false);
        
        const handleRefresh = () => fetchNotifications(true);
        window.addEventListener('refresh_notifications', handleRefresh);
        
        return () => window.removeEventListener('refresh_notifications', handleRefresh);
    }, []);

    const markAllRead = async () => {
        try {
            const res = await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
                window.dispatchEvent(new CustomEvent('refresh_notifications'));
            }
        } catch (err) {
            console.error(err);
        }
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
        try {
            const res = await fetch(`${API_URL}/api/notifications/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.NotificationID !== id));
                window.dispatchEvent(new CustomEvent('refresh_notifications'));
            } else {
                const msg = await res.text();
                alert(`Error deleting notification: ${msg}`);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Cannot connect to server to delete notification.');
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
        if (!n.IsRead) {
            try {
                await fetch(`${API_URL}/api/notifications/${n.NotificationID}/read`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                });
                setNotifications(prev => prev.map(item => item.NotificationID === n.NotificationID ? { ...item, IsRead: true } : item));
                window.dispatchEvent(new CustomEvent('refresh_notifications'));
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleNotificationClick = async (n) => {
        await markAsReadOnly(n);

        if (n.Type === 'Chat' && n.TargetID) {
            window.dispatchEvent(new CustomEvent('open_chat', {
                detail: { UserID: n.TargetID, EmployeeName: 'Chat Partner', Role: 'Member' }
            }));
        } else if (n.LeadID) {
            navigate(`/leads/${n.LeadID}`);
        } else if (n.Type === 'Payment') {
            navigate('/leads/payment-pending');
        }
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Notifications" />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate('/dashboard', { replace: true })}
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
                        {notifications.length > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}
                            >
                                Mark all as read
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
                            {notifications.map((n, index) => (
                                <div
                                    key={n.NotificationID}
                                    onClick={() => {
                                        if (n.LeadID) {
                                            markAsReadOnly(n);
                                        } else {
                                            handleNotificationClick(n);
                                        }
                                    }}
                                    style={{
                                        padding: '24px 32px',
                                        borderBottom: index === notifications.length - 1 ? 'none' : '1px solid #f1f5f9',
                                        background: n.IsRead ? 'white' : 'rgba(99, 102, 241, 0.02)',
                                        display: 'flex',
                                        gap: '24px',
                                        alignItems: 'center',
                                        transition: '0.2s',
                                        cursor: 'pointer'
                                    }}
                                    className="notif-row"
                                >
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '12px',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: n.IsRead ? '#94a3b8' : '#6366f1',
                                        flexShrink: 0
                                    }}>
                                        <Bell size={20} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
                                            {n.Message}
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                <Calendar size={14} />
                                                {formatDate(n.CreatedAt)}
                                            </div>
                                            {n.LeadID && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleNotificationClick(n);
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', padding: 0 }}
                                                >
                                                    View Lead Details
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); requestDeleteNotification(n.NotificationID); }}
                                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '12px', borderRadius: '8px', transition: '0.2s', flexShrink: 0 }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                                    >
                                        <Trash2 size={20} style={{ strokeWidth: 2 }} />
                                    </button>
                                </div>
                            ))}
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
