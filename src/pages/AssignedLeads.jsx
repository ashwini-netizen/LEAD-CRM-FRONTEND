import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Eye, Search, Calendar, Clock, UserCheck, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const AssignedLeads = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchAssignedLeads = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch assigned leads');
            const data = await res.json();
            
            // Filter leads assigned to this user and exclude meeting-stage leads
            const assigned = data.filter(l => {
                if (String(l.AssignedTo) !== String(user.id || user.UserID)) return false;
                // Exclude 'Interested' and post-meeting statuses from the Call Leads view
                const meetingStatuses = ['Interested', 'Meeting Attended', 'meetingFollowup', 'Quotation', 'Quotation Needed', 'Quotation Done', 'Due Payment', 'Paid'];
                return !meetingStatuses.includes(l.Status);
            });
            setLeads(assigned);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignedLeads();
    }, []);

    const filtered = leads.filter(l =>
        l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
        (l.Phone && String(l.Phone).toLowerCase().includes(search.toLowerCase())) ||
        l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
        l.ServiceInterested?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Assigned Leads" />

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
                        <h1 style={{ color: '#1e293b', marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>
                            {user?.role === 'Field Executive' ? 'Assigned Call Leads' : 'Assigned Leads'}
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>
                            {user?.role === 'Field Executive' 
                                ? 'Pre-meeting leads assigned to you for initial calls and follow-ups.' 
                                : 'Leads assigned to you by Team Leads for follow-up.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#6366f1' }}>
                            <UserCheck size={18} /> {leads.length} Assigned Leads
                        </span>
                        <button onClick={fetchAssignedLeads} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
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
                            placeholder="Search by name, phone, company, or service..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoComplete="off"
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
                            <p style={{ color: '#94a3b8' }}>No assigned leads found.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '20px' }}>Lead Name</th>
                                    <th style={{ padding: '20px' }}>Follow-up Date</th>
                                    <th style={{ padding: '20px' }}>Preferred Time</th>
                                    <th style={{ padding: '20px' }}>Status</th>
                                    <th style={{ padding: '20px' }}>Company</th>
                                    <th style={{ padding: '20px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(lead => (
                                    <tr key={lead.LeadID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '20px', fontWeight: '800', color: '#0f172a', fontSize: '1rem' }}>{lead.FullName}</td>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '800' }}>
                                                <Calendar size={14} />
                                                {lead.FollowupDate ? new Date(lead.FollowupDate).toLocaleDateString('en-GB') : 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '800' }}>
                                                <Clock size={14} />
                                                {lead.FollowupTime || 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: '800', padding: '6px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                                {lead.Status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px', color: '#1e293b', fontWeight: '800' }}>{lead.CompanyName || 'N/A'}</td>
                                        <td style={{ padding: '20px' }}>
                                            <button
                                                onClick={() => navigate(`/leads/call-manage/${lead.LeadID}`, { state: { from: '/leads/assigned', label: 'Assigned Leads' } })}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(99,102,241,0.1)',
                                                    color: '#6366f1',
                                                    border: '1px solid rgba(99,102,241,0.2)',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer'
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
        </div>
    );
};

export default AssignedLeads;
