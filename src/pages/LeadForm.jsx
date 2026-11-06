import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Loader, AlertCircle, Plus, Trash2, Calendar } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis, validatePhoneNumber } from '../utils/stringUtils';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const parseTime24 = (timeStr) => {
    if (!timeStr) return { hour12: '', minute: '00', ampm: 'AM' };
    const is12Hr = /am|pm/i.test(timeStr);
    if (is12Hr) {
        const ampmMatch = timeStr.match(/(am|pm)/i);
        const ampm = ampmMatch ? ampmMatch[0].toUpperCase() : 'AM';
        const timePart = timeStr.replace(/(am|pm)/i, '').trim();
        const [hStr, mStr] = timePart.split(':');
        const h = parseInt(hStr) || 12;
        return {
            hour12: String(h),
            minute: (mStr || '00').padStart(2, '0'),
            ampm
        };
    } else {
        const [hStr, mStr] = timeStr.split(':');
        let h = parseInt(hStr) || 0;
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

const LeadForm = ({ user }) => {
    const isFE = user?.role === 'Field Executive' || user?.Role === 'Field Executive';
    const isCE = user?.role === 'Call Executive' || user?.Role === 'Call Executive';
    const isFEorCE = isFE || isCE;
    const navigate = useNavigate();
    const location = useLocation();
    const getRedirectPath = () => {
        const params = new URLSearchParams(location.search);
        const fromParam = params.get('from');
        if (fromParam === 'dashboard') return '/dashboard';
        if (fromParam === 'leads') return isFE ? '/leads/my-created' : '/leads';
        return location.state?.from || (isFE ? '/leads/my-created' : '/leads');
    };
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        company: '',
        services: [{ type: '', custom: '' }],
        address: '',
        callDate: new Date().toISOString().split('T')[0],
        callNote: '',
        status: 'Interested',
        customStatus: '',
        followupDate: '',
        followupTime: '',
        meetingDate: '',
        meetingTime: '',
        reason: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const formatTo12Hr = (time24) => {
        if (!time24) return null;
        let [hours, minutes] = time24.split(':');
        hours = parseInt(hours);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${minutes} ${ampm}`;
    };

    const validateForm = () => {
        // 1. Check mandatory fields first
        const isMandatoryMissing = isFEorCE
            ? (!formData.fullName || !formData.address || !formData.company || !formData.callDate)
            : (!formData.fullName || !formData.phone || !formData.email || !formData.address || !formData.company || !formData.callDate);

        if (isMandatoryMissing) {
            setSubmitError('Please fill all mandatory fields (marked with *).');
            return false;
        }

        // 2. Format checks for fields
        if (formData.phone) {
            const phoneValidation = validatePhoneNumber(formData.phone, 'Phone number');
            if (!phoneValidation.isValid) {
                setSubmitError(phoneValidation.message);
                return false;
            }
        } else if (!isFEorCE) {
            setSubmitError('Phone number is required.');
            return false;
        }

        // Name: Letters and spaces only
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(formData.fullName)) {
            setSubmitError('Full name should contain only letters and spaces.');
            return false;
        }

        // Email: Mandatory for other roles; optional for FE/CE
        if (formData.email) {
            const cleanedEmail = formData.email.trim().replace(/\s/g, '');
            const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
            if (!emailRegex.test(cleanedEmail)) {
                setSubmitError('Please enter a valid email address (lowercase ending in .com).');
                return false;
            }
        } else if (!isFEorCE) {
            setSubmitError('Email is required.');
            return false;
        }

        if (formData.company.trim().length < 3) {
            setSubmitError('Company Name must be at least 3 characters long.');
            return false;
        }
        const companyRegex = /^[A-Za-z0-9\s.,&()'-]+$/;
        if (!companyRegex.test(formData.company)) {
            setSubmitError('Company Name should contain only letters, numbers, spaces, and standard punctuation (.,&()\'-).');
            return false;
        }
        if (/^\d+$/.test(formData.company.trim())) {
            setSubmitError('Company Name cannot be solely numeric.');
            return false;
        }

        if (formData.address.trim().length < 10) {
            setSubmitError('Address must be at least 10 characters long.');
            return false;
        }

        // 3. Status-specific validation
        const shouldHideExtra = ['Busy', 'Not Answering', 'Switch Off', 'Speaking with Someone Else', 'Incoming Not Available', 'Out of Service', 'Hold', 'Processing', 'Invalid', 'other'].includes(formData.status);
        if (!isFE && !shouldHideExtra && !formData.callNote) {
            setSubmitError('Call Note is required.');
            return false;
        }

        if (formData.status === 'other' && !formData.customStatus.trim()) {
            setSubmitError('Specific Lead Status is required.');
            return false;
        }

        if (formData.status === 'Interested') {
            if (!formData.meetingDate) {
                setSubmitError('Meeting Date is required.');
                return false;
            }
            if (!formData.meetingTime) {
                setSubmitError('Meeting Time is required.');
                return false;
            }
            // Validate services interested
            const hasEmptyType = formData.services.some(s => !s.type);
            if (hasEmptyType) {
                setSubmitError('Please select a service type for all services.');
                return false;
            }
            const hasEmptyCustom = formData.services.some(s => s.type === 'Other' && !s.custom.trim());
            if (hasEmptyCustom) {
                setSubmitError('Please specify the service name for "Other" services.');
                return false;
            }
        }

        if (formData.status === 'Follow-up') {
            if (!formData.followupDate) {
                setSubmitError('Next Date is required.');
                return false;
            }
            if (!formData.followupTime) {
                setSubmitError('PREF. Time is required.');
                return false;
            }
        }

        if (formData.status === 'Not Interested' && !formData.reason.trim()) {
            setSubmitError('Reason is required.');
            return false;
        }

        return true;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const cleanedValue = stripEmojis(value);

        // Real-time restriction for phone
        if (name === 'phone') {
            const onlyNums = cleanedValue.replace(/[^0-9]/g, '');
            if (onlyNums.length <= 10) {
                setFormData(prev => ({ ...prev, [name]: onlyNums }));
            }
            return;
        }

        // Real-time restriction for name
        if (name === 'fullName') {
            const onlyLetters = cleanedValue.replace(/[^A-Za-z\s]/g, '');
            setFormData(prev => ({ ...prev, [name]: onlyLetters }));
            return;
        }

        // Real-time restriction for company
        if (name === 'company') {
            const allowedCompanyChars = cleanedValue.replace(/[^A-Za-z0-9\s.,&()'-]/g, '');
            setFormData(prev => ({ ...prev, [name]: allowedCompanyChars }));
            return;
        }

        // Real-time restriction for email (strip spaces and convert to lowercase)
        if (name === 'email') {
            const cleanedEmail = cleanedValue.toLowerCase().replace(/\s/g, '');
            setFormData(prev => ({ ...prev, [name]: cleanedEmail }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: cleanedValue }));
    };

    const handleServiceChange = (index, field, value) => {
        const newServices = [...formData.services];
        newServices[index][field] = stripEmojis(value);
        setFormData(prev => ({ ...prev, services: newServices }));
    };

    const addService = () => {
        setFormData(prev => ({ ...prev, services: [...prev.services, { type: '', custom: '' }] }));
    };

    const removeService = (index) => {
        const newServices = formData.services.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, services: newServices }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if ((user?.role === 'Call Executive' || user?.role === 'Field Executive') && !user?.IsOnline) {
            return alert('Please turn on online status to perform activities.');
        }
        setSubmitError('');

        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const serviceSummary = formData.services
                .map(s => s.type === 'Other' ? s.custom : s.type)
                .filter(Boolean)
                .join(', ');

            const isFollowupStatus = ['Follow-up', 'Busy', 'Not Answering', 'Speaking with Someone Else', 'Out of Service', 'Incoming Not Available', 'Switch Off', 'Hold', 'Processing', 'Invalid', 'other'].includes(formData.status);

            const cleanedEmail = formData.email ? formData.email.trim().replace(/\s/g, '') : '';
            if (cleanedEmail) {
                setFormData(prev => ({ ...prev, email: cleanedEmail }));
            }

            const payload = {
                fullName: formData.fullName,
                phone: formData.phone || null,
                email: cleanedEmail || null,
                companyName: formData.company,
                serviceInterested: serviceSummary,
                address: formData.address,
                callDate: formData.callDate || null,
                callNote: isFE ? null : (isFollowupStatus && formData.status !== 'Follow-up' ? (formData.status === 'other' ? formData.customStatus : formData.status) : formData.callNote),
                followupDate: formData.status === 'Follow-up' ? formData.followupDate : null,
                followupTime: formData.status === 'Follow-up' ? formatTo12Hr(formData.followupTime) : null,
                meetingDate: formData.meetingDate || null,
                meetingTime: formData.status === 'Interested' ? formatTo12Hr(formData.meetingTime) : null,
                status: formData.status === 'other' 
                    ? (formData.customStatus.trim().toLowerCase() === 'converted' || formData.customStatus.trim().toLowerCase() === 'conversion' ? 'Converted' : formData.customStatus)
                    : formData.status,
                createdBy: user?.id || user?.UserID || null
            };
            const res = await fetch(`${API_URL}/api/leads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const msg = await res.text();
                setSubmitError(msg || 'Failed to create lead');
                setSubmitting(false);
                return;
            }
            window.dispatchEvent(new Event('lead_updated'));
            alert('Lead created successfully!');
            navigate(getRedirectPath(), { replace: true });
        } catch (err) {
            setSubmitError('Cannot connect to server. Is the backend running?');
        }
        setSubmitting(false);
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Create New Lead" />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1, overflowY: 'auto' }}>
                <header className="responsive-header">
                    <h1>Lead Creation Form</h1>
                    <button onClick={() => navigate(getRedirectPath(), { replace: true })} className="btn-secondary" style={{ padding: '10px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>Exit</button>
                </header>

                {submitError && (
                    <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.9rem' }}>
                        <AlertCircle size={16} /> {submitError}
                    </div>
                )}

                <form className="glass-card fade-in responsive-form-grid" onSubmit={handleSubmit}>
                    <div>
                        <label style={labelStyle}>Full Name *</label>
                        <input name="fullName" className="input-field" placeholder="Client Name" value={formData.fullName} onChange={handleChange} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Phone Number {isFEorCE ? '' : '*'}</label>
                        <input 
                            name="phone" 
                            className="input-field" 
                            placeholder="10 Digit Number (starts with 6-9)" 
                            value={formData.phone} 
                            onChange={handleChange} 
                            required={!isFEorCE} 
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Email {isFEorCE ? '' : '*'}</label>
                        <input
                            name="email"
                            type="text"
                            className="input-field"
                            placeholder="email@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.preventDefault(); }}
                            onBlur={() => setFormData(prev => ({ ...prev, email: prev.email.trim().replace(/\s/g, '') }))}
                            required={!isFEorCE}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Company *</label>
                        <input name="company" className="input-field" placeholder="Company Name" value={formData.company} onChange={handleChange} required />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Address *</label>
                        <textarea name="address" className="input-field" rows="3" placeholder="Enter Full Address" value={formData.address} onChange={handleChange} required></textarea>
                    </div>

                    <div style={isFE ? { gridColumn: 'span 2' } : {}}>
                        <label style={labelStyle}>Call Date *</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                            <input type="date" name="callDate" className="input-field" style={{ paddingLeft: '36px' }} value={formData.callDate} onChange={handleChange} min={isFE ? undefined : new Date().toISOString().split('T')[0]} required />
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Lead Status *</label>
                        <select name="status" className="input-field" value={formData.status} onChange={handleChange} required>
                            <option value="" disabled hidden>Select Status</option>
                            {isFE ? (
                                <>
                                    <option value="Interested">Interested</option>
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Converted">Converted</option>
                                    <option value="Busy">Busy</option>
                                    <option value="other">Other</option>
                                </>
                            ) : (
                                <>
                                    <option value="Interested">Interested</option>
                                    <option value="Follow-up">Follow-up</option>
                                    {!isCE && <option value="Converted">Converted</option>}
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
                                </>
                            )}
                        </select>
                    </div>

                    {formData.status === 'other' && (
                        <div style={{ gridColumn: 'span 2' }} className="fade-in">
                            <label style={labelStyle}>Specific Lead Status *</label>
                            <input 
                                name="customStatus" 
                                className="input-field" 
                                placeholder="Enter Lead Status" 
                                value={formData.customStatus} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>
                    )}

                    {formData.status === 'Interested' && (
                        <div style={{ gridColumn: 'span 2' }} className="fade-in">
                            <div style={{ marginBottom: '15px' }}>
                                <label style={labelStyle}>Services Interested</label>
                            </div>
                            {formData.services.map((service, index) => (
                                <div key={index} style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <select
                                            className="input-field"
                                            value={service.type}
                                            onChange={(e) => handleServiceChange(index, 'type', e.target.value)}
                                            required
                                        >
                                            <option value="" disabled hidden>Select Service</option>
                                            <option value="Website Development">Website Development</option>
                                            <option value="Web Application development">Web Application development</option>
                                            <option value="Digital Marketing">Digital Marketing</option>
                                            <option value="Android/ios Application development">Android/ios Application development</option>
                                            <option value="SEO">SEO</option>
                                            <option value="Graphic Design">Graphic Design</option>
                                            <option value="IVR service">IVR service</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    {service.type === 'Other' && (
                                        <div style={{ flex: 1 }}>
                                            <input
                                                className="input-field"
                                                placeholder="Enter Service Name"
                                                value={service.custom}
                                                onChange={(e) => handleServiceChange(index, 'custom', e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}
                                    {formData.services.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeService(index)}
                                            style={{ 
                                                padding: '12px', 
                                                background: '#fee2e2', 
                                                color: '#ef4444', 
                                                border: '1px solid #fecaca', 
                                                borderRadius: '12px', 
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: '0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                                        >
                                            <Trash2 size={18} style={{ strokeWidth: 2.5 }} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={addService} style={{ width: '100%', padding: '10px', background: '#f8fafc', color: '#6366f1', border: '1px dashed #6366f1', borderRadius: '12px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.3s' }}>
                                <Plus size={16} /> Add Another Service
                            </button>
                        </div>
                    )}

                    {!isFE && !['Busy', 'Not Answering', 'Switch Off', 'Speaking with Someone Else', 'Incoming Not Available', 'Out of Service', 'Hold', 'Processing', 'Invalid', 'other'].includes(formData.status) && (
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={labelStyle}>Call Note *</label>
                            <textarea name="callNote" className="input-field" rows="2" placeholder="Tell us more about the lead..." value={formData.callNote} onChange={handleChange} required></textarea>
                        </div>
                    )}

                    {formData.status === 'Interested' && (
                        <>
                            <div className="fade-in">
                                <label style={labelStyle}>Meeting Date *</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input type="date" name="meetingDate" className="input-field" style={{ paddingLeft: '36px' }} value={formData.meetingDate} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required />
                                </div>
                            </div>
                            <div className="fade-in">
                                <label style={labelStyle}>Meeting Time *</label>
                                {(() => {
                                    const { hour12, minute, ampm } = parseTime24(formData.meetingTime);
                                    return (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select
                                                className="input-field"
                                                style={{ flex: 1 }}
                                                value={hour12}
                                                onChange={e => {
                                                    const newTime = formatTime24(e.target.value, minute, ampm);
                                                    setFormData(prev => ({ ...prev, meetingTime: newTime }));
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
                                                    setFormData(prev => ({ ...prev, meetingTime: newTime }));
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
                                                    setFormData(prev => ({ ...prev, meetingTime: newTime }));
                                                }}
                                            >
                                                <option value="AM">AM</option>
                                                <option value="PM">PM</option>
                                            </select>
                                        </div>
                                    );
                                })()}
                            </div>
                        </>
                    )}

                    {formData.status === 'Follow-up' && (
                        <>
                            <div className="fade-in">
                                <label style={labelStyle}>Next Date and Time *</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input type="date" name="followupDate" className="input-field" style={{ paddingLeft: '36px' }} value={formData.followupDate} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required />
                                </div>
                            </div>
                            <div className="fade-in">
                                <label style={labelStyle}>PREF. Time *</label>
                                {(() => {
                                    const { hour12, minute, ampm } = parseTime24(formData.followupTime);
                                    return (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select
                                                className="input-field"
                                                style={{ flex: 1 }}
                                                value={hour12}
                                                onChange={e => {
                                                    const newTime = formatTime24(e.target.value, minute, ampm);
                                                    setFormData(prev => ({ ...prev, followupTime: newTime }));
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
                                                    setFormData(prev => ({ ...prev, followupTime: newTime }));
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
                                                    setFormData(prev => ({ ...prev, followupTime: newTime }));
                                                }}
                                            >
                                                <option value="AM">AM</option>
                                                <option value="PM">PM</option>
                                            </select>
                                        </div>
                                    );
                                })()}
                            </div>
                        </>
                    )}

                    {formData.status === 'Not Interested' && (
                        <div style={{ gridColumn: 'span 2' }} className="fade-in">
                            <label style={labelStyle}>Reason</label>
                            <textarea name="reason" className="input-field" rows="2" placeholder="Why not interested?" value={formData.reason} onChange={handleChange} required></textarea>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '15px', gridColumn: 'span 2', marginTop: '30px' }}>
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Lead'}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                .glass-card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
                .input-field { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 0.95rem; }
                .input-field:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                .btn-primary { width: 100%; padding: 14px; background: #6366f1; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 700; transition: 0.2s; }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

const labelStyle = { display: 'block', marginBottom: '8px', color: '#64748b', fontSize: '0.85rem', fontWeight: '600' };

export default LeadForm;
