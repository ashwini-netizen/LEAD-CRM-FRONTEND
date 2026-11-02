import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Eye, Search, Calendar, Clock, UserPlus, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import AssignModal from '../components/AssignModal';
import { stripEmojis } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const statusColors = {
    'Interested': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Not Interested': { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
    'Follow-up': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Call Follow-up': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'meetingFollowup': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    'Meeting Follow-up': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
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

const MeetingFollowupLeads = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [selectingLead, setSelectingLead] = useState(null);

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const onAssign = (leadId, execId, execName, execRole) => {
        setLeads(prev => prev.map(l => l.LeadID === leadId ? { ...l, AssignedTo: execId, AssignedToName: execName, AssignedToRole: execRole } : l));
    };

    const fetchMeetingFollowups = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads/status/meetingFollowup?type=meeting`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch meetingFollowups');
            const data = await res.json();
            setLeads(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetingFollowups();
    }, []);

    const filtered = leads.filter(l =>
        l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
        (l.Phone && String(l.Phone).toLowerCase().includes(search.toLowerCase())) ||
        l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
        l.ServiceInterested?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Post-Meeting Management" />

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
                        <h1 style={{ color: '#1e293b', marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Meeting Follow-ups</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>Leads requiring follow-up after a successful meeting.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#6366f1' }}>
                            {leads.length} Active followups
                        </span>
                        <button onClick={fetchMeetingFollowups} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </header>

                <div className="responsive-filter-bar" style={{ marginBottom: '24px' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            className="search-input"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            placeholder="Search by name, company, service, or phone..."
                            value={search}
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div 
                    ref={tableContainerRef}
                    className="glass-card hide-scrollbar" 
                    style={{ padding: '0', overflowX: 'auto', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', cursor: isDragging ? 'grabbing' : 'grab' }}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    {loading ? (
                        <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} /> Loading post-meeting leads...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '80px', textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#94a3b8' }}>
                                <Search size={28} />
                            </div>
                            <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>No follow-ups found</h3>
                            <p style={{ color: '#94a3b8' }}>Either no leads are in "Followup" status or they don't match your search.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '20px' }}>Client / Company</th>
                                    <th style={{ padding: '20px' }}>Next Follow-up</th>
                                    <th style={{ padding: '20px' }}>Preferred Time</th>
                                    <th style={{ padding: '20px' }}>Status</th>
                                    <th style={{ padding: '20px' }}>Service</th>
                                    <th style={{ padding: '20px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(lead => (
                                    <tr key={lead.LeadID} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                                        <td style={{ padding: '20px' }}>
                                            <p style={{ fontWeight: '800', color: '#0f172a', marginBottom: '4px', fontSize: '1rem' }}>{lead.FullName}</p>
                                            <p style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: '700' }}>{lead.CompanyName || 'No Company'}</p>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '800' }}>
                                                <Calendar size={14} />
                                                {lead.MeetingFollowupDate ? new Date(lead.MeetingFollowupDate).toLocaleDateString('en-GB') : 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '800' }}>
                                                <Clock size={14} />
                                                {lead.MeetingFollowupTime || 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            {(() => {
                                                const sc = statusColors[lead.Status] || { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' };
                                                return (
                                                    <span style={{ 
                                                        padding: '6px 14px', 
                                                        background: sc.bg, 
                                                        color: sc.color, 
                                                        borderRadius: '20px', 
                                                        fontSize: '0.8rem', 
                                                        fontWeight: '800',
                                                        textTransform: 'capitalize',
                                                        whiteSpace: 'nowrap',
                                                        border: `1px solid ${sc.color}33`
                                                    }}>
                                                        {lead.Status}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#4f46e5', background: 'rgba(79, 70, 229, 0.08)', padding: '8px 14px', borderRadius: '20px', fontWeight: '800', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                                                {lead.ServiceInterested || 'N/A'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                            {user?.role === 'Team Lead' && (
                                                <button
                                                    onClick={() => setSelectingLead(lead)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        background: lead.AssignedTo ? 'rgba(16, 185, 129, 0.1)' : '#6366f1',
                                                        color: lead.AssignedTo ? '#10b981' : 'white',
                                                        border: lead.AssignedTo ? '1px solid rgba(16, 185, 129, 0.2)' : 'none',
                                                        padding: '8px 18px',
                                                        borderRadius: '10px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        transition: '0.2s'
                                                    }}
                                                >
                                                    <UserPlus size={16} /> {lead.AssignedTo ? 'Re-assign' : 'Assign'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => navigate(`/leads/manage/${lead.LeadID}`)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    background: 'white',
                                                    color: '#6366f1',
                                                    border: '1.5px solid #6366f1',
                                                    padding: '8px 18px',
                                                    borderRadius: '10px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    transition: '0.2s'
                                                }}
                                            >
                                                <Eye size={16} /> Manage
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
                    onlyField={true}
                />
            )}
        </div>
    );
};

export default MeetingFollowupLeads;
