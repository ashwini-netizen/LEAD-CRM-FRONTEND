import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Loader, AlertCircle, Calendar, Clock, FileText, Building, Phone, Mail } from 'lucide-react';
import MeetingModal from '../components/MeetingModal';
import UserHeader from '../components/UserHeader';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const LeadDetail = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showMeetingModal, setShowMeetingModal] = useState(false);

    const fetchLead = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Lead not found');
            const data = await res.json();
            setLead(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchLead();
    }, [fetchLead]);

    const handleMeetingSuccess = () => {
        setShowMeetingModal(false);
        fetchLead();
    };

    if (loading) return (
        <div style={{ padding: '100px', textAlign: 'center' }}>
            <Loader size={40} className="ld-spin" />
        </div>
    );

    if (error || !lead) {
        return (
            <div style={{ padding: '100px', textAlign: 'center', color: '#ef4444' }}>
                <AlertCircle size={40} style={{ marginBottom: '20px' }} />
                <h3>Error Loading Lead</h3>
                <p style={{ color: '#94a3b8', margin: '15px 0' }}>{error || 'Lead not found'}</p>
                <button className="btn-secondary" onClick={() => navigate(location.state?.from || '/leads', { replace: true })}>Back to {location.state?.label || 'list'}</button>
            </div>
        );
    }

    const getInvoiceNumbers = (breakdownStr) => {
        if (!breakdownStr) return [];
        try {
            const breakdown = JSON.parse(breakdownStr);
            if (!Array.isArray(breakdown)) return [];
            return [...new Set(breakdown.map(item => item.invoiceNumber).filter(Boolean))];
        } catch (e) {
            return [];
        }
    };

    const steps = [
        { label: 'Created',           done: !!lead.CreatedAt },
        { label: 'Interested',        done: lead.Status !== 'Not Interested' && lead.Status !== 'Busy' && lead.Status !== 'Invalid' },
        { label: 'Meeting Scheduled', done: lead.Status === 'Meeting Scheduled' || lead.Status === 'Meeting Done' || lead.Status === 'Meeting Attended' || lead.meetings?.length > 0 },
        { label: 'Quotation Sent',    done: lead.Status === 'Quotation Sent' || lead.Status === 'Quotation' || lead.Status === 'Due Payment' || lead.Status === 'Paid' || !!lead.QuotationPDF },
        { label: 'Converted',         done: lead.Status === 'Converted' || lead.Status === 'Paid' || lead.Status === 'Due Payment' }
    ];

    const statusIsPaid = lead.Status === 'Meeting Done';

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Lead Details" />

            {/* Slide-in content wrapper */}
            <div className="ld-content ld-slide-in" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

                <button
                    onClick={() => navigate(location.state?.from || '/leads', { replace: true })}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', width: 'fit-content' }}
                >
                    <ChevronLeft size={20} /> Back to {location.state?.label || 'list'}
                </button>

                {/* Two-column grid for Admin, single-column for others */}
                <div className={user?.role === 'Admin' ? 'ld-grid' : 'ld-grid-full'}>

                    {/* ── LEFT / MAIN COLUMN ── */}
                    <div>

                        {/* Header card */}
                        <div className="glass-card" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h1 className="ld-name">{lead.FullName}</h1>
                                    <div className="ld-contacts">
                                        <span style={IR}><Building size={13} /> {lead.CompanyName || 'N/A'}</span>
                                        <span style={IR}><Mail size={13} /> {lead.Email || 'N/A'}</span>
                                        <span style={IR}><Phone size={13} /> {lead.Phone || 'N/A'}</span>
                                    </div>
                                </div>
                                <span style={{
                                    padding: '6px 14px',
                                    background: statusIsPaid ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                    color: statusIsPaid ? '#10b981' : '#6366f1',
                                    borderRadius: '30px',
                                    fontWeight: '800',
                                    fontSize: '0.82rem',
                                    flexShrink: 0,
                                    alignSelf: 'flex-start'
                                }}>
                                    {lead.Status}
                                </span>
                            </div>

                            {/* Step progress tracker */}
                            <div className="ld-steps">
                                {steps.map((step, i) => (
                                    <div key={i} className="ld-step" style={{ opacity: step.done ? 1 : 0.3 }}>
                                        <div style={{
                                            width: '30px', height: '30px',
                                            background: step.done ? '#6366f1' : '#e2e8f0',
                                            borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', flexShrink: 0
                                        }}>
                                            {step.done
                                                ? <CheckCircle2 size={15} />
                                                : <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>{i + 1}</span>
                                            }
                                        </div>
                                        <span className="ld-step-label">{step.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Creation Details */}
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Creation Details</h3>
                                <div className="ld-creation-row">
                                    <div>
                                        <label style={LBL}>Created By</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                            <div style={{ width: '22px', height: '22px', background: '#6366f1', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0 }}>
                                                {lead.CreatorName?.charAt(0)}
                                            </div>
                                            <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{lead.CreatorName} ({lead.CreatorRole})</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={LBL}>Employee ID</label>
                                        <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{lead.CreatorEmployeeID}</span>
                                    </div>
                                    <div>
                                        <label style={LBL}>Date</label>
                                        <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>{new Date(lead.CreatedAt).toLocaleDateString('en-GB')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Details */}
                            {getInvoiceNumbers(lead.payment?.BillingBreakdown).length > 0 && (
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '20px' }}>
                                    <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>Invoiced Details</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {getInvoiceNumbers(lead.payment?.BillingBreakdown).map((inv, idx) => (
                                            <div key={idx} style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                                <span style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', display: 'block', marginBottom: '3px' }}>Invoice Number</span>
                                                <span style={{ color: '#4338ca', fontWeight: '800', fontSize: '0.95rem' }}>{inv}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Meeting & Activity History */}
                        {user.role !== 'Call Executive' && (
                            <div className="glass-card">
                                <h3 style={{ marginBottom: '16px', fontSize: '1rem' }}>Meeting &amp; Activity History</h3>
                                {lead.meetings?.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {lead.meetings.map((m, i) => (
                                            <div key={i} style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #6366f1' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                        <span style={IR}><Calendar size={13} /> {new Date(m.MeetingDate).toLocaleDateString('en-GB')}</span>
                                                        <span style={IR}><Clock size={13} /> {m.MeetingTime}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#6366f1' }}>{m.InterestLevel}</span>
                                                </div>
                                                <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: '1.5', margin: 0 }}>{m.MeetingNotes}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                                        <Calendar size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                        <p style={{ margin: 0 }}>No meetings recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT / SIDEBAR — moves BELOW on mobile ── */}
                    <div>
                        {user.role === 'Admin' && (
                            <div className="glass-card" style={{ marginBottom: '20px' }}>
                                <h3 style={{ marginBottom: '14px', fontSize: '1rem' }}>Status Tracking</h3>
                                <div style={{ marginBottom: '14px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                                    <label style={LBL}>Current Interest Level</label>
                                    <p style={{ fontSize: '1rem', fontWeight: '700', margin: '4px 0 0 0' }}>
                                        {lead.meetings?.length > 0 ? lead.meetings[0].InterestLevel : 'Warm'}
                                    </p>
                                </div>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    <IconItem icon={<CheckCircle2 size={15} />} text="Meeting Attained"    done={lead.meetings?.length > 0} />
                                    <IconItem icon={<FileText size={15} />}     text="Quotation Requested" done={lead.meetings?.some(m => m.MeetingOutcome === 'quotation') || !!lead.QuotationPDF || lead.Status === 'Quotation Needed' || lead.Status === 'Quotation'} />
                                    <IconItem icon={<CheckCircle2 size={15} />} text="Deal Closed"         done={lead.Status === 'Converted' || lead.Status === 'Paid' || lead.Status === 'Due Payment'} />
                                </div>
                            </div>
                        )}

                        {parseFloat(lead.LatestPendingAmount) > 0 && (
                            <div className="glass-card" style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
                                <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '1rem' }}>
                                    <AlertCircle size={18} /> Due Payment
                                </h3>
                                <div style={{ marginTop: '14px', padding: '12px', background: 'white', borderRadius: '10px' }}>
                                    <label style={{ ...LBL, fontWeight: '700' }}>Pending Amount</label>
                                    <h2 style={{ fontSize: '1.7rem', color: '#ef4444', margin: '4px 0' }}>
                                        ₹{parseFloat(lead.LatestPendingAmount).toLocaleString()}
                                    </h2>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        Project Total: ₹{parseFloat(lead.PaymentTotal || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {showMeetingModal && (
                <MeetingModal
                    leadId={id}
                    onClose={() => setShowMeetingModal(false)}
                    onSuccess={handleMeetingSuccess}
                />
            )}

            <style>{`
                /* ── Slide-in page entrance animation ── */
                @keyframes ld-slide-in-right {
                    from { opacity: 0; transform: translateX(36px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .ld-slide-in {
                    animation: ld-slide-in-right 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
                }

                /* ── Content wrapper ── */
                .ld-content {
                    padding: 32px 40px;
                    max-width: 100vw;
                    margin: 0;
                    flex: 1;
                    width: 100%;
                    box-sizing: border-box;
                    overflow-x: hidden;
                }

                /* ── Two-column grid → collapses on mobile ── */
                .ld-grid {
                    display: grid;
                    grid-template-columns: 1fr minmax(320px, 420px);
                    gap: 28px;
                    align-items: start;
                    width: 100%;
                }
                /* Single-column full-width grid for non-Admin roles */
                .ld-grid-full {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 24px;
                    align-items: start;
                    width: 100%;
                }

                /* ── Lead name ── */
                .ld-name {
                    font-size: 1.75rem;
                    margin: 0 0 8px 0;
                    word-break: break-word;
                }

                /* ── Contact chips row — wraps on mobile ── */
                .ld-contacts {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    color: #64748b;
                    font-size: 0.82rem;
                }

                /* ── Step tracker ── */
                .ld-steps {
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 10px;
                    padding: 16px;
                    background: rgba(99,102,241,0.03);
                    border-radius: 14px;
                    margin-bottom: 20px;
                }
                .ld-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 7px;
                    min-width: 50px;
                }
                .ld-step-label {
                    font-size: 0.66rem;
                    font-weight: 700;
                    text-align: center;
                    max-width: 60px;
                    line-height: 1.25;
                    color: #1e293b;
                }

                /* ── Creation row ── */
                .ld-creation-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 24px;
                }

                /* ── Mobile ── */
                @media (max-width: 768px) {
                    .ld-content {
                        padding: 14px 14px 24px;
                    }
                    .ld-grid {
                        grid-template-columns: 1fr !important;
                        gap: 16px;
                    }
                    .ld-name {
                        font-size: 1.3rem !important;
                    }
                    .ld-steps {
                        justify-content: space-around;
                        padding: 12px 8px;
                        gap: 6px;
                    }
                    .ld-step-label {
                        font-size: 0.6rem;
                    }
                    .ld-creation-row {
                        gap: 16px;
                    }
                }

                .ld-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

/* ── Shared style constants ── */
const IR  = { display: 'flex', alignItems: 'center', gap: '5px' };
const LBL = { fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' };

const IconItem = ({ icon, text, done }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: done ? '#10b981' : '#94a3b8', fontSize: '0.83rem', fontWeight: '600' }}>
        {icon} <span>{text}</span>
    </div>
);

export default LeadDetail;
