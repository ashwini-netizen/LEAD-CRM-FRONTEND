import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader, AlertCircle, Phone, Mail, Building, Save, Clock, Calendar, ArrowLeft, Edit, X } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { cleanPhoneNumber, validatePhoneNumber } from '../utils/stringUtils';
import { formatCleanTime } from '../utils/notificationSync';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const RESTRICTED_DUPLICATE_STATUSES = ['wrong number', 'direct visit'];
const isRestrictedDuplicateStatus = (s) => {
    if (!s) return false;
    const norm = s.trim().toLowerCase();
    return RESTRICTED_DUPLICATE_STATUSES.some(r => norm === r || norm.includes(r));
};

const checkDuplicateStatus = (candidateStatus, lead) => {
    if (!candidateStatus || !isRestrictedDuplicateStatus(candidateStatus)) return null;
    const pastStatuses = [
        lead?.Status,
        ...(lead?.callHistory?.map(h => h.Status) || [])
    ].filter(Boolean);

    const match = pastStatuses.find(ps => {
        const pNorm = ps.trim().toLowerCase();
        const rNorm = candidateStatus.trim().toLowerCase();
        if (pNorm === rNorm) return true;
        if (rNorm.includes('wrong number') && (pNorm.includes('wrong number') || pNorm.includes('contact number is wrong'))) return true;
        if (rNorm.includes('direct visit') && (pNorm.includes('direct visit') || pNorm.includes('direct vist'))) return true;
        return false;
    });

    if (match) {
        const displayName = candidateStatus.toLowerCase().includes('wrong number') ? 'Wrong Number' : 'Direct Visit';
        return `Status "${displayName}" has already been added for this lead. Duplicate entries for this status are not allowed.`;
    }
    return null;
};


const formatTo12Hr = (time) => {
    if (!time) return null;
    return formatCleanTime(time);
};

const parseTime24 = (timeStr) => {
    if (!timeStr) return { hour12: '', minute: '00', ampm: 'AM' };
    const clean = formatCleanTime(timeStr);
    const is12Hr = /am|pm/i.test(clean);
    if (is12Hr) {
        const ampmMatch = clean.match(/\b(AM|PM)\b/i);
        const ampm = ampmMatch ? ampmMatch[1].toUpperCase() : 'AM';
        const timePart = clean.replace(/\b(AM|PM)\b/gi, '').trim();
        const [hStr, mStr] = timePart.split(':');
        const h = parseInt(hStr, 10) || 12;
        return {
            hour12: String(h),
            minute: (mStr || '00').padStart(2, '0'),
            ampm
        };
    } else {
        const [hStr, mStr] = clean.split(':');
        let h = parseInt(hStr, 10) || 0;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return {
            hour12: String(h),
            minute: (mStr || '00').padStart(2, '0'),
            ampm
        };
    }
};

const formatTime24 = (hour12, minute, ampm) => {
    if (!hour12) return '';
    let h = parseInt(hour12);
    if (ampm === 'PM' && h !== 12) {
        h += 12;
    } else if (ampm === 'AM' && h === 12) {
        h = 0;
    }
    const hStr = String(h).padStart(2, '0');
    return `${hStr}:${minute || '00'}`;
};

