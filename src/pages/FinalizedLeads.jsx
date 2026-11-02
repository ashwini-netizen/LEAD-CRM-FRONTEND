import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Eye, Search, CheckCircle, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const FinalizedLeads = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchFinalizedLeads = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads/finalized`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch finalized leads');
            const data = await res.json();
            setLeads(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinalizedLeads();
    }, []);

    const filtered = leads.filter(l =>
        l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
        (l.Phone && String(l.Phone).toLowerCase().includes(search.toLowerCase())) ||
        l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
        l.ServiceInterested?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Finalized Leads Management" />

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
                        <h1 style={{ color: '#1e293b', marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Finalized Leads</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>Leads successfully closed or moved to quotation by you.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#10b981' }}>
                            {leads.length} Finalized
                        </span>
                        <button onClick={fetchFinalizedLeads} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
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
                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                            No finalized leads found.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '16px 20px' }}>S.No</th>
                                    <th style={{ padding: '16px 20px' }}>Lead Name</th>
                                    <th style={{ padding: '20px' }}>Company</th>
                                    <th style={{ padding: '20px' }}>Service</th>
                                    <th style={{ padding: '20px' }}>Assigned By</th>
                                    <th style={{ padding: '20px' }}>Status</th>
                                    <th style={{ padding: '20px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((lead, index) => (
                                    <tr key={lead.LeadID} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                                        <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>{index + 1}</td>
                                        <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a', fontSize: '1rem' }}>{lead.FullName}</td>
                                        <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '800' }}>{lead.CompanyName || 'N/A'}</td>
                                        <td style={{ padding: '16px 20px', color: '#4f46e5', fontWeight: '800' }}>{lead.ServiceInterested || 'N/A'}</td>
                                        <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '800' }}>{lead.AssignedByName || 'N/A'}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                padding: '6px 14px',
                                                background: lead.Status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                                color: lead.Status === 'Paid' ? '#10b981' : '#6366f1',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem',
                                                fontWeight: '800',
                                                border: `1px solid ${lead.Status === 'Paid' ? '#10b981' : '#6366f1'}33`
                                            }}>
                                                {lead.Status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => navigate(`/leads/${lead.LeadID}`, { state: { from: '/leads/finalized', label: 'Finalized Leads' } })}
                                                style={{
                                                    display: 'inline-flex',
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
                                                <Eye size={14} /> View Details
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

export default FinalizedLeads;
