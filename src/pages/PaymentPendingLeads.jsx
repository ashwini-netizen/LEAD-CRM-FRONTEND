import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Eye, Search, FileText, CreditCard, ArrowLeft } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

export const getLeadPendingAmount = (lead) => {
    // 1. From breakdown if available
    if (lead?.BillingBreakdown) {
        try {
            const breakdown = typeof lead.BillingBreakdown === 'string' ? JSON.parse(lead.BillingBreakdown) : lead.BillingBreakdown;
            if (Array.isArray(breakdown) && breakdown.length > 0) {
                const breakdownPending = breakdown.reduce((sum, item) => {
                    const tot = parseFloat(item.total || 0);
                    const pd = parseFloat(item.paid || 0);
                    return sum + Math.max(0, tot - pd);
                }, 0);
                if (breakdownPending > 0) return breakdownPending;
            }
        } catch (e) {}
    }

    // 2. From LatestPendingAmount
    if (lead?.LatestPendingAmount !== null && lead?.LatestPendingAmount !== undefined) {
        const val = parseFloat(lead.LatestPendingAmount);
        if (!isNaN(val) && val > 0) return val;
    }

    // 3. Fallback: PaymentTotal - LatestPaidAmount
    const total = parseFloat(lead?.PaymentTotal || 0);
    const paid = parseFloat(lead?.LatestPaidAmount || lead?.PaidAmount || 0);
    if (total > 0 && (total - paid) > 0) {
        return total - paid;
    }

    return 0;
};

export const getLeadTotalAmount = (lead) => {
    if (lead?.PaymentTotal !== null && lead?.PaymentTotal !== undefined) {
        const val = parseFloat(lead.PaymentTotal);
        if (!isNaN(val) && val > 0) return val;
    }
    if (lead?.BillingBreakdown) {
        try {
            const breakdown = typeof lead.BillingBreakdown === 'string' ? JSON.parse(lead.BillingBreakdown) : lead.BillingBreakdown;
            if (Array.isArray(breakdown) && breakdown.length > 0) {
                const sum = breakdown.reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
                if (sum > 0) return sum;
            }
        } catch (e) {}
    }
    return 0;
};

