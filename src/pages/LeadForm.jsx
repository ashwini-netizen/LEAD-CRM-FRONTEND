import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Loader, AlertCircle, Plus, Trash2, Calendar } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis, validatePhoneNumber } from '../utils/stringUtils';
import { formatCleanTime } from '../utils/notificationSync';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

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

const normalizeCustomStatusCE = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim().toLowerCase();
    if (!s) return '';

    // Standard conversions & typos
    if (s === 'busy' || s === 'buzy' || s === 'buzi') return 'Busy';
    if (s === 'direct visit' || s === 'direct vist' || s === 'directvisit' || s === 'field visit' || s === 'filed visit' || s.includes('direct visit') || s.includes('direct vist') || s.includes('field visit')) return 'Direct Visit';
    if (s === 'wrong number' || s.includes('wrong number') || s.includes('contact number is wrong') || s === 'wrong no' || s === 'wrng number') return 'Wrong Number';
    if (s === 'switch off' || s === 'switched off' || s === 'swiched off' || s === 'switchoff') return 'Switch Off';
    if (s === 'speaking with someone else' || s === 'speaking to someone else' || s === 'busy to speaking wth someone else' || s.includes('speaking with someone') || s.includes('speaking to someone')) {
        return 'Speaking with Someone Else';
    }
    if (s === 'incoming not available' || s === 'incoming call not available' || s === 'incoming call not available ' || s === 'no incoming' || s === 'incoming cl not available') {
        return 'Incoming Not Available';
    }
    if (s === 'not answering' || s === 'not answered' || s === 'not answer') return 'Not Answering';
    if (s === 'follow-up' || s === 'call follow-up' || s === 'followup' || s === 'call followup' || s === 'follow up') {
        return 'Follow-up';
    }
    if (s === 'not interested' || s === 'not intrested' || s === 'not intrest') return 'Not Interested';
    if (s === 'interested' || s === 'intrested') return 'Interested';
    if (s === 'hold') return 'Hold';
    if (s === 'invalid') return 'Invalid';
    if (s === 'processing') return 'Processing';
    if (s === 'out of service' || s === 'out of services' || s === 'outofservice') return 'Out of Service';
    if (s === 'converted' || s === 'conversion') return 'Converted';
    if (s === 'active') return 'Active';
    if (s === 'expired') return 'Expired';
    if (s === 'upgraded') return 'Upgraded';
    if (s === 'withdrawn') return 'Withdrawn';
    if (s === 'temporarily closed' || s === 'temp closed') return 'Temporarily Closed';
    if (s === 'permanently closed' || s === 'perm closed') return 'Permanently Closed';
    if (s === 'paid') return 'Paid';
    if (s === 'due payment') return 'Due Payment';
    if (s === 'quotation' || s === 'quotation needed' || s === 'quotation done') return 'Quotation';
    if (s === 'completed') return 'Completed';

    // Custom status title-casing so lower/upper case entries never create duplicates in the database
    return s
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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

    const formatTo12Hr = (time) => {
        if (!time) return null;
        return formatCleanTime(time);
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
        const fieldName = e.target.getAttribute('data-field') || e.target.name;
        const { value } = e.target;
        const cleanedValue = stripEmojis(value);

        // Real-time restriction for phone
        if (fieldName === 'phone') {
            const onlyNums = cleanedValue.replace(/[^0-9]/g, '');
            if (onlyNums.length <= 10) {
                setFormData(prev => ({ ...prev, [fieldName]: onlyNums }));
            }
            return;
        }

        // Real-time restriction for name
        if (fieldName === 'fullName') {
            const onlyLetters = cleanedValue.replace(/[^A-Za-z\s]/g, '');
            setFormData(prev => ({ ...prev, [fieldName]: onlyLetters }));
            return;
        }

        // Real-time restriction for company
        if (fieldName === 'company') {
            const allowedCompanyChars = cleanedValue.replace(/[^A-Za-z0-9\s.,&()'-]/g, '');
            setFormData(prev => ({ ...prev, [fieldName]: allowedCompanyChars }));
            return;
        }

        // Real-time restriction for email (strip spaces and convert to lowercase)
        if (fieldName === 'email') {
            const cleanedEmail = cleanedValue.toLowerCase().replace(/\s/g, '');
            setFormData(prev => ({ ...prev, [fieldName]: cleanedEmail }));
            return;
        }

        setFormData(prev => ({ ...prev, [fieldName]: cleanedValue }));
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

    const makeEditable = (e) => {
        if (e && e.target) {
            e.target.readOnly = false;
        }
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

            const isOther = formData.status === 'other';
            const normalizedCustom = isCE 
                ? normalizeCustomStatusCE(formData.customStatus) 
                : (formData.customStatus.trim().toLowerCase() === 'converted' || formData.customStatus.trim().toLowerCase() === 'conversion' ? 'Converted' : formData.customStatus.trim());
            const resolvedStatus = isOther ? normalizedCustom : formData.status;

            const payload = {
                fullName: formData.fullName,
                phone: formData.phone || null,
                email: cleanedEmail || null,
                companyName: formData.company,
                serviceInterested: serviceSummary,
                address: formData.address,
                callDate: formData.callDate || null,
                callNote: isFE ? null : (isFollowupStatus && formData.status !== 'Follow-up' ? (isOther ? resolvedStatus : formData.status) : formData.callNote),
                followupDate: formData.status === 'Follow-up' ? formData.followupDate : null,
                followupTime: formData.status === 'Follow-up' ? formatTo12Hr(formData.followupTime) : null,
                meetingDate: formData.meetingDate || null,
                meetingTime: formData.status === 'Interested' ? formatTo12Hr(formData.meetingTime) : null,
                status: resolvedStatus,
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

                <form className="glass-card fade-in responsive-form-grid" onSubmit={handleSubmit} autoComplete="off">
                    {/* Chrome autofill decoy fields to absorb browser personal info injection */}
                    <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }} tabIndex="-1" aria-hidden="true">
                        <input type="text" name="crm_dummy_prevent_user" tabIndex="-1" autoComplete="off" readOnly />
                        <input type="password" name="crm_dummy_prevent_pass" tabIndex="-1" autoComplete="off" readOnly />
                    </div>

                    <div>
                        <div style={labelStyle}>Full Name *</div>
                        <input 
                            data-field="fullName"
                            name="crm_field_client_entry" 
                            className="input-field" 
                            placeholder="Client Name" 
                            value={formData.fullName} 
                            onChange={handleChange} 
                            readOnly
                            onFocus={makeEditable}
                            onMouseDown={makeEditable}
                            onTouchStart={makeEditable}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            data-lpignore="true"
                            required 
                        />
                    </div>
                    <div>
                        <div style={labelStyle}>Phone Number {isFEorCE ? '' : '*'}</div>
                        <input 
                            data-field="phone"
                            name="crm_field_contact_entry" 
                            className="input-field" 
                            placeholder="10 Digit Number (starts with 6-9)" 
                            value={formData.phone} 
                            onChange={handleChange} 
                            readOnly
                            onFocus={makeEditable}
                            onMouseDown={makeEditable}
                            onTouchStart={makeEditable}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            data-lpignore="true"
                            required={!isFEorCE} 
                        />
                    </div>
                    <div>
                        <div style={labelStyle}>Email {isFEorCE ? '' : '*'}</div>
                        <input
                            data-field="email"
                            name="crm_field_mail_entry"
                            type="text"
                            className="input-field"
                            placeholder="email@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            readOnly
                            onFocus={makeEditable}
                            onMouseDown={makeEditable}
                            onTouchStart={makeEditable}
                            onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.preventDefault(); }}
                            onBlur={() => setFormData(prev => ({ ...prev, email: prev.email.trim().replace(/\s/g, '') }))}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            data-lpignore="true"
                            required={!isFEorCE}
                        />
                    </div>
                    <div>
                        <div style={labelStyle}>Company *</div>
                        <input 
                            data-field="company"
                            name="crm_field_org_entry" 
                            className="input-field" 
                            placeholder="Company Name" 
                            value={formData.company} 
                            onChange={handleChange} 
                            readOnly
                            onFocus={makeEditable}
                            onMouseDown={makeEditable}
                            onTouchStart={makeEditable}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            data-lpignore="true"
                            required 
                        />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <div style={labelStyle}>Address *</div>
                        <textarea 
                            data-field="address"
                            name="crm_field_loc_entry" 
                            className="input-field" 
                            rows="3" 
                            placeholder="Enter Full Address" 
                            value={formData.address} 
                            onChange={handleChange} 
                            readOnly
                            onFocus={makeEditable}
                            onMouseDown={makeEditable}
                            onTouchStart={makeEditable}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            data-lpignore="true"
                            required
                        ></textarea>
                    </div>

                    <div style={isFE ? { gridColumn: 'span 2' } : {}}>
                        <div style={labelStyle}>Call Date *</div>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                            <input type="date" name="callDate" className="input-field" style={{ paddingLeft: '36px' }} value={formData.callDate} onChange={handleChange} min={isFE ? undefined : new Date().toISOString().split('T')[0]} required />
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <div style={labelStyle}>Lead Status *</div>
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
                            <div style={labelStyle}>Specific Lead Status *</div>
                            <input 
                                data-field="customStatus"
                                name="crm_field_custom_status" 
                                className="input-field" 
                                placeholder="Enter Lead Status" 
                                value={formData.customStatus} 
                                onChange={handleChange} 
                                readOnly
                                onFocus={makeEditable}
                                onMouseDown={makeEditable}
                                onTouchStart={makeEditable}
                                onBlur={(e) => {
                                    if (isCE && e.target.value.trim()) {
                                        const norm = normalizeCustomStatusCE(e.target.value);
                                        setFormData(prev => ({ ...prev, customStatus: norm }));
                                    }
                                }}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-lpignore="true"
                                required 
                            />
                        </div>
                    )}

                    {formData.status === 'Interested' && (
                        <div style={{ gridColumn: 'span 2' }} className="fade-in">
                            <div style={{ marginBottom: '15px' }}>
                                <div style={labelStyle}>Services Interested</div>
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
                                                name="crm_field_service_other"
                                                className="input-field"
                                                placeholder="Enter Service Name"
                                                value={service.custom}
                                                onChange={(e) => handleServiceChange(index, 'custom', e.target.value)}
                                                readOnly
                                                onFocus={makeEditable}
                                                onMouseDown={makeEditable}
                                                onTouchStart={makeEditable}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck="false"
                                                data-lpignore="true"
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
                            <div style={labelStyle}>Call Note *</div>
                            <textarea 
                                data-field="callNote"
                                name="crm_field_call_note" 
                                className="input-field" 
                                rows="2" 
                                placeholder="Tell us more about the lead..." 
                                value={formData.callNote} 
                                onChange={handleChange} 
                                readOnly
                                onFocus={makeEditable}
                                onMouseDown={makeEditable}
                                onTouchStart={makeEditable}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-lpignore="true"
                                required
                            ></textarea>
                        </div>
                    )}

                    {formData.status === 'Interested' && (
                        <>
                            <div className="fade-in">
                                <div style={labelStyle}>Meeting Date *</div>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input type="date" name="meetingDate" className="input-field" style={{ paddingLeft: '36px' }} value={formData.meetingDate} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required />
                                </div>
                            </div>
                            <div className="fade-in">
                                <div style={labelStyle}>Meeting Time *</div>
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
                                <div style={labelStyle}>Next Date and Time *</div>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input type="date" name="followupDate" className="input-field" style={{ paddingLeft: '36px' }} value={formData.followupDate} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required />
                                </div>
                            </div>
                            <div className="fade-in">
                                <div style={labelStyle}>PREF. Time *</div>
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
                            <div style={labelStyle}>Reason</div>
                            <textarea 
                                data-field="reason"
                                name="crm_field_discard_reason" 
                                className="input-field" 
                                rows="2" 
                                placeholder="Why not interested?" 
                                value={formData.reason} 
                                onChange={handleChange} 
                                readOnly
                                onFocus={makeEditable}
                                onMouseDown={makeEditable}
                                onTouchStart={makeEditable}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-lpignore="true"
                                required
                            ></textarea>
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
