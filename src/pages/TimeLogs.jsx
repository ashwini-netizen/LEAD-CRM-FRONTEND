import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Clock, Calendar, User } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const TimeLogs = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/stats/employee/${id}?startDate=${startDate}&endDate=${endDate}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setEmployee(data.employee);
                const rawLogs = data.activityLogs || [];
                setLogs(processLogs(rawLogs));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [id, startDate, endDate]);

    useEffect(() => {
        window.history.pushState(null, null, window.location.href);
        const handlePopState = () => {
            if (user?.role === 'Admin') {
                navigate('/admin', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [navigate, user, employee]);

    const processLogs = (rawLogs) => {
        if (!rawLogs || rawLogs.length === 0) return [];

        // Sort by date ascending to process pairs
        const sorted = [...rawLogs].sort((a, b) => new Date(a.Date) - new Date(b.Date));
        const pairs = [];
        let currentPair = null;

        sorted.forEach(log => {
            const type = (log.ActivityType || '').toLowerCase();
            if (type === 'online') {
                if (currentPair) {
                    // Push previous incomplete pair if it doesn't have a logout
                    pairs.push(currentPair);
                }
                currentPair = { date: log.Date, login: log.Date, logout: null };
            } else if (type === 'offline') {
                if (currentPair) {
                    currentPair.logout = log.Date;
                    pairs.push(currentPair);
                    currentPair = null;
                } else {
                    // Offline without a matching Online in this batch
                    pairs.push({ date: log.Date, login: null, logout: log.Date });
                }
            }
        });

        // Handle the last open session
        if (currentPair) {
            pairs.push(currentPair);
        }

        // Sort back to descending for display
        return pairs.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={40} className="spin" /></div>;

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            <UserHeader user={user} title="Availability Logs" />
            <div className="page-main-container fade-in" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1 }}>
                <button
                    onClick={() => {
                        if (user?.role === 'Admin') {
                            navigate('/admin', { replace: true });
                        } else {
                            navigate('/dashboard', { replace: true });
                        }
                    }}
                    className="btn-secondary"
                    style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                >
                    <ArrowLeft size={20} /> Back
                </button>

                <div className="glass-card" style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '30px', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ width: '60px', height: '60px', background: '#6366f110', color: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={30} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{employee?.EmployeeName}</h1>
                            <p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{employee?.Role} • {employee?.EmployeeID}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>From</label>
                            <div style={{ position: 'relative', width: '170px' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px 6px 30px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>To</label>
                            <div style={{ position: 'relative', width: '170px' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px 6px 30px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: 0 }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', borderLeft: '6px solid #6366f1' }}>
                        <Clock size={20} color="#6366f1" />
                        <h3 style={{ margin: 0, fontWeight: '800', color: '#1e293b' }}>Session Activity History</h3>
                    </div>
                    <div 
                        ref={tableContainerRef}
                        className="hide-scrollbar"
                        style={{ overflowX: 'auto', cursor: isDragging ? 'grabbing' : 'grab' }}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                    >
                        <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: isDragging ? 'none' : 'auto', minWidth: '600px' }}>
                            <thead>
                            <tr style={{ textAlign: 'left', background: '#f1f5f9', fontSize: '0.85rem', color: '#1e293b', fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '15px 24px' }}>Date</th>
                                <th style={{ padding: '15px 24px' }}>Login Time</th>
                                <th style={{ padding: '15px 24px' }}>Logout Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No session logs found for this executive.</td>
                                </tr>
                            ) : (
                                logs.map((log, i) => {
                                    const getUtcDate = (d) => {
                                        if (!d) return new Date();
                                        // Ensure 'Z' is present so browser parses it as UTC and converts to local
                                        return new Date(d.endsWith('Z') ? d : d + 'Z');
                                    };
                                    const dateObj = getUtcDate(log.date);
                                    const formatTime = (dateStr) => {
                                        if (!dateStr) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Active / Pending</span>;
                                        const t = getUtcDate(dateStr);
                                        return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                    };
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '15px 24px', fontWeight: '500' }}>
                                                {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '15px 24px', color: '#10b981', fontWeight: '700' }}>
                                                <div style={{ fontSize: '0.65rem', marginBottom: '4px', opacity: 0.6 }}>ONLINE</div>
                                                {formatTime(log.login)}
                                            </td>
                                            <td style={{ padding: '15px 24px', color: log.logout ? '#ef4444' : '#64748b', fontWeight: '700' }}>
                                                <div style={{ fontSize: '0.65rem', marginBottom: '4px', opacity: 0.6 }}>OFFLINE</div>
                                                {formatTime(log.logout)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default TimeLogs;