const PaymentPendingLeads = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('Due Payments'); // 'Due Payments', 'Paid', 'Quoted', 'All'

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchPaymentPending = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads/payment-pending`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to fetch payment pending leads');
            const data = await res.json();
            setLeads(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaymentPending();
    }, []);

    // Filter out permanently removed or rejected leads from payment operations
    const activeLeads = useMemo(() => {
        return leads.filter(l => !['Removed', 'Rejected', 'Canceled'].includes(l.Status));
    }, [leads]);

    // Precalculate counts for tabs
    const tabCounts = useMemo(() => {
        let due = 0;
        let paid = 0;
        let quoted = 0;
        activeLeads.forEach(l => {
            const pending = getLeadPendingAmount(l);
            const total = getLeadTotalAmount(l);
            const isDue = (l.Status === 'Due Payment' || l.PaymentStatus === 'Due Payment' || pending > 0) && pending > 0 && l.Status !== 'Paid';
            const isPaid = (l.Status === 'Paid' || l.PaymentStatus === 'Paid' || (total > 0 && pending === 0)) && pending === 0;
            const isQuoted = ['Quotation', 'Quotation Needed', 'Quotation Done'].includes(l.Status);

            if (isDue) due++;
            if (isPaid) paid++;
            if (isQuoted) quoted++;
        });
        return { due, paid, quoted, all: activeLeads.length };
    }, [activeLeads]);

    const filtered = useMemo(() => {
        return activeLeads.filter(l => {
            const matchesSearch = l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
                (l.Phone && String(l.Phone).toLowerCase().includes(search.toLowerCase())) ||
                l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
                l.ServiceInterested?.toLowerCase().includes(search.toLowerCase());

            const pending = getLeadPendingAmount(l);
            const total = getLeadTotalAmount(l);

            let matchesTab = true;
            if (activeTab === 'Due Payments') {
                // Strictly leads with actual pending payment due
                matchesTab = (l.Status === 'Due Payment' || l.PaymentStatus === 'Due Payment' || pending > 0) && pending > 0 && l.Status !== 'Paid';
            } else if (activeTab === 'Paid') {
                matchesTab = (l.Status === 'Paid' || l.PaymentStatus === 'Paid' || (total > 0 && pending === 0)) && pending === 0;
            } else if (activeTab === 'Quoted') {
                matchesTab = ['Quotation', 'Quotation Needed', 'Quotation Done'].includes(l.Status);
            } else if (activeTab === 'All') {
                matchesTab = true;
            }

            return matchesSearch && matchesTab;
        });
    }, [activeLeads, search, activeTab]);

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Payments" />

            <div className="page-main-container" style={{ overflowY: 'auto' }}>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <header className="responsive-header">
                    <div>
                        <h1 style={{ color: '#1e293b', marginBottom: '4px', borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Payments</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', paddingLeft: '26px' }}>Review and manage client payments and outstanding balances.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ background: 'white', padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#6366f1' }}>
                            {filtered.length} Records
                        </span>
                        <button onClick={fetchPaymentPending} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
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
                            placeholder="Search by client, company, service, or phone..."
                            value={search}
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', background: '#f1f5f9', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveTab('Due Payments')}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: activeTab === 'Due Payments' ? '#fff' : 'transparent',
                            color: activeTab === 'Due Payments' ? '#6366f1' : '#64748b',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: activeTab === 'Due Payments' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                            transition: '0.2s',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Due Payments
                        {tabCounts.due > 0 && (
                            <span style={{
                                background: activeTab === 'Due Payments' ? '#ef4444' : '#fee2e2',
                                color: activeTab === 'Due Payments' ? '#fff' : '#b91c1c',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: '800'
                            }}>
                                {tabCounts.due}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('Paid')}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: activeTab === 'Paid' ? '#fff' : 'transparent',
                            color: activeTab === 'Paid' ? '#10b981' : '#64748b',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: activeTab === 'Paid' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                            transition: '0.2s',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Paid
                        {tabCounts.paid > 0 && (
                            <span style={{
                                background: activeTab === 'Paid' ? '#10b981' : '#d1fae5',
                                color: activeTab === 'Paid' ? '#fff' : '#047857',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: '800'
                            }}>
                                {tabCounts.paid}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('Quoted')}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: activeTab === 'Quoted' ? '#fff' : 'transparent',
                            color: activeTab === 'Quoted' ? '#6366f1' : '#64748b',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: activeTab === 'Quoted' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                            transition: '0.2s',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Quoted
                        {tabCounts.quoted > 0 && (
                            <span style={{
                                background: activeTab === 'Quoted' ? '#6366f1' : '#e0e7ff',
                                color: activeTab === 'Quoted' ? '#fff' : '#4338ca',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: '800'
                            }}>
                                {tabCounts.quoted}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('All')}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: activeTab === 'All' ? '#fff' : 'transparent',
                            color: activeTab === 'All' ? '#6366f1' : '#64748b',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: activeTab === 'All' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                            transition: '0.2s',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        All ({tabCounts.all})
                    </button>
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
                        <div style={{ padding: '80px', textAlign: 'center' }}><Loader size={24} className="animate-spin" /></div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
                            <p style={{ fontSize: '1rem', fontWeight: '600' }}>No {activeTab.toLowerCase()} records found</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>S.No</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>Client</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>Total Amount</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>Pending</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>Status</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>Due Date</th>
                                    <th style={{ padding: '16px 20px', textAlign: 'left' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((lead, index) => {
                                    let breakdown = [];
                                    try {
                                        if (lead.BillingBreakdown) {
                                            breakdown = typeof lead.BillingBreakdown === 'string' ? JSON.parse(lead.BillingBreakdown) : lead.BillingBreakdown;
                                        }
                                    } catch (e) {}
                                    const hasBreakdown = Array.isArray(breakdown) && breakdown.length > 0;
                                    const totalAmount = getLeadTotalAmount(lead);
                                    const pendingAmount = getLeadPendingAmount(lead);

                                    return (
                                        <tr key={lead.LeadID} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                                            <td style={{ padding: '16px 20px', color: '#64748b', fontWeight: '600' }}>{index + 1}</td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px', fontSize: '1rem' }}>{lead.FullName}</div>
                                                {hasBreakdown && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {breakdown.map((item, idx) => (
                                                            <div key={idx} style={{ fontSize: '0.75rem', color: '#6366f1', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                    <FileText size={10} style={{ marginRight: '4px' }} />
                                                                    {item.service}
                                                                </div>
                                                                {['Admin', 'Team Lead'].includes(user?.role) && item.invoiceNumber && (
                                                                    <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '0.65rem' }}>
                                                                        INV: {item.invoiceNumber}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {!hasBreakdown && lead.ServiceInterested && (
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{lead.ServiceInterested}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                {hasBreakdown ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {breakdown.map((item, idx) => (
                                                            <div key={idx} style={{ fontSize: '0.8rem', color: '#334155' }}>₹{Number(item.total || 0).toLocaleString()}</div>
                                                        ))}
                                                        <div style={{ fontWeight: '700', marginTop: '4px', borderTop: '1px solid #eee', paddingTop: '4px', color: '#0f172a' }}>
                                                            Total: ₹{totalAmount.toLocaleString()}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontWeight: '700', color: '#0f172a' }}>₹{totalAmount.toLocaleString()}</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                {hasBreakdown ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {breakdown.map((item, idx) => {
                                                            const itemPending = Math.max(0, (parseFloat(item.total || 0) - parseFloat(item.paid || 0)));
                                                            return (
                                                                <div key={idx} style={{ fontSize: '0.8rem', color: itemPending > 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                                                                    ₹{itemPending.toLocaleString()}
                                                                </div>
                                                            );
                                                        })}
                                                        <div style={{ fontWeight: '800', marginTop: '4px', borderTop: '1px solid #eee', paddingTop: '4px', color: pendingAmount > 0 ? '#ef4444' : '#10b981' }}>
                                                            Total: ₹{pendingAmount.toLocaleString()}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: pendingAmount > 0 ? '#ef4444' : '#10b981', fontWeight: '800' }}>
                                                        ₹{pendingAmount.toLocaleString()}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    background: lead.Status === 'Paid' ? '#ecfdf5' : (pendingAmount > 0 || lead.Status === 'Due Payment' ? '#fef2f2' : '#f1f5f9'),
                                                    color: lead.Status === 'Paid' ? '#047857' : (pendingAmount > 0 || lead.Status === 'Due Payment' ? '#b91c1c' : '#64748b'),
                                                    border: lead.Status === 'Paid' ? '1px solid #a7f3d0' : (pendingAmount > 0 || lead.Status === 'Due Payment' ? '1px solid #fecaca' : '1px solid #e2e8f0')
                                                }}>
                                                    {pendingAmount > 0 && lead.Status !== 'Due Payment' && lead.Status !== 'Paid' ? lead.Status : (pendingAmount > 0 ? 'Due Payment' : lead.Status)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px', color: '#64748b' }}>
                                                {hasBreakdown ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {breakdown.map((item, idx) => {
                                                            const itemPending = Math.max(0, (parseFloat(item.total || 0) - parseFloat(item.paid || 0)));
                                                            const isFullyPaid = itemPending <= 0;
                                                            return (
                                                                <div key={idx} style={{ fontSize: '0.8rem', fontWeight: '500', color: isFullyPaid ? '#10b981' : '#ef4444' }}>
                                                                    {isFullyPaid ? 'Paid' : (item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-IN') : 'N/A')}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontWeight: '500', color: pendingAmount > 0 && lead.DuePaymentDate ? '#ef4444' : '#64748b' }}>
                                                        {pendingAmount <= 0 ? 'Paid' : (lead.DuePaymentDate ? new Date(lead.DuePaymentDate).toLocaleDateString('en-IN') : 'N/A')}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <button
                                                    onClick={() => navigate(`/leads/manage/${lead.LeadID}`, { state: { from: '/leads/payment-pending', label: 'Payments' } })}
                                                    className="btn-primary"
                                                    style={{ padding: '8px 16px', fontSize: '0.8rem', width: 'auto' }}
                                                >
                                                    Manage
                                                </button>
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

export default PaymentPendingLeads;
