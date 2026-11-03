import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, Loader, LogIn } from 'lucide-react';
import { stripEmojis } from '../utils/stringUtils';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const LoginScreen = ({ role, onLogin }) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot Password States
    const [forgotMode, setForgotMode] = useState(false); // false, 'request', 'verify'
    const [resetEmail, setResetEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const trimmedEmail = email.trim().replace(/\s/g, '');
        setEmail(trimmedEmail);

        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
        if (!emailRegex.test(trimmedEmail)) {
            setError('Please enter a valid email address (lowercase ending in .com).');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedEmail, password, role })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Login failed');
                setLoading(false);
                return;
            }
            localStorage.setItem('crm_token', data.token);
            localStorage.setItem('crm_user', JSON.stringify(data.user));
            onLogin(data.user);
            if (data.user.isFirstLogin) {
                navigate('/reset-password', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        } catch (err) {
            if (API_URL.includes('ngrok-free.dev')) {
                setError(`Connection failed. Please visit the backend link directly once in a new browser tab to authorize connection: ${API_URL}`);
            } else {
                setError('Cannot connect to server. Is the backend running?');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const trimmedResetEmail = resetEmail.trim().replace(/\s/g, '');
        setResetEmail(trimmedResetEmail);

        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
        if (!emailRegex.test(trimmedResetEmail)) {
            setError('Please enter a valid email address (lowercase ending in .com).');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/admin/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedResetEmail })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Failed to send OTP');
                return;
            }
            setSuccess(data.message || 'OTP sent successfully!');
            setForgotMode('verify');
        } catch (err) {
            setError('Cannot connect to server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (otp.length !== 6 || isNaN(otp)) {
            setError('Please enter a valid 6-digit OTP code.');
            return;
        }

        if (newPassword.length < 4) {
            setError('Password must be at least 4 characters long.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/admin/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail.trim(), otp, newPassword })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Failed to reset password');
                return;
            }
            setSuccess('Password reset successfully! You can now log in.');
            setForgotMode(false);
            setPassword('');
            setOtp('');
            setNewPassword('');
        } catch (err) {
            setError('Cannot connect to server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            {/* Background Elements */}
            <div className="mesh-bg"></div>
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="premium-login-card"
            >
                {forgotMode ? (
                    <button 
                        onClick={() => { setForgotMode(false); setError(''); setSuccess(''); }} 
                        className="btn-secondary" 
                        style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                    >
                        <ArrowLeft size={16} /> Back to Login
                    </button>
                ) : (
                    <button 
                        onClick={() => navigate('/')} 
                        className="btn-secondary" 
                        style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                    >
                        <ArrowLeft size={16} /> Back to Portal
                    </button>
                )}

                <div style={headerStyle}>
                    <h2 style={titleStyle}>
                        {forgotMode ? 'Reset ' : 'Welcome '}
                        <span className="text-gradient">{forgotMode ? 'Credentials' : 'Back'}</span>
                    </h2>
                    <p style={subtitleStyle}>
                        {forgotMode 
                            ? 'Admin security portal verification' 
                            : <>Accessing as <strong style={{ color: '#818cf8', textTransform: 'capitalize' }}>{role === 'team_lead' ? 'Team Lead' : (role?.replace('_', ' ') || 'USER')}</strong></>
                        }
                    </p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={errorStyle}
                    >
                        <AlertCircle size={16} /> {error}
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={successStyle}
                    >
                        <span style={{ fontSize: '1.1rem', marginRight: '6px' }}>✅</span> {success}
                    </motion.div>
                )}

                {forgotMode === 'request' && (
                    <form onSubmit={handleRequestOtp} style={formStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Admin Registered Email</label>
                            <div style={inputWrapperStyle}>
                                <Mail size={18} style={inputIconStyle} />
                                <input
                                    type="text"
                                    className="premium-input"
                                    placeholder="admin@company.com"
                                    value={resetEmail}
                                    onChange={e => setResetEmail(stripEmojis(e.target.value).toLowerCase().replace(/\s/g, ''))}
                                    onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.preventDefault(); }}
                                    onBlur={() => setResetEmail(prev => prev.trim().replace(/\s/g, ''))}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="premium-btn" disabled={loading}>
                            {loading ? <Loader size={20} className="spin" /> : 'Send Verification OTP'}
                        </button>
                    </form>
                )}

                {forgotMode === 'verify' && (
                    <form onSubmit={handleResetPassword} style={formStyle}>
                        <p style={{ fontSize: '0.88rem', color: '#475569', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                            We have sent a verification code to <strong>{resetEmail}</strong>. Enter it below along with your new password.
                        </p>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>6-Digit OTP Code</label>
                            <div style={inputWrapperStyle}>
                                <Lock size={18} style={inputIconStyle} />
                                <input
                                    type="text"
                                    className="premium-input"
                                    placeholder="123456"
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(stripEmojis(e.target.value).replace(/\D/g, ''))}
                                    required
                                />
                            </div>
                        </div>

                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>New Password</label>
                            <div style={inputWrapperStyle}>
                                <Lock size={18} style={inputIconStyle} />
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    className="premium-input"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(stripEmojis(e.target.value))}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    style={toggleButtonStyle}
                                >
                                    {showNewPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="premium-btn" disabled={loading}>
                            {loading ? <Loader size={20} className="spin" /> : 'Update & Reset Password'}
                        </button>
                    </form>
                )}

                {!forgotMode && (
                    <form onSubmit={handleSubmit} style={formStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Work Email</label>
                            <div style={inputWrapperStyle}>
                                <Mail size={18} style={inputIconStyle} />
                                <input
                                    type="text"
                                    className="premium-input"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={e => setEmail(stripEmojis(e.target.value).toLowerCase().replace(/\s/g, ''))}
                                    onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.preventDefault(); }}
                                    onBlur={() => setEmail(prev => prev.trim().replace(/\s/g, ''))}
                                    required
                                />
                            </div>
                        </div>

                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Security Password</label>
                            <div style={inputWrapperStyle}>
                                <Lock size={18} style={inputIconStyle} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="premium-input"
                                    placeholder="••••••••"
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

                        {role === 'admin' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-10px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForgotMode('request');
                                        setResetEmail(email);
                                        setError('');
                                        setSuccess('');
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6366f1',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        padding: '4px',
                                    }}
                                    className="forgot-password-link"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        <button type="submit" className="premium-btn" disabled={loading}>
                            {loading ? <Loader size={20} className="spin" /> : <><LogIn size={18} /> Authenticate System</>}
                        </button>
                    </form>
                )}
            </motion.div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
                * { font-family: 'Outfit', sans-serif; box-sizing: border-box; }
                
                .mesh-bg {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: radial-gradient(circle at 100% 100%, #f0f4ff 0%, #ffffff 50%, #fdf2f8 100%);
                    z-index: -2;
                }

                .blob {
                    position: fixed; width: 600px; height: 600px;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
                    filter: blur(80px); z-index: -1; pointer-events: none;
                }
                .blob-1 { top: -200px; right: -100px; }
                .blob-2 { bottom: -200px; left: -100px; }

                .premium-login-card {
                    width: 460px;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 1);
                    border-radius: 40px;
                    padding: 50px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
                }

                .text-gradient {
                    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .premium-input {
                    width: 100%;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 14px 44px 14px 46px;
                    color: #1e293b;
                    font-size: 1rem;
                    transition: 0.3s;
                }

                /* Hide default Microsoft Edge password reveal & clear buttons */
                .premium-input::-ms-reveal,
                .premium-input::-ms-clear,
                input::-ms-reveal,
                input::-ms-clear {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                    pointer-events: none !important;
                }

                .premium-input:focus {
                    outline: none;
                    border-color: #818cf8;
                    box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.1);
                }

                .premium-btn {
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: white;
                    border: none;
                    border-radius: 16px;
                    font-weight: 700;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 10px;
                }

                .premium-btn:hover {
                    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);
                    transform: translateY(-2px);
                }

                .premium-btn:active { transform: scale(0.98); }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .forgot-password-link:hover {
                    text-decoration: underline;
                    color: #4f46e5 !important;
                }

                .btn-secondary {
                    background: white;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    cursor: pointer;
                    padding: 8px 16px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.85rem;
                    transition: 0.3s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .btn-secondary:hover {
                    background: #f8fafc;
                    color: #334155;
                    border-color: #cbd5e1;
                }
            `}</style>
        </div>
    );
};

const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    color: '#1e293b',
};

const backButtonStyle = {
    background: 'white',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    cursor: 'pointer',
    padding: '8px 16px',
    borderRadius: '12px',
    marginBottom: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    transition: '0.3s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
};

const headerStyle = {
    marginBottom: '32px',
};

const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f1f5f9',
    color: '#6366f1',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: '800',
    letterSpacing: '1px',
    marginBottom: '16px',
};

const titleStyle = {
    fontSize: '2.4rem',
    fontWeight: '800',
    margin: '0 0 8px 0',
    letterSpacing: '-1px',
    color: '#0f172a',
};

const subtitleStyle = {
    color: '#64748b',
    margin: 0,
    fontSize: '1rem',
};

const errorStyle = {
    background: '#fef2f2',
    border: '1px solid #fee2e2',
    color: '#ef4444',
    padding: '14px',
    borderRadius: '16px',
    marginBottom: '24px',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

const successStyle = {
    background: '#f0fdf4',
    border: '1px solid #dcfce7',
    color: '#15803d',
    padding: '14px',
    borderRadius: '16px',
    marginBottom: '24px',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
};

const inputGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
};

const labelStyle = {
    fontSize: '0.85rem',
    color: '#64748b',
    fontWeight: '600',
    paddingLeft: '4px',
};

const inputWrapperStyle = {
    position: 'relative',
};

const inputIconStyle = {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#475569',
};

const toggleButtonStyle = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
};

export default LoginScreen;
