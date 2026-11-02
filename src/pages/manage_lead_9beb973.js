import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, Phone, Mail, Building, MapPin, Calendar, Clock, FileText, CheckCircle2, Upload, Send, XCircle, CreditCard } from 'lucide-react';
import UserHeader from '../components/UserHeader';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const formatTo12Hr = (time24) => {
    if (!time24) return null;
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
};

const ManageLead = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isBalancePayment, setIsBalancePayment] = useState(false);

    // Modal State
    const [outcome, setOutcome] = useState('Follow-up');
    const [notes, setNotes] = useState('');
    const [followupDate, setFollowupDate] = useState('');
    const [followupTime, setFollowupTime] = useState('');
    const [quotationFile, setQuotationFile] = useState(null);
    const [isMeetingCompleted, setIsMeetingCompleted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [prevMeeting, setPrevMeeting] = useState(null);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentTotal, setPaymentTotal] = useState('');
    const [paymentPaid, setPaymentPaid] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [paymentDue, setPaymentDue] = useState('');

    // Reject Modal State
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const fetchLead = async () => {
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}?t=${Date.now()}`, {
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
    };

    useEffect(() => {
        fetchLead();
    }, [id]);

    const handleAmountChange = (e, setter) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setter(val);
    };

    const handleAcceptPayment = async () => {
        const total = parseFloat(paymentTotal);
        const paidNow = parseFloat(paymentPaid);

        if (!paymentTotal || !paymentPaid || !paymentDate) return alert('Please fill in all payment details.');
        if (paidNow > total) return alert('Paid amount cannot exceed total amount.');

        const prevPaid = lead.payment ? parseFloat(lead.payment.PaidAmount) : 0;
        const newTotalPaid = isBalancePayment ? (prevPaid + paidNow) : paidNow;
        const newPending = total - newTotalPaid;

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({
                    leadId: id,
                    totalAmount: total,
                    paidAmount: newTotalPaid,
                    pendingAmount: newPending,
                    paymentDate: paymentDate,
                    duePaymentDate: newPending > 0 ? paymentDue : null,
                    notes: isBalancePayment ? `Balance payment of G�${paidNow} recorded.` : "Initial contract payment."
                })
            });

            if (!res.ok) throw new Error('Failed to record payment');
            const resData = await res.json();
            alert('Payment recorded successfully!');
            setShowPaymentModal(false);
            fetchLead();
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const openPaymentModal = () => {
        const pendingValue = parseFloat(lead.LatestPendingAmount || 0);
        if (pendingValue > 0) {
            setIsBalancePayment(true);
            setPaymentTotal(lead.PaymentTotal || '');
            setPaymentPaid('');
        } else {
            setIsBalancePayment(false);
            setPaymentTotal('');
            setPaymentPaid('');
        }
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setShowPaymentModal(true);
    };

    const handleAttendMeeting = async () => {
        if (!notes.trim()) return alert('Please enter meeting notes.');
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('notes', notes);
            formData.append('outcome', outcome);
            formData.append('isMeetingCompleted', isMeetingCompleted ? '1' : '0');

            if (outcome === 'Follow-up') {
                if (!followupDate) throw new Error('Please select Follow-up date.');
                formData.append('followupDate', followupDate);
                formData.append('followupTime', formatTo12Hr(followupTime));
            }
            if (outcome === 'quotation' && quotationFile) {
                formData.append('quotationPDF', quotationFile);
            }

            const res = await fetch(`${API_URL}/api/leads/${id}/attend-meeting`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` },
                body: formData
            });

            if (!res.ok) throw new Error('Failed to update status');
            alert('Lead finalized successfully!');
            setShowModal(false);
            fetchLead();
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '0.85rem' };

    if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={40} className="spin" color="#6366f1" /></div>;

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
            <UserHeader user={user} title="Manage Lead" />

            <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto', flex: 1, width: '100%' }}>
                <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '600', marginBottom: '10px' }}>G�� Back to Leads</button>
                        <h1 style={{ margin: 0 }}>Lead Strategy & Actions</h1>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ padding: '6px 16px', background: '#e0e7ff', color: '#6366f1', borderRadius: '20px', fontWeight: '800', fontSize: '0.8rem' }}>{lead.Status}</span>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '30px' }}>
                    <div className="glass-card" style={{ padding: '40px' }}>
                        <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}><Building size={20} color="#6366f1" /> Customer Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                            <div><p style={labelStyle}>Full Name</p><p style={{ fontSize: '1.2rem', fontWeight: '700' }}>{lead.FullName}</p></div>
                            <div><p style={labelStyle}>Company</p><p style={{ fontSize: '1.1rem', fontWeight: '600' }}>{lead.CompanyName || 'Not Specified'}</p></div>
                            <div><p style={labelStyle}>Phone</p><p style={{ fontWeight: '600' }}>{lead.Phone}</p></div>
                            <div><p style={labelStyle}>Email</p><p style={{ fontWeight: '600' }}>{lead.Email || 'No Email'}</p></div>
                        </div>

                        {parseFloat(lead.LatestPendingAmount) > 0 && (
                            <div style={{ marginTop: '30px', padding: '25px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Attention: Payment Pending</p>
                                        <h2 style={{ fontSize: '2.5rem', color: '#ef4444', margin: '5px 0' }}>G�{parseFloat(lead.LatestPendingAmount).toLocaleString()}</h2>
                                    </div>
                                    <button className="btn-primary" style={{ width: 'auto', padding: '12px 24px', background: '#ef4444' }} onClick={openPaymentModal}>Pay Now</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="glass-card" style={{ padding: '30px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Quick Actions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button className="btn-primary" onClick={() => setShowModal(true)}><Calendar size={18} /> Finalize Meeting</button>
                            {lead.Status === 'Quotation Needed' && <button className="btn-primary" style={{ background: '#10b981' }} onClick={() => setShowModal(true)}><FileText size={18} /> Upload Quotation</button>}
                            {(!lead.LatestPendingAmount || parseFloat(lead.LatestPendingAmount) === 0) && lead.Status !== 'Paid' && (
                                <button className="btn-primary" style={{ background: '#10b981' }} onClick={openPaymentModal}><CreditCard size={18} /> Record Sale</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Finalize Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{ marginBottom: '10px' }}>Meeting Outcome</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                            <span style={{ fontWeight: '700' }}>Meeting Done?</span>
                            <button onClick={() => setIsMeetingCompleted(!isMeetingCompleted)} className={`toggle-btn ${isMeetingCompleted ? 'active' : ''}`}>
                                <div className="toggle-handle" />
                            </button>
                        </div>

                        {isMeetingCompleted || lead.Status === 'Quotation Needed' ? (
                            <>
                                <label style={labelStyle}>Meeting Notes *</label>
                                <textarea className="input-field" style={{ height: '100px', marginBottom: '20px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Summary..." />

                                <label style={labelStyle}>Next Step</label>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                                    {['Follow-up', 'quotation', 'rejected'].map(opt => (
                                        <button key={opt} onClick={() => setOutcome(opt)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid', borderColor: outcome === opt ? '#6366f1' : '#f1f5f9', background: outcome === opt ? '#f5f7ff' : 'white', color: outcome === opt ? '#6366f1' : '#64748b', fontWeight: '800', cursor: 'pointer' }}>{opt.toUpperCase()}</button>
                                    ))}
                                </div>

                                <button className="btn-primary" onClick={handleAttendMeeting} disabled={submitting}>{submitting ? 'Processing...' : 'Submit Action'}</button>
                            </>
                        ) : (
                            <p style={{ textAlign: 'center', color: '#94a3b8', margin: '40px 0' }}>Toggle 'Meeting Done' to continue.</p>
                        )}
                        <button style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowModal(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{ marginBottom: '20px' }}>{isBalancePayment ? 'Record Balance Payment' : 'Record New Sale'}</h2>

                        <div style={{ display: 'grid', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Total Contract Amount</label>
                                <input className="input-field" value={paymentTotal} onChange={e => handleAmountChange(e, setPaymentTotal)} disabled={isBalancePayment} placeholder="G� 0" />
                            </div>
                            <div>
                                <label style={labelStyle}>Amount Being Paid Now</label>
                                <input className="input-field" value={paymentPaid} onChange={e => handleAmountChange(e, setPaymentPaid)} placeholder="G� 0" />
                            </div>
                            <div>
                                <label style={labelStyle}>Payment Date</label>
                                <input type="date" className="input-field" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                            </div>
                        </div>

                        <button className="btn-primary" style={{ marginTop: '30px' }} onClick={handleAcceptPayment} disabled={submitting}>Record Payment</button>
                        <button style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowPaymentModal(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; alignItems: center; justifyContent: center; backdrop-filter: blur(4px); }
                .modal-content { background: white; width: 500px; padding: 40px; borderRadius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                .toggle-btn { width: 54px; height: 28px; border-radius: 14px; background: #cbd5e1; border: none; cursor: pointer; position: relative; transition: 0.3s; }
                .toggle-btn.active { background: #10b981; }
                .toggle-handle { width: 22px; height: 22px; background: white; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: 0.3s; }
                .active .toggle-handle { left: 29px; }
            `}</style>
        </div>
    );
};

export default ManageLead;
