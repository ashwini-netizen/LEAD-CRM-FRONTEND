import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, Calendar, CheckCircle2, User, ArrowLeft, Building, Mail, Phone } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const ClientList = ({ user }) => {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await fetch(`${API_URL}/api/leads/status/Paid`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setClients(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, []);

    const filteredClients = clients.filter(c =>
        c.FullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.CompanyName && c.CompanyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        c.Phone.includes(searchTerm)
    );

    if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={40} className="spin" color="#6366f1" /></div>;

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
            <UserHeader user={user} title="Client Management" />

            <div className="client-list-container">
                <button onClick={() => navigate('/dashboard')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}><ArrowLeft size={18} /> Back to Dashboard</button>
                <header className="client-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 className="client-list-title" style={{ color: '#1e293b', margin: 0, marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Client List</h1>
                        <p className="client-list-subtitle" style={{ color: '#64748b', marginTop: '0', paddingLeft: '26px', margin: 0, fontSize: '0.9rem' }}>Manage all successfully converted and partially paid leads (Clients).</p>
                    </div>
                    <div className="total-clients-card">
                        <span className="total-clients-label" style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Total Clients:</span>
                        <span className="total-clients-value" style={{ color: '#10b981', fontWeight: '800', fontSize: '1.2rem', lineHeight: 1 }}>{clients.length}</span>
                    </div>
                </header>

                <div className="responsive-filter-bar" style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            className="search-input"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            placeholder="Search by name, company, or phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(stripEmojis(e.target.value))}
                        />
                    </div>

                </div>

                <div 
                    ref={tableContainerRef}
                    className="table-container hide-scrollbar" 
                    style={{ overflowX: 'auto', background: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', cursor: isDragging ? 'grabbing' : 'grab' }}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                <th style={{ padding: '16px 24px', width: '35%' }}>Client</th>
                                <th style={{ padding: '16px 24px', width: '30%' }}>Contact</th>
                                <th style={{ padding: '16px 24px', width: '15%' }}>Joined</th>
                                <th style={{ padding: '16px 24px', width: '10%' }}>Status</th>
                                <th style={{ padding: '16px 24px', textAlign: 'center', width: '10%' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map(client => (
                                <tr key={client.LeadID} className="table-row" style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                                    <td style={{ padding: '20px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '40px', height: '40px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                                                {client.FullName.charAt(0)}
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: '800', color: '#0f172a', fontSize: '1rem' }}>{client.FullName}</p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
                                                    <Building size={12} /> {client.CompanyName || 'No Company'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px 24px' }}>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: '700' }}>
                                            <Mail size={14} color="#6366f1" /> {client.Email || 'No Email'}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800' }}>
                                            <Phone size={14} color="#6366f1" /> {client.Phone}
                                        </p>
                                    </td>
                                    <td style={{ padding: '20px 24px', color: '#1e293b', fontSize: '0.9rem', fontWeight: '700' }}>
                                        {new Date(client.UpdatedAt).toLocaleDateString('en-GB')}
                                    </td>
                                    <td style={{ padding: '20px 24px' }}>
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            background: client.Status === 'Paid' ? '#dcfce7' : '#fef9c3',
                                            color: client.Status === 'Paid' ? '#166534' : '#854d0e',
                                            display: 'inline-block'
                                        }}>
                                            {client.Status === 'Paid' ? 'PAID CLIENT' : 'CLIENT (DUE)'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button onClick={() => navigate(`/leads/${client.LeadID}`, { state: { from: '/admin/clients', label: 'Client List' } })} className="action-btn secondary" style={{ padding: '8px 16px' }}>Profile</button>
                                            <button onClick={() => navigate(`/leads/manage/${client.LeadID}`, { state: { from: '/admin/clients', label: 'Client List' } })} className="action-btn primary" style={{ padding: '8px 16px' }}>Manage</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredClients.length === 0 && (
                    <div style={{ padding: '100px', textAlign: 'center', color: '#94a3b8' }}>
                        <CheckCircle2 size={40} style={{ marginBottom: '20px', opacity: 0.3 }} />
                        <p>No paid clients found matching your search.</p>
                    </div>
                )}
            </div>

            <style>{`
                .client-list-container {
                    padding: 40px;
                    padding-top: 30px;
                    max-width: 100%;
                    margin: 0;
                    flex: 1;
                    width: 100%;
                    box-sizing: border-box;
                    position: relative;
                }
                .client-list-header {
                    margin-bottom: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    position: relative;
                    gap: 16px;
                }
                .total-clients-card {
                    padding: 12px 24px;
                    background: white;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
                    flex-shrink: 0;
                }
                .glass-card { background: white; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; transition: 0.3s; }
                .table-row:hover { background: #f8fafc; }
                .table-container { animation: fadeUp 0.4s ease-out forwards; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .input-field { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 0.95rem; transition: 0.3s; }
                .input-field:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.1); }
                .action-btn { padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.85rem; border: none; }
                .action-btn.primary { background: #6366f1; color: white; }
                .action-btn.primary:hover { background: #4f46e5; }
                .action-btn.secondary { background: #f1f5f9; color: #475569; }
                .action-btn.secondary:hover { background: #e2e8f0; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .client-list-title { font-size: 2.5rem; }
                
                @media (max-width: 768px) {
                    .client-list-container {
                        padding: 16px;
                        padding-top: 16px;
                    }
                    .client-list-header {
                        flex-direction: column;
                        gap: 8px;
                        margin-bottom: 20px;
                    }
                    .client-list-title {
                        font-size: 1.8rem !important;
                    }
                    .client-list-subtitle {
                        display: none; /* Hide subtitle on mobile to save vertical screen space */
                    }
                    .total-clients-card {
                        position: absolute;
                        top: 0;
                        right: 0;
                        padding: 8px 16px;
                        border-radius: 12px;
                    }
                    .total-clients-label {
                        font-size: 0.65rem !important;
                    }
                    .total-clients-value {
                        font-size: 1.2rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ClientList;
