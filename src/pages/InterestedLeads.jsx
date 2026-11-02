import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, UserPlus, Eye, Search, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import AssignModal from '../components/AssignModal';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const InterestedLeads = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [selectingLead, setSelectingLead] = useState(null);
    const [filterType, setFilterType] = useState('all');

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchInterestedLeads = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads/status/Interested`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch interested leads');
            const data = await res.json();
            setLeads(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterestedLeads();
    }, []);

    const onAssign = (leadId, execId, execName, execRole) => {
        setLeads(prev => prev.map(l => l.LeadID === leadId ? { ...l, AssignedTo: execId, AssignedToName: execName, AssignedToRole: execRole } : l));
    };

    const filtered = leads.filter(l => {
        const matchesSearch = l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
                              (l.Phone && String(l.Phone).toLowerCase().includes(search.toLowerCase())) ||
                              l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
                              l.ServiceInterested?.toLowerCase().includes(search.toLowerCase());

        let matchesFilter = true;
        if (filterType === 'call_executive') {
            matchesFilter = l.CreatorRole === 'Call Executive' && l.AssignedToRole === 'Field Executive';
        } else if (filterType === 'team_lead') {
            matchesFilter = l.CreatorRole === 'Team Lead';
        } else if (filterType === 'self') {
            matchesFilter = String(l.CreatedBy) === String(user?.id || user?.UserID);
        }

        return matchesSearch && matchesFilter;
    });

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Interested Leads Management" />

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
                        <h1 style={{ color: '#1e293b', marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Interested Leads</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>Newly generated leads waiting for meeting scheduling.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#6366f1' }}>
                            {leads.length} Active Leads
                        </span>
                        <button onClick={fetchInterestedLeads} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
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
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                    {(user?.role === 'Team Lead' || user?.role === 'Admin') && (
                        <div style={{ display: 'flex', gap: '5px', background: 'white', padding: '5px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setFilterType('all')}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', background: filterType === 'all' ? '#e0e7ff' : 'transparent', color: filterType === 'all' ? '#4f46e5' : '#64748b', transition: '0.2s' }}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilterType('call_executive')}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', background: filterType === 'call_executive' ? '#e0e7ff' : 'transparent', color: filterType === 'call_executive' ? '#4f46e5' : '#64748b', transition: '0.2s' }}
                            >
                                CE Leads
                            </button>
                            <button
                                onClick={() => setFilterType('team_lead')}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', background: filterType === 'team_lead' ? '#e0e7ff' : 'transparent', color: filterType === 'team_lead' ? '#4f46e5' : '#64748b', transition: '0.2s' }}
                            >
                                TL Leads
                            </button>
                        </div>
                    )}
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
                        <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                            No interested leads found.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '20px' }}>Lead Name</th>
                                    <th style={{ padding: '20px' }}>Company</th>
                                    <th style={{ padding: '20px' }}>Services</th>
                                    <th style={{ padding: '20px' }}>Created By</th>
                                    <th style={{ padding: '20px' }}>Status</th>
                                    <th style={{ padding: '20px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((lead, index) => (
                                     <tr key={lead.LeadID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                         <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a' }}>{lead.FullName}</td>
                                         <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '800' }}>{lead.CompanyName || 'N/A'}</td>
                                         <td style={{ padding: '16px 20px', color: '#4f46e5', fontWeight: '800' }}>{lead.ServiceInterested || 'N/A'}</td>
                                         <td style={{ padding: '16px 20px', color: '#6366f1', fontWeight: '600' }}>{lead.CreatorName || 'N/A'}</td>
                                         <td style={{ padding: '16px 20px' }}>
                                             {lead.AssignedToRole === 'Field Executive' ? (
                                                 <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '20px' }}>Assigned ({lead.AssignedToName})</span>
                                             ) : lead.AssignedToRole === 'Call Executive' ? (
                                                 <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: '600', padding: '4px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '20px' }}>Needs Field Exec</span>
                                             ) : (
                                                 <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: '600', padding: '4px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '20px' }}>Pending</span>
                                             )}
                                         </td>
                                         <td style={{ padding: '16px 20px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setSelectingLead(lead)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: '#6366f1',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <UserPlus size={14} /> Assign
                                            </button>
                                            <button
                                                onClick={() => navigate(`/leads/manage/${lead.LeadID}`)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(99,102,241,0.1)',
                                                    color: '#6366f1',
                                                    border: '1px solid rgba(99,102,241,0.2)',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
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

export default InterestedLeads;
