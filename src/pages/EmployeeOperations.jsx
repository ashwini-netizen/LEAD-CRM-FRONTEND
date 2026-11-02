import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Users, CheckCircle, XCircle, Calendar, History, TrendingUp, Briefcase, RefreshCw } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const EmployeeOperations = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Drag to scroll hook
    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/stats/employee/${id}?startDate=${startDate}&endDate=${endDate}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch employee stats');
            const result = await res.json();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [id, startDate, endDate]);

    useEffect(() => {
        if (user?.role === 'Admin') {
            window.history.pushState(null, null, window.location.pathname);
            const handlePopState = (e) => {
                if (employee?.Role === 'Field Executive') {
                    navigate('/admin/field-executives', { replace: true });
                } else if (employee?.Role === 'Call Executive') {
                    navigate('/admin/call-executives', { replace: true });
                } else {
                    navigate('/admin', { replace: true });
                }
            };
            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [navigate, user]);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={40} className="animate-spin" /></div>;
    if (error) return <div style={{ padding: '40px', textAlign: 'center' }}><p>{error}</p></div>;
    if (!data) return null;

    const employee = data.employee || {};
    const historyData = data.history || [];

    const isCreatedStatus = (status, activityType) => {
        const s = (status || '').toLowerCase().trim();
        return (s === 'busy' || s === 'follow-up' || s === 'followup' || s === 'call follow-up' || s === 'call followup') && activityType !== 'Meeting Action';
    };

    const isSuccessStatus = (status) => {
        const s = (status || '').toLowerCase().trim();
        return s === 'paid' || s === 'unpaid' || s === 'un paid' || s === 'due payment' || s === 'duepayment';
    };

    const isCanceledStatus = (status) => {
        const s = (status || '').toLowerCase().trim();
        return s === 'rejected';
    };

    const isMeetingStatus = (status, activityType) => {
        const s = (status || '').toLowerCase().trim();
        return s === 'quotation' || s === 'meeting follow-up' || s === 'meeting followup' || s === 'meetingfollowup';
    };

    const filteredHistory = historyData.filter(h => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Created') return isCreatedStatus(h.Status, h.ActivityType);
        if (activeFilter === 'Success') return isSuccessStatus(h.Status);
        if (activeFilter === 'Canceled') return isCanceledStatus(h.Status);
        if (activeFilter === 'Meetings') return isMeetingStatus(h.Status, h.ActivityType);
        return true;
    });

    const allCount = historyData.length;
    const leadsCreatedCount = historyData.filter(h => isCreatedStatus(h.Status, h.ActivityType)).length;
    const successesCount = historyData.filter(h => isSuccessStatus(h.Status)).length;
    const canceledCount = historyData.filter(h => isCanceledStatus(h.Status)).length;
    const meetingsCount = historyData.filter(h => isMeetingStatus(h.Status, h.ActivityType)).length;

    const toggleFilter = (f) => setActiveFilter(activeFilter === f ? 'All' : f);

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            <UserHeader user={user} title="Performance Analysis" />
            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1 }}>
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
                    <ArrowLeft size={18} /> 
                    Back
                </button>
                <div className="responsive-header" style={{ marginBottom: '30px' }}>
                    <div>
                        <h1 style={{ margin: 0 }}>{employee.EmployeeName}</h1>
                        <p style={{ margin: '5px 0 0', color: '#64748b' }}>{employee.Role} • {employee.EmployeeID}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>From</label>
                            <div style={{ position: 'relative', width: '150px' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input
                                    type="date"
                                    className="input-field"
                                    style={{ padding: '8px 8px 8px 30px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>To</label>
                            <div style={{ position: 'relative', width: '150px' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input
                                    type="date"
                                    className="input-field"
                                    style={{ padding: '8px 8px 8px 30px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            onClick={fetchStats}
                            style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', alignSelf: 'flex-end', cursor: 'pointer', fontWeight: '600' }}
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                    {['All', 'Success', 'Canceled', 'Meetings'].map(f => (
                        <button
                            key={f}
                            onClick={() => toggleFilter(f)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                border: '1px solid #6366f1',
                                background: activeFilter === f ? '#6366f1' : 'white',
                                color: activeFilter === f ? 'white' : '#6366f1',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px' }}>
                    <StatCard label="All Count" value={allCount} color="#64748b" />
                    <StatCard label="Successes" value={successesCount} color="#10b981" />
                    <StatCard label="Canceled" value={canceledCount} color="#ef4444" />
                    {['Team Lead', 'Call Executive', 'Field Executive'].includes(employee.Role) && (
                        <StatCard label="Meetings" value={meetingsCount} color="#a855f7" />
                    )}
                </div>

                <div className="glass-card" style={{ marginTop: '40px', padding: '0' }}>
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
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto', minWidth: '800px' }}>
                            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <tr>
                                    <th style={{ padding: '16px' }}>Action</th>
                                    <th style={{ padding: '16px' }}>Subject</th>
                                    <th style={{ padding: '16px' }}>Status</th>
                                    <th style={{ padding: '16px' }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.map((h, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '16px' }}>{h.ActivityType}</td>
                                        <td style={{ padding: '16px' }}>{h.Subject}</td>
                                        <td style={{ padding: '16px' }}>{h.Status}</td>
                                        <td style={{ padding: '16px' }}>
                                            {(() => {
                                                const d = new Date(h.Date.endsWith('Z') ? h.Date : h.Date + 'Z');
                                                const datePart = d.toLocaleDateString('en-GB');
                                                const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                                return `${datePart} ${timePart}`;
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, color }) => (
    <div className="glass-card" style={{ borderLeft: `4px solid ${color}` }}>
        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{label}</p>
        <h2 style={{ color }}>{value}</h2>
    </div>
);

export default EmployeeOperations;
