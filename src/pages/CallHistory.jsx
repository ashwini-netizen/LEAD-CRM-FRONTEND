import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Search, Phone, Calendar, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const statusColors = {
    'Interested': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Not Interested': { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
    'Follow-up': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Call Follow-up': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'Busy': { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'Hold': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Switch Off': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Speaking with Someone Else': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Speaking to Someone Else': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Incoming Not Available': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Incoming Call Not Available': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Not Answering': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Not Answered': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Processing': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Out of Service': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Invalid': { bg: 'rgba(239,68,68,0.08)', color: '#ef4444' },
    'Quotation': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
};

const CallHistory = ({ user }) => {
    const navigate = useNavigate();
    const isAdminOrTL = user?.role === 'Admin' || user?.role === 'Team Lead';
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [executiveFilter, setExecutiveFilter] = useState('all');
    const [executivesList, setExecutivesList] = useState([]);

    useEffect(() => {
        if (!isAdminOrTL) return;
        const fetchExecutives = async () => {
            try {
                const res = await fetch(`${API_URL}/api/users?role=Call%20Executive`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setExecutivesList(data || []);
                }
            } catch (err) {
                console.error('Error fetching executives:', err);
            }
        };
        fetchExecutives();
    }, [isAdminOrTL]);

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateFilter) params.append('date', dateFilter);
            if (isAdminOrTL && executiveFilter) {
                params.append('executiveId', executiveFilter);
            }
            const queryStr = params.toString() ? `?${params.toString()}` : '';
            const url = `${API_URL}/api/leads/call-history${queryStr}`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            } else {
                console.error('Failed to fetch logs:', await res.text());
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [dateFilter, executiveFilter]);

    const filtered = logs.filter(log => 
        log.FullName?.toLowerCase().includes(search.toLowerCase()) ||
        (log.Phone && String(log.Phone).toLowerCase().includes(search.toLowerCase())) ||
        log.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
        log.CallNote?.toLowerCase().includes(search.toLowerCase()) ||
        (log.ExecutiveName && log.ExecutiveName.toLowerCase().includes(search.toLowerCase())) ||
        (log.ExecutiveEmpID && log.ExecutiveEmpID.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw' }}>
            <UserHeader user={user} title="Executive Activity Log" />

            <div className="page-main-container">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <header className="responsive-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div>
                            <h1 style={{ color: '#1e293b', fontSize: '1.8rem', fontWeight: '800', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Call History Log</h1>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>Detailed record of every lead interaction.</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#6366f1' }}>
                            <Phone size={16} /> {logs.length} Total Records
                        </span>
                        <button onClick={fetchLogs} style={{ background: 'white', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </header>

                <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px', marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            className="search-input"
                            style={{ width: '100%' }}
                            placeholder="Search by name, phone, company, or notes..."
                            value={search}
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                    {isAdminOrTL && (
                        <div style={{ position: 'relative', minWidth: '240px' }}>
                            <select
                                className="input-field"
                                style={{ width: '100%', cursor: 'pointer', background: 'white' }}
                                value={executiveFilter}
                                onChange={e => setExecutiveFilter(e.target.value)}
                            >
                                <option value="all">👥 All Call Executives (Team)</option>
                                {executivesList.map(exec => (
                                    <option key={exec.UserID} value={exec.UserID}>
                                        👤 {exec.EmployeeName || exec.FullName} ({exec.EmployeeID || 'CE'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                        <input
                            type="date"
                            className="input-field"
                            style={{ width: '100%', paddingLeft: '44px', cursor: 'pointer', background: 'white' }}
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div 
                    ref={tableContainerRef}
                    className="glass-card hide-scrollbar" 
                    style={{ padding: '0', overflowX: 'auto', cursor: isDragging ? 'grabbing' : 'grab' }}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    {loading ? (
                        <div style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>
                            <Loader size={32} className="spin" style={{ marginBottom: '16px' }} />
                            <p>Loading your history...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>
                            <p>No call logs found for this period.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', color: '#1e293b', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '800', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '20px', width: '200px' }}>Date & Time</th>
                                    {isAdminOrTL && <th style={{ padding: '20px', width: '200px' }}>Executive</th>}
                                    <th style={{ padding: '20px', width: '250px' }}>Lead Details</th>
                                    <th style={{ padding: '20px', width: '180px' }}>Contact</th>
                                    <th style={{ padding: '20px', width: '150px' }}>Status</th>
                                    <th style={{ padding: '20px' }}>Call Note / Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(log => {
                                    const sc = statusColors[log.Status] || { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' };
                                    return (
                                        <tr key={log.HistoryID} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '20px', width: '200px' }}>
                                                {(() => {
                                                    // Fix for IST double-offset: treat server time as local
                                                    const date = new Date(log.CreatedAt.endsWith('Z') ? log.CreatedAt : log.CreatedAt + 'Z');
                                                    return (
                                                        <>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '600' }}>
                                                                <Calendar size={14} color="#6366f1" />
                                                                {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', marginLeft: '22px' }}>
                                                                {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            {isAdminOrTL && (
                                                <td style={{ padding: '20px', width: '200px' }}>
                                                    <div style={{ fontWeight: '700', color: '#4f46e5' }}>{log.ExecutiveName || 'Executive'}</div>
                                                    {log.ExecutiveEmpID && (
                                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                                            {log.ExecutiveEmpID}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td style={{ padding: '20px', width: '250px' }}>
                                                <div style={{ fontWeight: '700', color: '#1e293b' }}>{log.FullName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.CompanyName}</div>
                                            </td>
                                            <td style={{ padding: '20px', color: '#64748b', fontSize: '0.9rem', width: '180px' }}>{log.Phone}</td>
                                            <td style={{ padding: '20px', width: '150px' }}>
                                                <span style={{ padding: '6px 14px', background: sc.bg, color: sc.color, borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                                                    {log.Status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '20px', fontSize: '0.9rem', color: '#475569' }}>
                                                {log.CallNote}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallHistory;
