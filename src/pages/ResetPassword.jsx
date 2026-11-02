import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';
import { stripEmojis } from '../utils/stringUtils';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const ResetPassword = ({ user, onComplete }) => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/reset-first-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({ newPassword: password })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Reset failed');
            }

            // Update local user state
            const updatedUser = { ...user, isFirstLogin: false };
            localStorage.setItem('crm_user', JSON.stringify(updatedUser));
            onComplete(updatedUser);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: '#f0f2f5' }}>
            <div className="glass-card fade-in" style={{ width: '450px', maxWidth: '100%', boxSizing: 'border-box', padding: '30px 20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <ShieldCheck size={30} color="#6366f1" />
                    </div>
                    <h2>Secure Your Account</h2>
                    <p style={{ color: '#64748b', marginTop: '10px' }}>This is your first login. Please set a new personal password to continue.</p>
                </div>

                {error && (
                    <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={iconStyle} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input-field"
                                placeholder="Enter new password"
                                style={{ paddingLeft: '45px', paddingRight: '45px' }}
                                value={password}
                                onChange={e => setPassword(stripEmojis(e.target.value))}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={toggleButtonStyle}
                            >
                                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '30px' }}>
                        <label style={labelStyle}>Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={iconStyle} />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                className="input-field"
                                placeholder="Confirm new password"
                                style={{ paddingLeft: '45px', paddingRight: '45px' }}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(stripEmojis(e.target.value))}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={toggleButtonStyle}
                            >
                                {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} disabled={loading}>
                        {loading ? <><Loader size={18} className="spin" /> Updating...</> : 'Update & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' };
const iconStyle = { position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 5 };
const toggleButtonStyle = { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px', zIndex: 10 };

export default ResetPassword;