const CallFollowupManage = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const backPath = location.state?.from || '/leads';
    const backLabel = location.state?.label || 'Leads';
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form State
    const [callNote, setCallNote] = useState('');
    const [status, setStatus] = useState('Follow-up');
    const [followupDate, setFollowupDate] = useState('');
    const [followupTime, setFollowupTime] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingTime, setMeetingTime] = useState('');
    const [services, setServices] = useState([{ type: '', custom: '' }]);
    const [customStatus, setCustomStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [savingNote, setSavingNote] = useState(false);

    // Client Edit State
    const [isEditingClient, setIsEditingClient] = useState(false);
    const [editPhone, setEditPhone] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editCompany, setEditCompany] = useState('');
    const [editSpecificCompany, setEditSpecificCompany] = useState('');
    const [editAlternatePhone, setEditAlternatePhone] = useState('');
    const [updatingClient, setUpdatingClient] = useState(false);

    useEffect(() => {
        const fetchLead = async () => {
            // Remove any stale cache values from storage before refetching
            localStorage.removeItem(`lead_cache_${id}`);
            sessionStorage.removeItem(`lead_cache_${id}`);
            try {
                const res = await fetch(`${API_URL}/api/leads/${id}?t=${Date.now()}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                });
                if (!res.ok) throw new Error('Lead not found');
                const data = await res.json();
                setLead(data);
                setCallNote(data.CallNote || '');
                setStatus(data.Status || 'Follow-up');
                
                if (data.FollowupDate) {
                    setFollowupDate(data.FollowupDate.split('T')[0]);
                }
                if (data.FollowupTime) {
                    setFollowupTime(formatCleanTime(data.FollowupTime));
                }
                if (data.MeetingDate) {
                    setMeetingDate(data.MeetingDate.split('T')[0]);
                }
                if (data.MeetingTime) {
                    setMeetingTime(formatCleanTime(data.MeetingTime));
                }
                if (data.ServiceInterested) {
                    const svcList = data.ServiceInterested.split(',').map(s => s.trim()).filter(Boolean);
                    if (svcList.length > 0) {
                        const standardTypes = [
                            'Website Development',
                            'Web Application development',
                            'Digital Marketing',
                            'Android/ios Application development',
                            'SEO',
                            'Graphic Design',
                            'IVR service'
                        ];
                        const svcObjects = svcList.map(s => {
                            if (standardTypes.includes(s)) {
                                return { type: s, custom: '' };
                            } else {
                                return { type: 'Other', custom: s };
                            }
                        });
                        setServices(svcObjects);
                    }
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLead();
    }, [id]);

    const handleServiceChange = (index, field, value) => {
        const newServices = [...services];
        newServices[index][field] = value;
        setServices(newServices);
    };

    const addService = () => setServices([...services, { type: '', custom: '' }]);
    const removeService = (index) => setServices(services.filter((_, i) => i !== index));

    const handleSaveNoteOnly = async () => {
        if (!callNote.trim()) return;
        if ((user?.role === 'Call Executive' || user?.role === 'Field Executive') && !user?.IsOnline) {
            return alert('Please turn on online status to perform activities.');
        }
        setSavingNote(true);
        try {
            const serviceSummary = status === 'Interested'
                ? services.map(s => s.type === 'Other' ? s.custom : s.type).filter(Boolean).join(', ')
                : '';

            const resolvedStatus = status === 'other' 
                ? (customStatus.trim().toLowerCase() === 'converted' || customStatus.trim().toLowerCase() === 'conversion' ? 'Converted' : customStatus.trim())
                : status;

            if (status === 'other' && !customStatus.trim()) {
                setSavingNote(false);
                return alert('Please enter a specific lead status.');
            }

            const dupError = checkDuplicateStatus(resolvedStatus, lead);
            if (dupError) {
                setSavingNote(false);
                return alert(dupError);
            }

            const payload = {
                status: resolvedStatus,
                callNote: callNote,
                serviceInterested: serviceSummary,
                followupDate: status === 'Follow-up' ? followupDate : null,
                followupTime: status === 'Follow-up' ? formatTo12Hr(followupTime) : null,
                meetingDate: status === 'Interested' ? meetingDate : null,
                meetingTime: status === 'Interested' ? formatTo12Hr(meetingTime) : null
            };

            const res = await fetch(`${API_URL}/api/leads/${id}/call-update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || 'Failed to save call note');
            }

            // Invalidate cache storage keys
            localStorage.removeItem(`lead_cache_${id}`);
            sessionStorage.removeItem(`lead_cache_${id}`);

            // Update local state immediately
            if (lead) {
                setLead(prev => ({
                    ...prev,
                    CallNote: callNote,
                    Status: resolvedStatus,
                    callHistory: [
                        { Status: resolvedStatus, CallNote: callNote, CreatedAt: new Date().toISOString() },
                        ...(prev.callHistory || [])
                    ]
                }));
            }

            window.dispatchEvent(new Event('lead_updated'));
            alert('Call note saved successfully');
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingNote(false);
        }
    };

    const handleSaveClient = async () => {
        if (!editPhone || !editEmail || !editCompany) {
            return alert('Please fill all required fields (Primary Phone, Email, Company Type).');
        }

        const primaryPhoneValidation = validatePhoneNumber(editPhone, 'Primary Phone');
        if (!primaryPhoneValidation.isValid) {
            return alert(primaryPhoneValidation.message);
        }
        const cleanedPhone = primaryPhoneValidation.cleaned;

        let cleanedAltPhone = '';
        if (editAlternatePhone && editAlternatePhone.trim()) {
            const altPhoneValidation = validatePhoneNumber(editAlternatePhone, 'Alternate Phone');
            if (!altPhoneValidation.isValid) {
                return alert(altPhoneValidation.message);
            }
            cleanedAltPhone = altPhoneValidation.cleaned;
            if (cleanedAltPhone === cleanedPhone) {
                return alert('Alternate Phone number cannot be the same as Primary Phone number.');
            }
        }

        // Email validation (lowercase, must contain exactly one @ and end with .com)
        const cleanedEmail = editEmail.trim().replace(/\s/g, '').toLowerCase();
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
        if (!emailRegex.test(cleanedEmail)) {
            return alert('Please enter a valid email address (lowercase ending in .com).');
        }

        if (editCompany.trim().length < 2) {
            return alert('Company Type must be at least 2 characters long.');
        }
        const companyRegex = /^[A-Za-z0-9\s.,&()'-]+$/;
        if (!companyRegex.test(editCompany)) {
            return alert('Company Type should contain only letters, numbers, spaces, and standard punctuation (.,&()\'-).');
        }
        if (/^\d+$/.test(editCompany.trim())) {
            return alert('Company Type cannot be solely numeric.');
        }

        if ((user?.role === 'Call Executive' || user?.role === 'Field Executive') && !user?.IsOnline) {
            return alert('Please turn on online status to perform activities.');
        }

        setUpdatingClient(true);
        try {
            const payload = {
                fullName: lead.FullName,
                phone: cleanedPhone,
                alternatePhone: cleanedAltPhone || null,
                email: cleanedEmail,
                companyName: editCompany.trim(),
                companyType: editCompany.trim(),
                specificCompanyName: editSpecificCompany ? editSpecificCompany.trim() : null,
                address: lead.Address || ''
            };

            const res = await fetch(`${API_URL}/api/leads/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to update client details');
            }

            // Invalidate cache storage keys
            localStorage.removeItem(`lead_cache_${id}`);
            sessionStorage.removeItem(`lead_cache_${id}`);

            // Update local state immediately
            setLead(prev => ({
                ...prev,
                Phone: cleanedPhone,
                AlternatePhone: cleanedAltPhone || '',
                Email: cleanedEmail,
                CompanyName: editCompany.trim(),
                CompanyType: editCompany.trim(),
                SpecificCompanyName: editSpecificCompany ? editSpecificCompany.trim() : ''
            }));

            setIsEditingClient(false);
            alert('Client details updated successfully!');
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdatingClient(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if ((user?.role === 'Call Executive' || user?.role === 'Field Executive') && !user?.IsOnline) {
            return alert('Please turn on online status to perform activities.');
        }
        setSubmitting(true);
        try {
            const serviceSummary = status === 'Interested'
                ? services.map(s => s.type === 'Other' ? s.custom : s.type).filter(Boolean).join(', ')
                : '';

            const resolvedStatus = status === 'other' 
                ? (customStatus.trim().toLowerCase() === 'converted' || customStatus.trim().toLowerCase() === 'conversion' ? 'Converted' : customStatus.trim())
                : status;

            if (status === 'other' && !customStatus.trim()) {
                setSubmitting(false);
                return alert('Please enter a specific lead status.');
            }

            const dupError = checkDuplicateStatus(resolvedStatus, lead);
            if (dupError) {
                setSubmitting(false);
                return alert(dupError);
            }

            const payload = {
                status: resolvedStatus,
                callNote: callNote,
                serviceInterested: serviceSummary,
                followupDate: status === 'Follow-up' ? followupDate : null,
                followupTime: status === 'Follow-up' ? formatTo12Hr(followupTime) : null,
                meetingDate: status === 'Interested' ? meetingDate : null,
                meetingTime: status === 'Interested' ? formatTo12Hr(meetingTime) : null
            };

            const res = await fetch(`${API_URL}/api/leads/${id}/call-update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || 'Failed to update lead');
            }

            // Clear any potential stale cached items in localStorage/sessionStorage
            localStorage.removeItem(`lead_cache_${id}`);
            sessionStorage.removeItem(`lead_cache_${id}`);

            // Update the local React state with the newly saved values immediately
            const updatedCallNote = payload.callNote;
            const updatedStatus = payload.status;
            setCallNote(updatedCallNote);
            setStatus(updatedStatus);
            if (lead) {
                setLead(prev => ({
                    ...prev,
                    CallNote: updatedCallNote,
                    Status: updatedStatus,
                    callHistory: [
                        { Status: updatedStatus, CallNote: updatedCallNote, CreatedAt: new Date().toISOString() },
                        ...(prev.callHistory || [])
                    ]
                }));
            }

            window.dispatchEvent(new Event('lead_updated'));
            alert('Lead updated successfully');
            navigate(backPath, { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader size={40} className="spin" color="#6366f1" />
        </div>
    );

    if (error || !lead) return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <AlertCircle size={48} color="#ef4444" />
            <p>{error || 'Lead not found'}</p>
            <button className="btn-secondary" onClick={() => navigate(backPath)}>Back to {backLabel}</button>
        </div>
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
            <UserHeader user={user} title="Manage Follow-up" />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1, width: '100%' }}>
                <button 
                    onClick={() => navigate(backPath)} 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                >
                    <ArrowLeft size={18} /> Back to {backLabel}
                </button>
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#1e293b', marginBottom: '10px' }}>Update Follow-up: {lead.FullName}</h1>
                    <p style={{ color: '#64748b' }}>
                        {lead.CompanyName || lead.CompanyType}
                        {lead.SpecificCompanyName ? ` • ${lead.SpecificCompanyName}` : ''}
                        {lead.Phone ? ` • ${lead.Phone}` : ''}
                        {lead.AlternatePhone ? ` • Alt: ${lead.AlternatePhone}` : ''}
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
                    <div className="glass-card" style={{ padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Client Overview</h3>
                            {!isEditingClient && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditPhone(cleanPhoneNumber(lead.Phone) || lead.Phone || '');
                                        setEditAlternatePhone(cleanPhoneNumber(lead.AlternatePhone) || lead.AlternatePhone || '');
                                        setEditEmail(lead.Email || '');
                                        setEditCompany(lead.CompanyName || lead.CompanyType || '');
                                        setEditSpecificCompany(lead.SpecificCompanyName || '');
                                        setIsEditingClient(true);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6366f1',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        padding: 0
                                    }}
                                >
                                    <Edit size={16} /> Edit
                                </button>
                            )}
                        </div>

                        {isEditingClient ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={labelStyle}><Phone size={14} style={{ marginRight: '5px' }} /> Primary Phone *</label>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        className="input-field"
                                        value={editPhone}
                                        onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="10-digit Primary Phone Number"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}><Phone size={14} style={{ marginRight: '5px' }} /> Alternate Phone Number</label>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        className="input-field"
                                        value={editAlternatePhone}
                                        onChange={e => setEditAlternatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="10-digit Alternate Phone (Optional)"
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}><Mail size={14} style={{ marginRight: '5px' }} /> Email *</label>
                                    <input
                                        type="email"
                                        className="input-field"
                                        value={editEmail}
                                        onChange={e => setEditEmail(e.target.value)}
                                        placeholder="Email Address"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}><Building size={14} style={{ marginRight: '5px' }} /> Company Type *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={editCompany}
                                        onChange={e => setEditCompany(e.target.value)}
                                        placeholder="e.g. Dental Clinic, Car Showroom"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}><Building size={14} style={{ marginRight: '5px' }} /> Specific Company Name</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={editSpecificCompany}
                                        onChange={e => setEditSpecificCompany(e.target.value)}
                                        placeholder="e.g. ABC Motors, Smile Dental Care"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={handleSaveClient}
                                        className="btn-primary"
                                        style={{ 
                                            flex: 1, 
                                            height: '40px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '5px',
                                            fontSize: '0.9rem'
                                        }}
                                        disabled={updatingClient}
                                    >
                                        {updatingClient ? <Loader size={16} className="spin" /> : <><Save size={16} /> Save</>}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingClient(false)}
                                        className="btn-secondary"
                                        style={{ 
                                            flex: 1, 
                                            height: '40px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '5px',
                                            fontSize: '0.9rem',
                                            border: '1px solid #cbd5e1'
                                        }}
                                        disabled={updatingClient}
                                    >
                                        <X size={16} /> Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={infoRow}>
                                    <Phone size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                                    <span><strong style={{ color: '#475569' }}>Primary Phone:</strong> {lead.Phone}</span>
                                </div>
                                {lead.AlternatePhone && (
                                    <div style={infoRow}>
                                        <Phone size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                                        <span><strong style={{ color: '#475569' }}>Alternate Phone:</strong> {lead.AlternatePhone}</span>
                                    </div>
                                )}
                                <div style={infoRow}>
                                    <Mail size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                                    <span><strong style={{ color: '#475569' }}>Email:</strong> {lead.Email || 'No Email'}</span>
                                </div>
                                <div style={infoRow}>
                                    <Building size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                                    <span><strong style={{ color: '#475569' }}>Company Type:</strong> {lead.CompanyName || lead.CompanyType || 'No Company Type'}</span>
                                </div>
                                {lead.SpecificCompanyName && (
                                    <div style={infoRow}>
                                        <Building size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                                        <span><strong style={{ color: '#475569' }}>Specific Company Name:</strong> {lead.SpecificCompanyName}</span>
                                    </div>
                                )}
                                <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px', marginTop: '10px' }}>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '5px' }}>Original Call Note</p>
                                    <p style={{ fontSize: '0.9rem', color: '#475569' }}>{lead.CallNote}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <form className="glass-card" style={{ padding: '30px' }} onSubmit={handleUpdate}>
                        <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Updating Details</h3>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>New Call Note</label>
                            <textarea
                                className="input-field"
                                rows="4"
                                value={callNote}
                                onChange={e => setCallNote(e.target.value)}
                                placeholder="Summary of the Follow-up call..."
                                required
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button
                                    type="button"
                                    onClick={handleSaveNoteOnly}
                                    className="btn-secondary"
                                    style={{ 
                                        padding: '6px 12px', 
                                        fontSize: '0.85rem', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        borderRadius: '8px',
                                        height: 'auto',
                                        border: '1px solid #cbd5e1',
                                        cursor: 'pointer'
                                    }}
                                    disabled={savingNote || !callNote.trim()}
                                >
                                    {savingNote ? <Loader size={14} className="spin" /> : <Save size={14} />}
                                    Save Note
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>Lead Status</label>
                            <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="Interested">Interested (Schedule Meeting)</option>
                                <option value="Follow-up">Follow-up</option>
                                <option value="Not Interested">Not Interested</option>
                                <option value="Busy">Busy</option>
                                <option value="Hold">Hold</option>
                                <option value="Switch Off">Switch Off</option>
                                <option value="Speaking with Someone Else">Speaking with Someone Else</option>
                                <option value="Incoming Not Available">Incoming Not Available</option>
                                <option value="Not Answering">Not Answering</option>
                                <option value="Processing">Processing</option>
                                <option value="Out of Service">Out of Service</option>
                                <option value="other">Other</option>
                                <option value="Invalid">Invalid</option>
                            </select>
                        </div>

                        {status === 'other' && (
                            <div style={{ marginBottom: '20px' }} className="fade-in">
                                <label style={labelStyle}>Specific Lead Status *</label>
                                <input 
                                    className="input-field" 
                                    placeholder="Enter Lead Status" 
                                    value={customStatus} 
                                    onChange={e => setCustomStatus(e.target.value)} 
                                    required 
                                />
                            </div>
                        )}

                        {status === 'Interested' && (
                            <>
                                <div style={{ marginBottom: '20px' }} className="fade-in">
                                    <label style={labelStyle}>Services Interested</label>
                                    {services.map((service, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <select
                                                className="input-field"
                                                style={{ flex: 1 }}
                                                value={service.type}
                                                onChange={(e) => handleServiceChange(index, 'type', e.target.value)}
                                            >
                                                <option value="Website Development">Website Development</option>
                                                <option value="Web Application development">Web Application development</option>
                                                <option value="Digital Marketing">Digital Marketing</option>
                                                <option value="Android/ios Application development">Android/ios Application development</option>
                                                <option value="SEO">SEO</option>
                                                <option value="Graphic Design">Graphic Design</option>
                                                <option value="IVR service">IVR service</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            {service.type === 'Other' && (
                                                <input
                                                    className="input-field"
                                                    style={{ flex: 1 }}
                                                    placeholder="Custom Service"
                                                    value={service.custom}
                                                    onChange={(e) => handleServiceChange(index, 'custom', e.target.value)}
                                                />
                                            )}
                                            {services.length > 1 && (
                                                <button type="button" onClick={() => removeService(index)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '0 10px', cursor: 'pointer' }}>×</button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addService} style={{ background: 'none', border: '1px dashed #6366f1', color: '#6366f1', padding: '8px 15px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>+ Add Service</button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }} className="fade-in">
                                    <div>
                                        <label style={labelStyle}><Calendar size={14} style={{ marginRight: '5px' }} /> Meeting Date *</label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                            <input type="date" className="input-field" style={{ paddingLeft: '36px' }} value={meetingDate} onChange={e => setMeetingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} required={status === 'Interested'} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}><Clock size={14} style={{ marginRight: '5px' }} /> Meeting Time *</label>
                                        {(() => {
                                            const { hour12, minute, ampm } = parseTime24(meetingTime);
                                            return (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <select
                                                        className="input-field"
                                                        style={{ flex: 1 }}
                                                        value={hour12}
                                                        onChange={e => {
                                                            const newTime = formatTime24(e.target.value, minute, ampm);
                                                            setMeetingTime(newTime);
                                                        }}
                                                        required={status === 'Interested'}
                                                    >
                                                        <option value="" disabled hidden>Hour</option>
                                                        {Array.from({ length: 12 }).map((_, i) => {
                                                            const h = i + 1;
                                                            return <option key={h} value={h}>{String(h).padStart(2, '0')}</option>;
                                                        })}
                                                    </select>
                                                    <select
                                                        className="input-field"
                                                        style={{ flex: 1 }}
                                                        value={minute}
                                                        onChange={e => {
                                                            const newTime = formatTime24(hour12, e.target.value, ampm);
                                                            setMeetingTime(newTime);
                                                        }}
                                                    >
                                                        {Array.from({ length: 60 }).map((_, i) => {
                                                            const m = String(i).padStart(2, '0');
                                                            return <option key={m} value={m}>{m} min</option>;
                                                        })}
                                                    </select>
                                                    <select
                                                        className="input-field"
                                                        style={{ flex: 1 }}
                                                        value={ampm}
                                                        onChange={e => {
                                                            const newTime = formatTime24(hour12, minute, e.target.value);
                                                            setMeetingTime(newTime);
                                                        }}
                                                    >
                                                        <option value="AM">AM</option>
                                                        <option value="PM">PM</option>
                                                    </select>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </>
                        )}

                        {status === 'Follow-up' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }} className="fade-in">
                                <div>
                                    <label style={labelStyle}><Calendar size={14} style={{ marginRight: '5px' }} /> Next Date and Time *</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                        <input type="date" className="input-field" style={{ paddingLeft: '36px' }} value={followupDate} onChange={e => setFollowupDate(e.target.value)} min={new Date().toISOString().split('T')[0]} required />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}><Clock size={14} style={{ marginRight: '5px' }} /> PREF. Time *</label>
                                    {(() => {
                                        const { hour12, minute, ampm } = parseTime24(followupTime);
                                        return (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <select
                                                    className="input-field"
                                                    style={{ flex: 1 }}
                                                    value={hour12}
                                                    onChange={e => {
                                                        const newTime = formatTime24(e.target.value, minute, ampm);
                                                        setFollowupTime(newTime);
                                                    }}
                                                    required
                                                >
                                                    <option value="" disabled hidden>Hour</option>
                                                    {Array.from({ length: 12 }).map((_, i) => {
                                                        const h = i + 1;
                                                        return <option key={h} value={h}>{String(h).padStart(2, '0')}</option>;
                                                    })}
                                                </select>
                                                <select
                                                    className="input-field"
                                                    style={{ flex: 1 }}
                                                    value={minute}
                                                    onChange={e => {
                                                        const newTime = formatTime24(hour12, e.target.value, ampm);
                                                        setFollowupTime(newTime);
                                                    }}
                                                >
                                                    {Array.from({ length: 60 }).map((_, i) => {
                                                        const m = String(i).padStart(2, '0');
                                                        return <option key={m} value={m}>{m} min</option>;
                                                    })}
                                                </select>
                                                <select
                                                    className="input-field"
                                                    style={{ flex: 1 }}
                                                    value={ampm}
                                                    onChange={e => {
                                                        const newTime = formatTime24(hour12, minute, e.target.value);
                                                        setFollowupTime(newTime);
                                                    }}
                                                >
                                                    <option value="AM">AM</option>
                                                    <option value="PM">PM</option>
                                                </select>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px', height: '50px' }} disabled={submitting}>
                            {submitting ? <Loader size={20} className="spin" /> : <><Save size={18} style={{ marginRight: '10px' }} /> Update Lead Record</>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const infoRow = { display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '0.9rem' };
const labelStyle = { display: 'flex', alignItems: 'center', marginBottom: '8px', color: '#64748b', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' };

export default CallFollowupManage;
