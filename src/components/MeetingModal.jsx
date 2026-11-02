import { useState } from 'react';
import { X, Calendar, Clock, FileText, Star, Loader } from 'lucide-react';

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

const MeetingModal = ({ leadId, onClose, onSuccess }) => {
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        meetingDate: '',
        meetingTime: '',
        meetingNotes: '',
        interestLevel: 'Interested',
        quotationRequested: false
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${leadId}/meetings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({
                    ...formData,
                    meetingTime: formatTo12Hr(formData.meetingTime)
                })
            });
            if (res.ok) {
                onSuccess();
                onClose();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={overlayStyle}>
            <div className="glass-card fade-in" style={modalStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2 style={{ fontSize: '1.5rem' }}>Record Meeting</h2>
                    <X size={24} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={onClose} />
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={labelStyle}><Calendar size={14} /> Date</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input type="date" className="input-field" required
                                    style={{ paddingLeft: '36px' }}
                                    value={formData.meetingDate}
                                    onChange={e => setFormData({ ...formData, meetingDate: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}><Clock size={14} /> Time</label>
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
                    </div>

                    <div>
                        <label style={labelStyle}><Star size={14} /> Interest Level</label>
                        <select className="input-field" value={formData.interestLevel}
                            onChange={e => setFormData({ ...formData, interestLevel: e.target.value })}>
                            <option>Highly Interested</option>
                            <option>Interested</option>
                            <option>Neutral</option>
                            <option>Low Interest</option>
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}><FileText size={14} /> Meeting Summary</label>
                        <textarea className="input-field" rows="4" placeholder="What was discussed?" required
                            value={formData.meetingNotes}
                            onChange={e => setFormData({ ...formData, meetingNotes: e.target.value })} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="checkbox" id="quoteReq" style={{ width: '18px', height: '18px' }}
                            checked={formData.quotationRequested}
                            onChange={e => setFormData({ ...formData, quotationRequested: e.target.checked })} />
                        <label htmlFor="quoteReq" style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Client requested a formal quotation</label>
                    </div>

                    <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {submitting ? <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Meeting Record'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { width: '100%', maxWidth: '500px', background: 'white', padding: '35px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' };
const labelStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#64748b', fontSize: '0.85rem', fontWeight: '600' };

export default MeetingModal;
