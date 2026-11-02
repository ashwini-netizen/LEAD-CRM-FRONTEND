import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Loader, AlertCircle, UserCheck, User, RefreshCw, Trash2, BarChart2, Activity, MessageSquare, Eye, EyeOff, AlertTriangle, Edit2, CheckCircle2 } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis, validatePhoneNumber } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
});

const AdminPanel = ({ user }) => {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState(() => {
        return localStorage.getItem('admin_panel_selected_role') || null;
    });
    const [users, setUsers] = useState({ 'Call Executive': [], 'Team Lead': [], 'Field Executive': [] });
    const [summary, setSummary] = useState({ 'Call Executive': 0, 'Team Lead': 0, 'Field Executive': 0 });
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [newEmployee, setNewEmployee] = useState({ name: '', empId: '', email: '', phone: '', password: '', nickName: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // Drag to scroll hook
    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const roles = [
        { name: 'Call Executive', icon: '📞', color: '#6366f1' },
        { name: 'Team Lead', icon: '📣', color: '#10b981' },
        { name: 'Field Executive', icon: '🚀', color: '#f59e0b' },
    ];

    const fetchSummary = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/users/summary`, { headers: getAuthHeader() });
            if (res.ok) setSummary(await res.json());
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    const fetchUsersForRole = useCallback(async (role) => {
        setLoadingUsers(true);
        try {
            const res = await fetch(`${API_URL}/api/users?role=${role}`, { headers: getAuthHeader() });
            const data = await res.json();
            setUsers(prev => ({ ...prev, [role]: res.ok ? data : [] }));
        } catch { /* ignore */ }
        setLoadingUsers(false);
    }, []);

    useEffect(() => {
        if (selectedRole) {
            fetchUsersForRole(selectedRole);
        }
    }, [selectedRole, fetchUsersForRole]);

    // Browser back button intercept — handle internal view navigation within /admin
    useEffect(() => {
        // Push initial 'home' state so we can detect when user is going back to dashboard
        if (!window.history.state?.adminView) {
            const storedRole = localStorage.getItem('admin_panel_selected_role');
            if (storedRole) {
                window.history.replaceState({ adminView: 'home' }, '', '/admin');
                window.history.pushState({ adminView: 'list', role: storedRole }, '', '/admin');
            } else {
                window.history.replaceState({ adminView: 'home' }, '', '/admin');
            }
        }

        const handlePopState = (e) => {
            const state = e.state;
            if (state?.adminView === 'form') {
                // Shouldn't normally land here; pop again to go to list
                window.history.go(-1);
            } else if (state?.adminView === 'list') {
                // Going back from form → show role list
                setSelectedRole(state?.role || null);
                setIsCreating(false);
                setIsEditing(false);
                setEditingUserId(null);
                setNewEmployee({ name: '', empId: '', email: '', phone: '', password: '', nickName: '' });
            } else if (state?.adminView === 'home') {
                // Going back from list → show admin home (role selector)
                setSelectedRole(null);
                setIsCreating(false);
                setIsEditing(false);
                localStorage.removeItem('admin_panel_selected_role');
            } else {
                // No adminView state = user is going back past the admin home → go to dashboard
                navigate('/dashboard', { replace: true });
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [navigate]);

    const handleSelectRole = (role) => {
        setSelectedRole(role);
        localStorage.setItem('admin_panel_selected_role', role);
        // Push a new history state so browser back returns to home
        window.history.pushState({ adminView: 'list', role }, '', '/admin');
        fetchUsersForRole(role);
    };

    const goBackToList = () => {
        setIsCreating(false);
        setIsEditing(false);
        setNewEmployee({ name: '', empId: '', email: '', phone: '', password: '', nickName: '' });
        setFormError('');
        window.history.replaceState({ adminView: 'list', role: selectedRole }, '', '/admin');
    };

    const goBackToHome = () => {
        // Explicitly reset to admin home view
        setSelectedRole(null);
        setIsCreating(false);
        setIsEditing(false);
        localStorage.removeItem('admin_panel_selected_role');
        window.history.replaceState({ adminView: 'home' }, '', '/admin');
    };

    const handleEmployeeChange = (e) => {
        const { name, value } = e.target;
        const cleanedValue = stripEmojis(value);

        // Restriction for Phone
        if (name === 'phone') {
            const onlyNums = cleanedValue.replace(/[^0-9]/g, '').slice(0, 10);
            setNewEmployee(prev => ({ ...prev, [name]: onlyNums }));
            return;
        }

        // Restriction for Name and Nick Name
        if (name === 'name' || name === 'nickName') {
            let onlyLetters = cleanedValue.replace(/[^A-Za-z\s]/g, '');
            if (onlyLetters.startsWith(' ')) {
                onlyLetters = onlyLetters.trimStart();
            }
            setNewEmployee(prev => ({ ...prev, [name]: onlyLetters }));
            return;
        }

        // Restriction for Employee ID — only numeric, max 9 digits
        if (name === 'empId') {
            const onlyNums = cleanedValue.replace(/[^0-9]/g, '').slice(0, 9);
            setNewEmployee(prev => ({ ...prev, [name]: onlyNums }));
            return;
        }

        setNewEmployee(prev => ({ ...prev, [name]: cleanedValue }));
    };

    const handleEditClick = (user) => {
        setNewEmployee({
            name: user.EmployeeName,
            empId: user.EmployeeID,
            email: user.Email,
            phone: user.ContactNumber,
            nickName: user.NickName || '',
            password: ''
        });
        setEditingUserId(user.UserID);
        setIsEditing(true);
        setIsCreating(true);
        // Push history so browser back returns to the list
        window.history.pushState({ adminView: 'form', role: selectedRole }, '', '/admin');
    };

    const handleDeleteUser = (userId) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Delete User',
            message: 'Are you sure you want to delete this user? This action cannot be undone.',
            onConfirm: () => executeDeleteUser(userId)
        });
    };

    const executeDeleteUser = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE', headers: getAuthHeader() });
            if (res.ok) {
                fetchUsersForRole(selectedRole);
                fetchSummary();
            }
        } catch { /* ignore */ }
    };

    const renderConfirmModal = () => {
        if (!confirmConfig.isOpen) return null;
        return (
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
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
        );
    };

    const renderSuccessPopup = () => {
        if (!showPopup) return null;
        return (
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
                animation: 'fadeIn 0.2s ease-out'
            }}>
                <div style={{
                    background: 'white', padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', textAlign: 'center', animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}>
                    <div style={{
                        background: '#dcfce7', color: '#22c55e', padding: '16px', borderRadius: '50%',
                        marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)', animation: 'pulseGreen 2s infinite'
                    }}>
                        <CheckCircle2 size={48} strokeWidth={2.5} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: '0 0 10px 0', fontWeight: '800' }}>
                        {isEditing ? 'Updated successfully' : 'Registered successfully'}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.5', margin: 0, fontWeight: '500' }}>
                        {isEditing 
                            ? `${selectedRole} updated successfully.`
                            : `${selectedRole} registered successfully.`
                        }
                    </p>
                </div>
            </div>
        );
    };

    const handleSubmitRegistration = async (e) => {
        e.preventDefault();
        setFormError('');
        // Validations
        if (newEmployee.phone) {
            const phoneValidation = validatePhoneNumber(newEmployee.phone, 'Phone number');
            if (!phoneValidation.isValid) {
                setFormError(phoneValidation.message);
                return;
            }
        }

        const cleanedEmail = newEmployee.email.trim().replace(/\s/g, '');
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
        if (!emailRegex.test(cleanedEmail)) {
            setFormError('Please enter a valid email address (lowercase ending in .com).');
            return;
        }

        if (!newEmployee.name || !newEmployee.email || !newEmployee.empId || !newEmployee.nickName || (!isEditing && !newEmployee.password)) {
            setFormError('Name, email, Employee ID, Nick Name, and password are required.');
            return;
        }

        if (newEmployee.password && !/^\d{6}$/.test(newEmployee.password)) {
            setFormError('Password must be exactly 6 digits.');
            return;
        }
        setSubmitting(true);
        try {
            const url = isEditing ? `${API_URL}/api/users/${editingUserId}` : `${API_URL}/api/auth/register`;
            const method = isEditing ? 'PUT' : 'POST';

            const cleanedEmail = newEmployee.email.trim().replace(/\s/g, '');
            const res = await fetch(url, {
                method,
                headers: getAuthHeader(),
                body: JSON.stringify({ ...newEmployee, email: cleanedEmail, role: selectedRole })
            });
            const data = await res.json();
            if (!res.ok) { setFormError(data.message || 'Action failed'); setSubmitting(false); return; }

            fetchUsersForRole(selectedRole);
            fetchSummary();
            setShowPopup(true);
            setTimeout(() => {
                setShowPopup(false);
                setIsCreating(false);
                setIsEditing(false);
                setEditingUserId(null);
                setNewEmployee({ name: '', empId: '', email: '', phone: '', password: '', nickName: '' });
            }, 2000);
        } catch {
            setFormError('Server error. Is the backend running?');
        }
        setSubmitting(false);
    };

    if (isCreating && selectedRole) {
        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <UserHeader user={user} title="Admin Control Center" />
                <div className="page-main-container fade-in" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1, overflowY: 'auto' }}>
                    <button
                        onClick={goBackToList}
                        className="btn-secondary"
                        style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                    >
                        <ArrowLeft size={20} /> Back to {selectedRole} List
                    </button>
                    <h2 style={{ marginBottom: '30px' }}>{isEditing ? `Edit ${selectedRole}` : `Register New ${selectedRole}`}</h2>

                    {formError && (
                        <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                            <AlertCircle size={16} /> {formError}
                        </div>
                    )}

                    <form className="glass-card fade-in" style={{ display: 'grid', gap: '20px' }} onSubmit={handleSubmitRegistration}>
                        <div className="responsive-form-grid">
                            <div>
                                <label style={labelStyle}>Employee Name *</label>
                                <input name="name" className="input-field" placeholder="Full Name" value={newEmployee.name} onChange={handleEmployeeChange} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Nick Name *</label>
                                <input name="nickName" className="input-field" placeholder="Short Name" value={newEmployee.nickName} onChange={handleEmployeeChange} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Employee ID *</label>
                                <input
                                    name="empId"
                                    className="input-field"
                                    placeholder="Max 9 digits (e.g. 123456789)"
                                    value={newEmployee.empId}
                                    onChange={handleEmployeeChange}
                                    inputMode="numeric"
                                    maxLength={9}
                                    pattern="[0-9]{1,9}"
                                    title="Employee ID must be numeric and up to 9 digits"
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Email *</label>
                                <input
                                    name="email"
                                    type="text"
                                    className="input-field"
                                    placeholder="email@company.com"
                                    value={newEmployee.email}
                                    onChange={(e) => handleEmployeeChange({ target: { name: 'email', value: stripEmojis(e.target.value).toLowerCase().replace(/\s/g, '') }})}
                                    onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.preventDefault(); }}
                                    onBlur={() => setNewEmployee(prev => ({ ...prev, email: prev.email.trim().replace(/\s/g, '') }))}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Contact Number</label>
                                <input name="phone" className="input-field" placeholder="Phone Number" value={newEmployee.phone} onChange={handleEmployeeChange} />
                            </div>
                            <div>
                                <label style={labelStyle}>{isEditing ? 'New Password (leave empty to keep current)' : 'Temporary Password *'}</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        name="password" 
                                        type={showPassword ? 'text' : 'password'} 
                                        className="input-field" 
                                        style={{ paddingRight: '44px', position: 'relative', zIndex: 1 }}
                                        placeholder={isEditing ? '••••••••' : 'Set a 6-digit password'} 
                                        value={newEmployee.password} 
                                        onChange={handleEmployeeChange} 
                                        required={!isEditing}
                                        minLength={6}
                                        maxLength={6}
                                        pattern="\d{6}"
                                        title="Password must be exactly 6 digits"
                                    />
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // prevent input losing focus / re-render race
                                            setShowPassword(prev => !prev);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#64748b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '4px',
                                            zIndex: 2,
                                            lineHeight: 0,
                                        }}
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Role</label>
                                <input className="input-field" value={selectedRole} disabled style={{ opacity: 0.7 }} />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {submitting ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : <><UserCheck size={16} /> {isEditing ? 'Save Changes' : 'Submit Registration'}</>}
                        </button>
                    </form>
                </div>
                {renderConfirmModal()}
                {renderSuccessPopup()}
            </div>
        );
    }

    if (selectedRole) {
        const roleInfo = roles.find(r => r.name === selectedRole);
        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <UserHeader user={user} title="Admin Control Center" />
                <div className="page-main-container fade-in" style={{ flex: 1, overflowY: 'auto' }}>
                    <button
                        onClick={goBackToHome}
                        className="btn-secondary"
                        style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                    >
                        <ArrowLeft size={20} /> Back to Admin Control Center
                    </button>

                    <div className="responsive-header" style={{ marginBottom: '30px' }}>
                        <h2>{roleInfo?.icon} {selectedRole} List
                            <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#94a3b8', marginLeft: '12px' }}>
                                {users[selectedRole]?.length || 0} member{users[selectedRole]?.length !== 1 ? 's' : ''}
                            </span>
                        </h2>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => fetchUsersForRole(selectedRole)} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <RefreshCw size={14} /> Refresh
                            </button>
                            <button onClick={() => { setIsCreating(true); window.history.pushState({ adminView: 'form', role: selectedRole }, '', '/admin'); }} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>
                                + Add {selectedRole}
                            </button>
                        </div>
                    </div>

                    <div style={{ minHeight: '300px' }}>
                        {loadingUsers ? (
                            <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                                <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
                                <p style={{ marginTop: '12px', fontWeight: '800' }}>Loading system users...</p>
                            </div>
                        ) : users[selectedRole]?.length === 0 ? (
                            <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                                <User size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                <p style={{ fontWeight: '800' }}>No {selectedRole}s found in the system.</p>
                            </div>
                        ) : (
                            <div 
                                ref={tableContainerRef}
                                className="responsive-table-container hide-scrollbar"
                                style={{ 
                                    overflowX: 'auto',
                                    cursor: isDragging ? 'grabbing' : 'grab' 
                                }}
                                onMouseDown={handleMouseDown}
                                onMouseLeave={handleMouseLeave}
                                onMouseUp={handleMouseUp}
                                onMouseMove={handleMouseMove}
                            >
                                <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                                    <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                        <tr style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', textAlign: 'left' }}>
                                            <th style={{ padding: '15px 20px' }}>Employee Name</th>
                                            <th style={{ padding: '15px 20px' }}>Employee ID</th>
                                            <th style={{ padding: '15px 20px' }}>Email</th>
                                            <th style={{ padding: '15px 20px' }}>Contact Number</th>
                                            <th style={{ padding: '15px 20px' }}>Joined</th>
                                            <th style={{ padding: '15px 20px' }}>Operations</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users[selectedRole].map((u, i) => (
                                            <tr key={u.UserID || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '15px 20px', fontWeight: '800', color: '#0f172a' }}>{u.EmployeeName}</td>
                                                <td style={{ padding: '15px 20px', color: '#1e293b', fontWeight: '800' }}>{u.EmployeeID || 'N/A'}</td>
                                                <td style={{ padding: '15px 20px', color: '#4f46e5', fontWeight: '800' }}>{u.Email}</td>
                                                <td style={{ padding: '15px 20px', color: '#1e293b', fontWeight: '800' }}>{u.ContactNumber || 'N/A'}</td>
                                                <td style={{ padding: '15px 20px', color: '#334155', fontSize: '0.85rem', fontWeight: '800' }}>
                                                    {u.CreatedAt ? new Date(u.CreatedAt).toLocaleDateString('en-GB') : 'N/A'}
                                                </td>                    
                                                <td style={{ padding: '15px 20px' }}>
                                                    <button
                                                        onClick={() => navigate(`/admin/operations/${u.UserID}`)}
                                                        style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '600' }}
                                                    >
                                                        <BarChart2 size={13} /> View Stats
                                                    </button>
                                                    {(selectedRole === 'Call Executive' || selectedRole === 'Field Executive') && (
                                                        <button
                                                            onClick={() => navigate(`/admin/time-logs/${u.UserID}`)}
                                                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '600', marginTop: '8px' }}
                                                        >
                                                            <Activity size={13} /> Time Logs
                                                        </button>
                                                    )}
                                                </td>
                                                <td style={{ padding: '15px 20px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button onClick={() => handleEditClick(u)} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', minWidth: 'max-content', whiteSpace: 'nowrap' }}>
                                                        <Edit2 size={13} /> Edit
                                                    </button>
                                                    <button 
                                                        className="btn-danger"
                                                        onClick={() => handleDeleteUser(u.UserID)} 
                                                        style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', minWidth: 'max-content', whiteSpace: 'nowrap' }}
                                                    >
                                                        <Trash2 size={14} style={{ strokeWidth: 2.5 }} /> Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                {renderConfirmModal()}
                {renderSuccessPopup()}
            </div >
        );
    }

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <UserHeader user={user} title="Admin Control Center" />
            <div className="page-main-container" style={{ flex: 1, overflowY: 'auto' }}>
                <button
                    onClick={() => {
                        localStorage.removeItem('admin_panel_selected_role');
                        navigate('/dashboard', { replace: true });
                    }}
                    className="btn-secondary"
                    style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                >
                    <ArrowLeft size={20} /> Back to Dashboard
                </button>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>
                    <Shield size={32} color="#6366f1" /> Admin Dashboard
                </h1>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    <div className="glass-card">
                        <h3>Users Management</h3>
                        <ul style={{ listStyle: 'none', marginTop: '20px' }}>
                            {roles.map((role, i) => (
                                <li key={i} style={{ padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontWeight: '600' }}>{role.icon} {role.name}</p>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{summary[role.name] ?? 0} Users Active</p>
                                    </div>
                                    <button
                                        onClick={() => handleSelectRole(role.name)}
                                        style={{ background: `${role.color}1a`, color: role.color, border: `1px solid ${role.color}66`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: '0.3s', fontWeight: '600' }}
                                    >
                                        View List
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>
            </div>

            {renderConfirmModal()}
            {renderSuccessPopup()}
        </div>
    );
};

const labelStyle = { display: 'block', marginBottom: '8px', color: '#94a3b8', fontSize: '0.9rem' };

export default AdminPanel;
