import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Eye, Search, Calendar, Clock, UserPlus, Phone, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import AssignModal from '../components/AssignModal';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const statusColors = {
    'Interested': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Not Interested': { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
    'Follow-up': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Call Follow-up': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'meetingFollowup': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
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
    'not available': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Quotation': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Quotation Needed': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
};

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const LeadGenFollowupLeads = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [selectingLead, setSelectingLead] = useState(null);

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();
    
    // History Modal states
    const [showHistory, setShowHistory] = useState(false);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyDate, setHistoryDate] = useState('');
    const [totalCallsServer, setTotalCallsServer] = useState(0);

    const onAssign = (leadId, execId, execName, execRole) => {
        setLeads(prev => prev.map(l => l.LeadID === leadId ? { ...l, AssignedTo: execId, AssignedToName: execName, AssignedToRole: execRole } : l));
    };

    const fetchTotalCalls = async () => {
        console.log('[DEBUG] Fetching total calls for user:', user?.id || user?.UserID);
        try {
            const res = await fetch(`${API_URL}/api/leads/stats/total-calls`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log('[DEBUG] Total calls received:', data.totalCalls);
                setTotalCallsServer(data.totalCalls);
            } else {
                console.error('[DEBUG] Failed to fetch total calls:', await res.text());
            }
        } catch (err) { console.error(err); }
    };

    const fetchHistoryLogs = async (date = '') => {
        console.log('[DEBUG] Fetching history logs for date:', date || 'all');
        setHistoryLoading(true);
        try {
            const url = date ? `${API_URL}/api/leads/call-history?date=${date}` : `${API_URL}/api/leads/call-history`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (res.ok) {
                const logs = await res.json();
                console.log('[DEBUG] History logs received:', logs.length);
                setHistoryLogs(logs);
            } else {
                console.error('[DEBUG] Failed to fetch history:', await res.text());
            }
        } catch (err) { console.error(err); }
        finally { setHistoryLoading(false); }
    };

    const fetchLeadGenFollowups = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads/status/Call Follow-up?type=lead-gen`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch lead gen follow-ups');
            const data = await res.json();
            setLeads(data);
            fetchTotalCalls();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeadGenFollowups();
    }, []);

    const filtered = leads.filter(l => {
        const matchesSearch = l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
            (l.Phone && String(l.Phone).toLowerCase().includes(search.toLowerCase())) ||
            l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
            l.ServiceInterested?.toLowerCase().includes(search.toLowerCase());

        let matchesDate = true;
        if (dateFilter) {
            if (l.UpdatedAt) {
                const updateDateObj = new Date(l.UpdatedAt);
                const offset = updateDateObj.getTimezoneOffset();
                const localDateObj = new Date(updateDateObj.getTime() - (offset * 60 * 1000));
                const localDateStr = localDateObj.toISOString().split('T')[0];
                matchesDate = localDateStr === dateFilter;
            } else {
                matchesDate = false;
            }
        }

        return matchesSearch && matchesDate;
    });

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Pre-Meeting Nurturing" />

            <div className="page-main-container">
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <header className="responsive-header">
                    <div>
                        <h1 style={{ color: '#1e293b', marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Lead Gen Follow-up</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>Initial follow-ups set during lead creation (Pre-meeting).</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#10b981' }}>
                            {leads.length} Leads to Nurture
                        </span>
                        <button 
                            onClick={() => navigate('/leads/call-history')}
                            style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#6366f1', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                        >
                            <Phone size={16} /> {totalCallsServer} Total Calls
                        </button>
                        <button onClick={fetchLeadGenFollowups} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </header>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '30px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            className="search-input"
                            placeholder="Search by name, phone, company, or service..."
                            value={search}
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                    <div style={{ position: 'relative', minWidth: '200px' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                        <input
                            type="date"
                            className="input-field"
                            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '44px', cursor: 'pointer', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
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
                        <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '80px', textAlign: 'center' }}>
                            <p style={{ color: '#94a3b8' }}>No initial follow-up leads found.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', color: '#1e293b', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '16px 20px' }}>Lead Name</th>
                                    <th style={{ padding: '16px 20px' }}>Follow-up Date</th>
                                    <th style={{ padding: '16px 20px' }}>Preferred Time</th>
                                    <th style={{ padding: '16px 20px' }}>Company</th>
                                    <th style={{ padding: '16px 20px' }}>Status</th>
                                    <th style={{ padding: '16px 20px' }}>Assignment</th>
                                     <th style={{ padding: '16px 20px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(lead => (
                                    <tr key={lead.LeadID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a' }}>{lead.FullName}</td>
                                        <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '700' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={14} color="#10b981" />
                                                {lead.FollowupDate ? new Date(lead.FollowupDate).toLocaleDateString('en-GB') : 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '700' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Clock size={14} color="#6366f1" />
                                                {lead.FollowupTime || 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '800' }}>{lead.CompanyName || 'N/A'}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            {(() => {
                                                const sc = statusColors[lead.Status] || { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' };
                                                return (
                                                    <span style={{ 
                                                        padding: '6px 12px', 
                                                        background: sc.bg, 
                                                        color: sc.color, 
                                                        borderRadius: '20px', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: '800',
                                                        textTransform: 'capitalize',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {lead.Status}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            {lead.AssignedTo ? (
                                                <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '20px' }}>Assigned</span>
                                            ) : (
                                                <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: '600', padding: '4px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '20px' }}>Pending</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                            {user?.role === 'Team Lead' && (
                                                <button
                                                    onClick={() => setSelectingLead(lead)}
                                                    disabled={!!lead.AssignedTo}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        background: '#6366f1',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '8px 16px',
                                                        borderRadius: '8px',
                                                        fontWeight: '700',
                                                        cursor: lead.AssignedTo ? 'not-allowed' : 'pointer',
                                                        opacity: lead.AssignedTo ? 0.5 : 1
                                                    }}
                                                >
                                                    <UserPlus size={14} /> Assign
                                                </button>
                                            )}
                                            <button
                                                onClick={() => navigate(`/leads/call-manage/${lead.LeadID}`, { state: { from: '/leads/lead-gen-followup', label: 'Lead Gen Follow-ups' } })}
                                                disabled={user?.role === 'Team Lead' && !!lead.AssignedTo}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(16,185,129,0.1)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16,185,129,0.2)',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    fontWeight: '700',
                                                    cursor: (user?.role === 'Team Lead' && !!lead.AssignedTo) ? 'not-allowed' : 'pointer',
                                                    opacity: (user?.role === 'Team Lead' && !!lead.AssignedTo) ? 0.5 : 1
                                                }}
                                            >
                                                <Eye size={14} /> Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectingLead && (
                <AssignModal
                    lead={selectingLead}
                    onClose={() => setSelectingLead(null)}
                    onAssign={onAssign}
                />
            )}
        </div>
    );
};
export default LeadGenFollowupLeads;
