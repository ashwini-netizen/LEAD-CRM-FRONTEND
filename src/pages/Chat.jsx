import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, MessageSquare, User, ArrowLeft, Shield } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const Chat = ({ user }) => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [unreadCounts, setUnreadCounts] = useState({});

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const res = await fetch(`${API_URL}/api/chat/contacts`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) setContacts(await res.json());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchContacts();
    }, []);

    useEffect(() => {
        const fetchUnread = async () => {
            if (!user) return;
            try {
                const res = await fetch(`${API_URL}/api/notifications`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const counts = {};
                    data.forEach(n => {
                        if (n.Type === 'Chat' && !n.IsRead && n.TargetID) {
                            counts[n.TargetID] = (counts[n.TargetID] || 0) + 1;
                        }
                    });
                    setUnreadCounts(counts);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchUnread();
        
        window.addEventListener('refresh_notifications', fetchUnread);
        
        const forceClear = (e) => {
            const targetId = e.detail;
            setUnreadCounts(prev => ({ ...prev, [targetId]: 0 }));
        };
        window.addEventListener('force_clear_chat_badge', forceClear);
        
        return () => {
            window.removeEventListener('refresh_notifications', fetchUnread);
            window.removeEventListener('force_clear_chat_badge', forceClear);
        };
    }, [user]);

    const currentUserId = user?.id || user?.UserID;
    const currentUserEmail = user?.email || user?.Email;

    const filtered = contacts.filter(c => {
        if (currentUserId && String(c.UserID) === String(currentUserId)) return false;
        if (currentUserEmail && c.Email && c.Email.toLowerCase() === currentUserEmail.toLowerCase()) return false;

        return c.EmployeeName.toLowerCase().includes(search.toLowerCase()) ||
               c.Role.toLowerCase().includes(search.toLowerCase());
    });

    const openChat = async (contact) => {
        window.dispatchEvent(new CustomEvent('open_chat', { detail: contact }));
        
        // Immediately clear it locally for instant feedback
        setUnreadCounts(prev => ({ ...prev, [contact.UserID]: 0 }));

        // Mark as read in backend if there are unread messages
        if (unreadCounts[contact.UserID] > 0) {
            try {
                await fetch(`${API_URL}/api/notifications/read-chat/${contact.UserID}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                window.dispatchEvent(new CustomEvent('refresh_notifications')); // Update App and UserHeader badges
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
            <UserHeader user={user} title="Internal Communications" />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <header className="responsive-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                        <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: '#6366f1' }}>
                            <MessageSquare size={24} />
                        </div>
                        <h1 style={{ fontSize: '2rem', margin: 0 }}>Internal Chat</h1>
                    </div>
                    <p style={{ color: '#64748b' }}>Connect with your team members instantly. Messages are secure and role-restricted.</p>
                </header>

                <div className="responsive-filter-bar" style={{ marginBottom: '24px' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            className="search-input"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            placeholder="Search colleagues to start a chat..."
                            value={search}
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', width: '100%' }}>
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px' }}>
                            <Loader size={30} className="spin" color="#6366f1" />
                            <p style={{ marginTop: '10px', color: '#94a3b8' }}>Loading your contacts...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', background: 'white', borderRadius: '16px' }}>
                            <User size={40} style={{ opacity: 0.1, marginBottom: '15px' }} />
                            <p style={{ color: '#94a3b8' }}>No reachable contacts found.</p>
                        </div>
                    ) : (
                        filtered.map(contact => (
                            <div
                                key={contact.UserID}
                                className="glass-card contact-card"
                                style={{
                                    padding: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '15px',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    background: 'white'
                                }}
                                onClick={() => openChat(contact)}
                            >
                                <div style={{ position: 'relative' }}>
                                    <div style={{ width: '50px', height: '50px', background: '#6366f11a', color: '#6366f1', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        {contact.EmployeeName.charAt(0)}
                                    </div>
                                    {contact.IsOnline && <div style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '3px solid white' }} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem' }}>{contact.EmployeeName}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                        <Shield size={12} /> {contact.Role}
                                    </div>
                                </div>
                                <div style={{ position: 'relative', padding: '8px', background: '#f1f5f9', borderRadius: '8px', color: '#6366f1' }}>
                                    <MessageSquare size={16} />
                                    {unreadCounts[contact.UserID] > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-6px',
                                            right: '-6px',
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
                                            {unreadCounts[contact.UserID]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
                .contact-card:hover { transform: translateY(-3px); border-color: #6366f1; box-shadow: 0 8px 25px rgba(99, 102, 241, 0.1); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Chat;
