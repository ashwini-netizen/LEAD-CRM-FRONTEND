import { validatePhoneNumber } from '../utils/stringUtils';
import { useState, useEffect } from 'react';
import { Mail, IdCard, X, LogOut, Loader, Phone, User, Edit2, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const Profile = ({ user }) => {
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editNickName, setEditNickName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [logoutWarning, setLogoutWarning] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                });
                if (res.ok) {
                    setProfileData(await res.json());
                } else {
                    if (res.status === 401) {
                        performLogout();
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        if (profileData) {
            setEditName(profileData.EmployeeName || '');
            setEditNickName(profileData.NickName || '');
            setEditPhone(profileData.ContactNumber || '');
        }
    }, [profileData]);

    const performLogout = () => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        window.location.reload();
    };

    const handleLogoutClick = () => {
        const crmUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
        const role = user?.role || user?.Role || crmUser?.role || crmUser?.Role;
        const isOnline = profileData?.IsOnline || user?.IsOnline || crmUser?.IsOnline;
        const cleanRole = String(role || '').trim().toLowerCase();

        if ((cleanRole === 'field executive' || cleanRole === 'field_executive' || cleanRole === 'call executive' || cleanRole === 'call_executive') && isOnline) {
            setLogoutWarning('Please turn off online status or go offline before logging out.');
            setShowLogoutModal(true);
            return;
        }
        setLogoutWarning('');
        setShowLogoutModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!editName.trim()) {
            setUpdateError('Name is required');
            return;
        }
        
        if (editPhone) {
            const phoneValidation = validatePhoneNumber(editPhone, 'Phone number');
            if (!phoneValidation.isValid) {
                setUpdateError(phoneValidation.message);
                return;
            }
        }

        setUpdating(true);
        setUpdateError('');
        try {
            const res = await fetch(`${API_URL}/api/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({
                    name: editName,
                    nickName: editNickName,
                    phone: editPhone
                })
            });
            if (res.ok) {
                const currentUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
                const updatedUser = {
                    ...currentUser,
                    name: editName,
                    nickName: editNickName,
                    NickName: editNickName,
                    ContactNumber: editPhone
                };
                localStorage.setItem('crm_user', JSON.stringify(updatedUser));
                window.dispatchEvent(new Event('user_updated'));
                
                setProfileData(prev => ({
                    ...prev,
                    EmployeeName: editName,
                    NickName: editNickName,
                    ContactNumber: editPhone
                }));
                setIsEditing(false);
            } else {
                const errData = await res.json();
                setUpdateError(errData.message || 'Failed to update profile');
            }
        } catch (err) {
            setUpdateError('Network error. Failed to save.');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '30px', textAlign: 'center' }}>
                <Loader className="spin" size={24} color="#6366f1" />
                <p style={{ marginTop: '10px' }}>Loading Profile...</p>
            </div>
        </div>
    );

    if (!profileData) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }} className="fade-in">
            <div className="glass-card fade-in" style={{
                width: '90%',
                maxWidth: '480px',
                padding: '40px',
                background: 'white',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                boxSizing: 'border-box'
            }}>
                {/* Close Button */}
                <button
                    onClick={() => navigate('/dashboard', { replace: true })}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        top: '20px',
                        background: '#f1f5f9',
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#64748b'
                    }}
                >
                    <X size={18} />
                </button>

                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        borderRadius: '30px',
                        margin: '0 auto 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '2.5rem',
                        fontWeight: '800',
                        boxShadow: '0 10px 25px rgba(99, 102, 241, 0.2)'
                    }}>
                        {profileData.EmployeeName?.charAt(0)}
                    </div>

                    <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '4px' }}>
                        {profileData.EmployeeName}
                    </h2>
                    <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        marginBottom: '30px'
                    }}>
                        {profileData.Role}
                    </span>
                </div>

                {isEditing ? (
                    <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
                        {updateError && (
                            <div style={{ color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>
                                <AlertCircle size={14} /> {updateError}
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Full Name *</label>
                            <input 
                                type="text" 
                                value={editName}
                                onChange={e => {
                                    let val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                    if (val.startsWith(' ')) val = val.trimStart();
                                    setEditName(val);
                                }}
                                style={inputStyle}
                                placeholder="Full Name"
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Nick Name</label>
                            <input 
                                type="text" 
                                value={editNickName}
                                onChange={e => {
                                    let val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                    if (val.startsWith(' ')) val = val.trimStart();
                                    setEditNickName(val);
                                }}
                                style={inputStyle}
                                placeholder="Short Name"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Phone Number</label>
                                <input 
                                    type="text" 
                                    value={editPhone}
                                    onChange={e => {
                                        let val = e.target.value.replace(/[^0-9]/g, '');
                                        if (val.length > 0 && !['6', '7', '8', '9'].includes(val[0])) {
                                            val = '';
                                        }
                                        setEditPhone(val.slice(0, 10));
                                    }}
                                    style={inputStyle}
                                    placeholder="Phone number"
                                />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button
                                type="submit"
                                disabled={updating}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                {updating ? <Loader size={16} className="spin" /> : <Check size={16} />} Save
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditName(profileData.EmployeeName || '');
                                    setEditNickName(profileData.NickName || '');
                                    setEditPhone(profileData.ContactNumber || '');
                                    setUpdateError('');
                                }}
                                disabled={updating}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: '#cbd5e1',
                                    color: '#475569',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div style={{ display: 'grid', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', color: '#6366f1' }}>
                                    <IdCard size={20} />
                                </div>
                                <div>
                                    <p style={detailLabelStyle}>Employee ID</p>
                                    <p style={detailValueStyle}>{profileData.EmployeeID}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', color: '#6366f1' }}>
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <p style={detailLabelStyle}>Email Address</p>
                                    <p style={detailValueStyle}>{profileData.Email}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', color: '#6366f1' }}>
                                    <User size={20} />
                                </div>
                                <div>
                                    <p style={detailLabelStyle}>Nick Name</p>
                                    <p style={detailValueStyle}>{profileData.NickName || 'Not Set'}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', color: '#6366f1' }}>
                                    <Phone size={20} />
                                </div>
                                <div>
                                    <p style={detailLabelStyle}>Phone Number</p>
                                    <p style={detailValueStyle}>{profileData.ContactNumber || 'Not Set'}</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '40px' }}>
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    color: '#6366f1',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <Edit2 size={16} /> Edit Profile
                            </button>
                            <button
                                onClick={handleLogoutClick}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                                onMouseOut={e => e.currentTarget.style.opacity = '1'}
                            >
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Custom Logout Confirmation Modal */}
            {showLogoutModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
                }} onClick={(e) => e.stopPropagation()}>
                    <div style={{
                        background: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '50%' }}>
                                <LogOut size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Log Out</h2>
                        </div>
                        
                        {logoutWarning ? (
                            <>
                                <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.5', marginBottom: '24px' }}>
                                    {logoutWarning}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setShowLogoutModal(false)}
                                        style={{ background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        Understood
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.5', marginBottom: '24px' }}>
                                    Are you sure you want to log out of your session?
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setShowLogoutModal(false)}
                                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}
                                        onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                                        onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowLogoutModal(false);
                                            performLogout();
                                        }}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                                        onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                                        onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                                    >
                                        Yes, Log Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    );
};

const labelStyle = { display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };
const detailLabelStyle = { fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', margin: 0 };
const detailValueStyle = { fontWeight: '600', color: '#1e293b', margin: '4px 0 0 0', wordBreak: 'break-word' };

export default Profile;
