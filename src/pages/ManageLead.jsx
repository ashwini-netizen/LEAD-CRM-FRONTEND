import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader, AlertCircle, Phone, Mail, Building, MapPin, Calendar, Clock, FileText, CheckCircle2, Upload, Send, XCircle, CreditCard, RefreshCw, Edit, AlertTriangle, Trash2 } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';

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

const ManageLead = ({ user }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isBalancePayment, setIsBalancePayment] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

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
    const [paymentDate, setPaymentDate] = useState('');
    const [billingItems, setBillingItems] = useState([]); // [{ service: '', total: '', tenure: '', customTenure: '', paid: '', dueDate: '', resumeDate: '' }]


    // Reject State (For Quotation Leads)
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Remove Client State (For Paid Leads)
    const [showRemoveClientModal, setShowRemoveClientModal] = useState(false);
    const [removeClientReason, setRemoveClientReason] = useState('');

    // Service Editing State
    const [isEditingServices, setIsEditingServices] = useState(false);
    const [editedServices, setEditedServices] = useState('');
    const [savingServices, setSavingServices] = useState(false);

    // Edit Services Modal State (For Paid Leads)
    const [showEditServiceModal, setShowEditServiceModal] = useState(false);
    
    // Edit Client Details State
    const [showEditClientModal, setShowEditClientModal] = useState(false);
    const [editFormData, setEditFormData] = useState({ fullName: '', companyName: '', email: '', phone: '', address: '' });
    
    const defaultServices = [
        'Graphic Design',
        'Website/Page Development',
        'Digital Marketing',
        'Personalized Application',
        'Tokens Boy App',
        'Content Writing',
        'SEO',
        'Other'
    ];

    const initializeEditServices = (servicesString) => {
        if (!servicesString) return [{ type: '', custom: '' }];
        const services = servicesString.split(',').map(s => s.trim());
        return services.map(s => {
            if (defaultServices.includes(s)) return { type: s, custom: '' };
            return { type: 'Other', custom: s };
        });
    };

    const [quickEditServicesList, setQuickEditServicesList] = useState([{ type: '', custom: '' }]);
    const [includeQuotation, setIncludeQuotation] = useState(false);

    // Quotation Generation State
    const [quotationMode, setQuotationMode] = useState('manual'); // 'manual' or 'auto'
    const [selectedQuotes, setSelectedQuotes] = useState([
        { type: 'personalized', devPrice: '', maintenancePrice: '2000', monthlyPrice: '', price: '', selectedServices: [] }
    ]);

    const addQuoteOption = () => {
        setSelectedQuotes([...selectedQuotes, { type: 'personalized', devPrice: '', maintenancePrice: '2000', monthlyPrice: '', price: '', selectedServices: [] }]);
    };

    const removeQuoteOption = (index) => {
        if (selectedQuotes.length > 1) {
            setSelectedQuotes(selectedQuotes.filter((_, i) => i !== index));
        }
    };

    const updateQuoteOption = (index, field, value) => {
        const newQuotes = [...selectedQuotes];
        let sanitizedValue = value;
        if (['devPrice', 'maintenancePrice', 'monthlyPrice', 'price'].includes(field)) {
            sanitizedValue = value.replace(/\D/g, '');
        }
        newQuotes[index] = { ...newQuotes[index], [field]: sanitizedValue };
        setSelectedQuotes(newQuotes);
    };

    const handleNumberKeyDown = (e) => {
        if (['e', 'E', '-', '+', '.', ','].includes(e.key)) {
            e.preventDefault();
        }
    };

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

    const quoteEndRef = useRef(null);
    useEffect(() => {
        if (quoteEndRef.current) {
            quoteEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedQuotes]);

    useEffect(() => {
        fetchLead();
    }, [id]);

    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showModal]);

    const handleAmountChange = (e, setter) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setter(val);
    };

    const isOnlineRestricted = () => {
        if ((user?.role === 'Call Executive' || user?.role === 'Field Executive') && !user?.IsOnline) {
            alert('Please turn on online status to perform activities.');
            return true;
        }
        return false;
    };

    const handleAcceptPayment = async () => {
        if (isOnlineRestricted()) return;
        const activeItems = billingItems.filter(i => i.included);
        if (activeItems.length === 0) return alert('Please select at least one service to collect payment for.');

        const anyEmpty = activeItems.some(i => !i.service || !i.total || !i.paid || !i.tenure);
        if (anyEmpty || !paymentDate) return alert('Please fill in all details for each selected service.');

        const totalSum = activeItems.reduce((acc, i) => acc + parseFloat(i.total || 0), 0);
        const currentPaidSum = activeItems.reduce((acc, i) => acc + parseFloat(i.paid || 0), 0);

        // For Balance Payment, we must add the total of newly added services (isOld: false) to the original total
        const newServicesTotal = activeItems.filter(i => !i.isOld && i.service && !recordBreakdown.some(r => r.service === i.service)).reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

        const prevPaidTotal = isBalancePayment ? parseFloat(lead.payment?.PaidAmount || 0) : 0;
        const newTotalPaid = prevPaidTotal + currentPaidSum;
        const originalTotal = isBalancePayment ? (parseFloat(lead.payment?.TotalAmount || 0) + newServicesTotal) : totalSum;
        const newPending = originalTotal - newTotalPaid;

        // Update breakdown for cumulative storage
        let updatedBreakdown = [];
        if (isBalancePayment) {
            updatedBreakdown = recordBreakdown.map(prevItem => {
                const currentItem = activeItems.find(i => i.service === prevItem.service);
                if (currentItem) {
                    const cumulativePaidForItem = (parseFloat(prevItem.paid || 0)) + (parseFloat(currentItem.paid || 0));
                    return {
                        ...currentItem,
                        paid: cumulativePaidForItem,
                        total: prevItem.total // Keep original total in breakdown
                    };
                }
                return prevItem; // Keep original state for unselected services
            });
            // ALSO APPEND NEW SERVICES
            const newActiveItems = activeItems.filter(i => !i.isOld && !recordBreakdown.some(r => r.service === i.service));
            updatedBreakdown = [...updatedBreakdown, ...newActiveItems.map(item => ({
                ...item,
                paid: parseFloat(item.paid || 0)
            }))];
        } else {
            updatedBreakdown = billingItems.map(item => ({
                ...item,
                paid: parseFloat(item.paid || 0)
            }));
        }

        // Earliest due date as the main due date (from active items or remaining dues)
        const allDues = updatedBreakdown.map(i => ({ service: i.service, due: i.dueDate, pending: parseFloat(i.total || 0) - parseFloat(i.paid || 0) }));
        const validDates = allDues.filter(i => i.pending > 0 && i.due).map(i => i.due);
        const mainDueDate = validDates.length > 0 ? validDates.sort()[0] : (allDues.length > 0 ? allDues[0].due : null);

        const breakdownNotes = activeItems.map(i =>
            `${i.service}: ₹${i.total} (${i.tenure === 'full' ? 'Full' : (i.tenure === 'other' ? i.customTenure : i.tenure) + ' months'}), Paid Now: ₹${i.paid}, Inv: ${i.invoiceNumber || 'N/A'}, Resume on: ${i.resumeDate || 'N/A'}`
        ).join(' | ');

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
                    totalAmount: originalTotal,
                    paidAmount: newTotalPaid,
                    pendingAmount: newPending,
                    paymentDate: paymentDate,
                    duePaymentDate: newPending > 0 ? mainDueDate : null,
                    notes: `${isBalancePayment ? 'Balance payment: ' : 'Initial payment: '}${breakdownNotes}`,
                    billingBreakdown: updatedBreakdown
                })
            });


            if (!res.ok) throw new Error('Failed to record payment');
            alert('Payment recorded successfully!');
            setShowPaymentModal(false);
            setBillingItems([]);
            navigate('/leads/payment-pending', { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const calculateDates = (baseDate, tenure, custom) => {
        if (!baseDate || !tenure) return { resume: '' };
        if (tenure === 'full') return { resume: 'N/A' };

        const months = tenure === 'other' ? parseInt(custom) : parseInt(tenure);
        if (isNaN(months)) return { resume: '' };

        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + months);
        const formatted = d.toISOString().split('T')[0];
        return { resume: formatted };
    };

    const updateBillingItem = (index, field, value) => {
        const newItems = [...billingItems];
        let cleanedValue = value;
        if (field === 'service' || field === 'invoiceNumber') {
            cleanedValue = stripEmojis(value);
        }
        
        if (field === 'paid') {
            const total = parseFloat(newItems[index].total || 0);
            const paid = parseFloat(cleanedValue || 0);
            if (paid > total) {
                cleanedValue = total.toString();
            }
        }
        
        if (field === 'total') {
            const paid = parseFloat(newItems[index].paid || 0);
            const total = parseFloat(cleanedValue || 0);
            if (paid > total) {
                newItems[index].paid = total.toString();
            }
        }

        newItems[index][field] = cleanedValue;

        if (field === 'tenure' || field === 'customTenure' || field === 'total' || field === 'paid') {
            const { resume } = calculateDates(paymentDate, newItems[index].tenure, newItems[index].customTenure);
            newItems[index].resumeDate = resume;
        }
        setBillingItems(newItems);
    };

    const addBillingItem = () => {
        setBillingItems([...billingItems, { service: '', total: '', tenure: '', customTenure: '', paid: '', dueDate: '', resumeDate: '' }]);
    };

    const removeBillingItem = (index) => {
        setBillingItems(billingItems.filter((_, i) => i !== index));
    };


    const [recordBreakdown, setRecordBreakdown] = useState([]);

    const openPaymentModal = () => {
        const pendingValue = parseFloat(lead.LatestPendingAmount || 0);
        const isBalance = pendingValue > 0;
        const isResume = lead.Status === 'Paid';
        setIsBalancePayment(isBalance);

        const initialDate = new Date().toISOString().split('T')[0];
        setPaymentDate(initialDate);

        let savedBreakdown = [];
        try {
            if (lead.payment?.BillingBreakdown) {
                savedBreakdown = JSON.parse(lead.payment.BillingBreakdown);
                setRecordBreakdown(savedBreakdown);
            }
        } catch (e) { console.error('Parse breakdown error', e); }

        if (isBalance) {
            const pendingTotal = parseFloat(lead.LatestPendingAmount || 0);
            if (savedBreakdown.length > 0) {
                const oldServices = savedBreakdown.map(item => item.service);
                const services = lead.ServiceInterested ? lead.ServiceInterested.split(',').map(s => s.trim()) : [];
                const newServices = services.filter(s => !oldServices.includes(s));

                const mergedItems = [
                    ...savedBreakdown.map(item => {
                        const pending = parseFloat(item.total || 0) - parseFloat(item.paid || 0);
                        return {
                            service: item.service,
                            total: pending, // The "Total" for this collection is the remaining balance
                            tenure: item.tenure,
                            customTenure: item.customTenure,
                            paid: '', // Ready to collect
                            dueDate: item.dueDate,
                            resumeDate: item.resumeDate,
                            invoiceNumber: item.invoiceNumber || '',
                            included: pending > 0,
                            isOld: pending <= 0 // Hide if fully paid
                        };
                    }),
                    ...newServices.map(s => ({
                        service: s,
                        total: '',
                        tenure: '',
                        customTenure: '',
                        paid: '',
                        dueDate: '',
                        resumeDate: '',
                        invoiceNumber: '',
                        included: true,
                        isOld: false
                    }))
                ];
                setBillingItems(mergedItems);
            } else {
                // Fallback for old records: Assign total pending to the first service
                const services = lead.ServiceInterested ? lead.ServiceInterested.split(',').map(s => s.trim()) : ['General Service'];
                setBillingItems(services.map((s, idx) => ({
                    service: s,
                    total: idx === 0 ? pendingTotal : 0,
                    tenure: '',
                    customTenure: '',
                    paid: '',
                    dueDate: '',
                    resumeDate: '',
                    invoiceNumber: '',
                    included: idx === 0 && pendingTotal > 0,
                    isOld: false
                })));
            }
        } else if (isResume) {
            // New cycle for Paid lead
            if (savedBreakdown.length > 0) {
                setBillingItems(savedBreakdown.map(item => ({
                    service: item.service,
                    total: item.total, // Suggest same price
                    tenure: '',
                    customTenure: '',
                    paid: '',
                    dueDate: '',
                    resumeDate: '',
                    invoiceNumber: '',
                    included: true,
                    isOld: false
                })));
            } else {
                const services = lead.ServiceInterested ? lead.ServiceInterested.split(',').map(s => s.trim()) : [];
                setBillingItems(services.map(s => ({
                    service: s,
                    total: '',
                    tenure: '',
                    customTenure: '',
                    paid: '',
                    dueDate: '',
                    resumeDate: '',
                    invoiceNumber: '',
                    included: true,
                    isOld: false
                })));
            }
        } else {
            if (savedBreakdown.length > 0) {
                const oldServices = savedBreakdown.map(item => item.service);
                const services = lead.ServiceInterested ? lead.ServiceInterested.split(',').map(s => s.trim()) : [];
                const newServices = services.filter(s => !oldServices.includes(s));

                const mergedItems = [
                    ...savedBreakdown.map(item => ({
                        service: item.service,
                        total: item.total,
                        tenure: item.tenure,
                        customTenure: item.customTenure,
                        paid: item.paid, // preserve old paid amount so they don't have to enter it again
                        dueDate: item.dueDate,
                        resumeDate: item.resumeDate,
                        invoiceNumber: item.invoiceNumber || '',
                        included: true,
                        isOld: true // Hide old fully paid services here
                    })),
                    ...newServices.map(s => ({
                        service: s,
                        total: '',
                        tenure: '',
                        customTenure: '',
                        paid: '',
                        dueDate: '',
                        resumeDate: '',
                        invoiceNumber: '',
                        included: true,
                        isOld: false // Show new services
                    }))
                ];
                setBillingItems(mergedItems);
            } else {
                const services = lead.ServiceInterested ? lead.ServiceInterested.split(',').map(s => s.trim()) : [];
                setBillingItems(services.map(s => ({
                    service: s,
                    total: '',
                    tenure: '',
                    customTenure: '',
                    paid: '',
                    dueDate: '',
                    resumeDate: '',
                    invoiceNumber: '',
                    included: true,
                    isOld: false
                })));
            }
        }

        setShowPaymentModal(true);
    };


    useEffect(() => {
        if (paymentDate) {
            setBillingItems(prev => prev.map(item => {
                const { resume } = calculateDates(paymentDate, item.tenure, item.customTenure);
                return { ...item, resumeDate: resume };
            }));
        }
    }, [paymentDate]);


    const openMeetingModal = () => {
        if (lead.Status === 'Quotation Needed') {
            setOutcome('quotation');
            setIsMeetingCompleted(true);
        } else {
            setOutcome('Follow-up');
            setIsMeetingCompleted(false);
        }
        setNotes('');
        setShowModal(true);
    };

    const handleToggleMeetingDone = async () => {
        const newValue = !isMeetingCompleted;
        setIsMeetingCompleted(newValue);

        if (newValue) {
            // Trigger email immediately
            try {
                const res = await fetch(`${API_URL}/api/leads/${id}/trigger-thank-you`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                    }
                });
                if (!res.ok) {
                    const data = await res.json();
                    console.error('Failed to trigger email:', data.message);
                } else {
                    console.log('Meeting thank you email triggered on toggle');
                }
            } catch (err) {
                console.error('Email trigger error:', err);
            }
        }
    };

    const handleGenerateAutoQuotation = async () => {
        if (isOnlineRestricted()) return;
        if (!lead.Email) return alert('Lead must have an email address to generate and send a quotation.');

        // Validate that all selected quotations have their required price fields filled
        const hasMissingFields = selectedQuotes.some(q => {
            if (q.type === 'personalized' || q.type === 'website') return !q.devPrice || !q.maintenancePrice;
            if (q.type === 'digitalMarketing') return !q.monthlyPrice;
            if (q.type === 'tokensBoy') return !q.price;
            return false;
        });

        if (hasMissingFields) {
            return alert('Missing required fields! Please fill in all price details for your selected quotations.');
        }

        setSubmitting(true);
        try {
            // Map the internal types to the template types expected by backend
            const formattedQuotes = selectedQuotes.map(q => ({
                ...q,
                type: q.type === 'personalized' ? 'Personalized Application' :
                    q.type === 'digitalMarketing' ? 'Digital Marketing' :
                        q.type === 'website' ? 'Website Development' :
                            q.type === 'tokensBoy' ? 'Tokens Boy' : q.type
            }));

            const res = await fetch(`${API_URL}/api/quotations/generate-quotation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({
                    leadId: id,
                    customerName: lead.FullName,
                    customerEmail: lead.Email,
                    quotations: formattedQuotes, // Array of quotations
                    isMeetingCompleted: isMeetingCompleted ? '1' : '0',
                    notes: notes
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to generate quotations');
            }

            alert('Quotations generated and sent successfully!');
            setShowModal(false);
            navigate('/leads', { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAttendMeeting = async (isFmQuotation = false) => {
        if (isOnlineRestricted()) return;
        const isFmQuotation_ = user?.role === 'Team Lead' && outcome === 'quotation';

        if (!isFmQuotation_ && !notes.trim()) return alert('Please enter meeting notes.');
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('notes', isFmQuotation_ ? 'Quotation uploaded by Team Lead' : notes);
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
            if (outcome === 'rejected') {
                alert('Lead rejected successfully!');
            } else {
                alert('Lead finalized successfully!');
            }
            setShowModal(false);
            navigate('/leads', { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const requestDeleteLead = () => {
        if (isOnlineRestricted()) return;
        setConfirmConfig({
            isOpen: true,
            title: 'Delete Lead',
            message: 'Are you sure you want to permanently delete this lead? This action cannot be undone and will remove all associated meetings and payments.',
            onConfirm: () => executeDeleteLead()
        });
    };

    const executeDeleteLead = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to delete lead');
            alert('Lead deleted successfully');
            navigate('/leads', { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRejectSubmit = async () => {
        if (isOnlineRestricted()) return;
        if (!rejectReason.trim()) return alert('Please enter a rejection reason.');
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}/reject`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({ reason: rejectReason })
            });
            if (!res.ok) throw new Error('Failed to reject lead');
            alert('Lead has been marked as rejected.');
            setShowRejectModal(false);
            navigate('/leads', { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };
    const handleSaveClientDetails = async () => {
        if (!editFormData.fullName || !editFormData.phone || !editFormData.email || !editFormData.companyName || !editFormData.address) {
            return alert('Please fill all mandatory fields (marked with *).');
        }

        // Phone: 10 digits, starts with 6-9
        const phoneRegex = /^[6-9][0-9]{9}$/;
        if (!phoneRegex.test(editFormData.phone)) {
            return alert('Phone number must be 10 digits and start with 6, 7, 8, or 9.');
        }

        // Name: Letters and spaces only
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(editFormData.fullName)) {
            return alert('Full name should contain only letters and spaces.');
        }

        // Email validation (lowercase, must contain exactly one @ and end with .com)
        const cleanedEmail = editFormData.email.trim().replace(/\s/g, '');
        editFormData.email = cleanedEmail;
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.com$/;
        if (!emailRegex.test(cleanedEmail)) {
            return alert('Please enter a valid email address (lowercase ending in .com).');
        }

        if (editFormData.companyName.trim().length < 3) {
            return alert('Company Name must be at least 3 characters long.');
        }
        const companyRegex = /^[A-Za-z0-9\s.,&()'-]+$/;
        if (!companyRegex.test(editFormData.companyName)) {
            return alert('Company Name should contain only letters, numbers, spaces, and standard punctuation (.,&()\'-).');
        }
        if (/^\d+$/.test(editFormData.companyName.trim())) {
            return alert('Company Name cannot be solely numeric.');
        }

        if (editFormData.address.trim().length < 10) {
            return alert('Address must be at least 10 characters long.');
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify(editFormData)
            });
            if (!res.ok) throw new Error('Failed to update client details');
            alert('Client details updated successfully!');
            setShowEditClientModal(false);
            fetchLead();
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveClientSubmit = async () => {
        if (isOnlineRestricted()) return;
        if (!removeClientReason.trim()) return alert('Please enter a reason for removal.');
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}/remove`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({ reason: removeClientReason })
            });
            if (!res.ok) throw new Error('Failed to remove client');
            alert('Client has been successfully removed.');
            setShowRemoveClientModal(false);
            navigate('/leads', { replace: true });
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveServices = async () => {
        if (isOnlineRestricted()) return;
        if (!editedServices.trim() || editedServices.trim().length < 3) return alert('Services must be at least 3 characters long.');
        setSavingServices(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${id}/services`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({ services: editedServices })
            });
            if (!res.ok) throw new Error('Failed to update services');
            alert('Services updated successfully!');
            setIsEditingServices(false);
            setLead(prev => ({ ...prev, ServiceInterested: editedServices }));
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingServices(false);
        }
    };

    const handleQuickEditServices = async () => {
        if (isOnlineRestricted()) return;
        const quickEditServicesStr = quickEditServicesList.map(s => s.type === 'Other' ? s.custom : s.type).filter(Boolean).join(', ');
        if (!quickEditServicesStr.trim()) return alert('Services cannot be empty.');
        if (includeQuotation) {
            if (quotationMode === 'manual' && !quotationFile) {
                return alert('Please upload a quotation PDF.');
            }
            if (quotationMode === 'auto') {
                const hasMissingFields = selectedQuotes.some(q => {
                    if (q.type === 'personalized' || q.type === 'website') return !q.devPrice || !q.maintenancePrice;
                    if (q.type === 'digitalMarketing') return !q.monthlyPrice;
                    if (q.type === 'tokensBoy') return !q.price;
                    return false;
                });
                if (hasMissingFields) return alert('Missing required fields for auto-generation!');
            }
        }

        setSubmitting(true);
        try {
            // 1. Update Services
            const resServices = await fetch(`${API_URL}/api/leads/${id}/services`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` },
                body: JSON.stringify({ services: quickEditServicesStr })
            });
            if (!resServices.ok) throw new Error('Failed to update services');

            // 2. Process Quotation
            if (includeQuotation) {
                if (quotationMode === 'manual') {
                    const formData = new FormData();
                    formData.append('notes', 'Added new services and uploaded quotation');
                    formData.append('outcome', 'quotation');
                    formData.append('isMeetingCompleted', '1');
                    formData.append('quotationPDF', quotationFile);

                    const res = await fetch(`${API_URL}/api/leads/${id}/attend-meeting`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` },
                        body: formData
                    });
                    if (!res.ok) throw new Error('Failed to upload quotation');
                } else if (quotationMode === 'auto') {
                    const formattedQuotes = selectedQuotes.map(q => ({
                        ...q,
                        type: q.type === 'personalized' ? 'Personalized Application' :
                            q.type === 'digitalMarketing' ? 'Digital Marketing' :
                                q.type === 'website' ? 'Website Development' :
                                    q.type === 'tokensBoy' ? 'Tokens Boy' : q.type
                    }));
                    const res = await fetch(`${API_URL}/api/quotations/generate-quotation`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` },
                        body: JSON.stringify({ leadId: id, customerName: lead.FullName, customerEmail: lead.Email, quotations: formattedQuotes })
                    });
                    if (!res.ok) throw new Error('Failed to generate quotation');
                }
            }

            alert('Services updated successfully!');
            setShowEditServiceModal(false);
            setIncludeQuotation(false);
            setLead(prev => ({ ...prev, ServiceInterested: quickEditServicesStr }));
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

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1, width: '100%' }}>
                <header className="responsive-header">
                    <div className="manage-lead-header-left">
                        {(() => {
                            let backPath = location.state?.from || '/leads';
                            let backLabel = location.state?.label || 'Leads';
                            
                            if (!location.state) {
                                if (user?.role === 'Team Lead') {
                                    backPath = '/leads/meeting-followup';
                                    backLabel = 'Meeting Follow-ups';
                                } else if (user?.role === 'Field Executive') {
                                    backPath = '/leads';
                                    backLabel = 'Assigned Meetings Leads';
                                }

                                if (user?.role !== 'Field Executive') {
                                    if (lead.Status === 'Interested') {
                                        backPath = '/leads/interested';
                                        backLabel = 'Interested Leads';
                                    } else if (lead.Status === 'Paid' || lead.Status === 'Due Payment') {
                                        if (user?.role === 'Admin' || user?.role === 'Team Lead') {
                                            backPath = '/admin/clients';
                                            backLabel = 'Client List';
                                        } else {
                                            backPath = '/leads/payment-pending';
                                            backLabel = 'Payments';
                                        }
                                    } else if (lead.Status === 'Quotation' || lead.Status === 'Quotation Done') {
                                        backPath = '/leads/payment-pending';
                                        backLabel = 'Payments';
                                    }
                                }
                            }

                            return (
                                <button onClick={() => navigate(backPath, { replace: true })} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', padding: '8px 14px' }}>← Back to {backLabel}</button>
                            );
                        })()}
                        <h1 style={{ margin: 0 }}>Lead Strategy & Actions</h1>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ padding: '6px 16px', background: lead.Status === 'Rejected' ? '#fee2e2' : '#e0e7ff', color: lead.Status === 'Rejected' ? '#ef4444' : '#6366f1', borderRadius: '20px', fontWeight: '800', fontSize: '0.8rem' }}>{lead.Status}</span>
                    </div>
                </header>

                <div className="glass-card" style={{ padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Building size={20} color="#6366f1" /> Customer Details
                            </h3>
                             <button 
                                onClick={() => {
                                    setEditFormData({
                                        fullName: lead.FullName || '',
                                        companyName: lead.CompanyName || '',
                                        email: lead.Email || '',
                                        phone: lead.Phone || '',
                                        address: lead.Address || '',
                                        serviceInterested: lead.ServiceInterested || '',
                                        meetingDate: lead.MeetingDate ? new Date(lead.MeetingDate).toISOString().split('T')[0] : '',
                                        meetingTime: lead.MeetingTime || '',
                                        meetingFollowupDate: lead.MeetingFollowupDate ? new Date(lead.MeetingFollowupDate).toISOString().split('T')[0] : '',
                                        meetingFollowupTime: lead.MeetingFollowupTime || ''
                                    });
                                    setShowEditClientModal(true);
                                }}
                                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 'bold' }}
                            >
                                <Edit size={16} /> Edit Details
                            </button>
                        </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                        <div><p style={labelStyle}>Full Name</p><p style={{ fontSize: '1.2rem', fontWeight: '700' }}>{lead.FullName}</p></div>
                        <div><p style={labelStyle}>Company</p><p style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>{lead.CompanyName || 'Not Specified'}</p></div>
                        <div><p style={labelStyle}>Phone</p><p style={{ fontWeight: '600' }}>{lead.Phone}</p></div>
                        <div><p style={labelStyle}>Email</p><p style={{ fontWeight: '600', wordBreak: 'break-all' }}>{lead.Email || 'No Email'}</p></div>
                        <div style={{ gridColumn: 'span 2', marginTop: '10px', padding: '15px', background: '#f1f5f9', borderRadius: '12px' }}>
                            <p style={labelStyle}>Initial Call Note</p>
                            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>{lead.CallNote || 'No notes available.'}</p>
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <p style={labelStyle}>Meeting Date</p>
                            <p style={{ fontWeight: '600' }}>
                                {(() => {
                                    const mDate = (lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup')
                                        ? (lead.MeetingFollowupDate || lead.MeetingDate)
                                        : (lead.MeetingDate || lead.MeetingFollowupDate);
                                    return mDate ? new Date(mDate).toLocaleDateString('en-GB') : 'N/A';
                                })()}
                            </p>
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <p style={labelStyle}>Meeting Time</p>
                            <p style={{ fontWeight: '600' }}>
                                {(() => {
                                    return (lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup')
                                        ? (lead.MeetingFollowupTime || lead.MeetingTime || 'N/A')
                                        : (lead.MeetingTime || lead.MeetingFollowupTime || 'N/A');
                                })()}
                            </p>
                        </div>
                        <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                            <p style={labelStyle}>Services Interested</p>
                            <p style={{ fontWeight: '800', color: '#6366f1', fontSize: '1.1rem' }}>{lead.ServiceInterested || 'N/A'}</p>
                        </div>
                        {(lead.Status === 'Rejected' || lead.Status === 'Removed') && (
                            <div style={{ gridColumn: 'span 2', marginTop: '10px', padding: '15px', background: '#fee2e2', borderRadius: '12px' }}>
                                <p style={{...labelStyle, color: '#ef4444'}}>{lead.Status === 'Removed' ? 'Reason for Removal' : 'Rejection Reason'}</p>
                                <p style={{ color: '#991b1b', fontSize: '0.95rem', lineHeight: '1.5', fontWeight: '600' }}>{lead.RejectedReason || 'No reason provided.'}</p>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '1px solid #e2e8f0' }}>
                        <h3 style={{ marginBottom: '20px' }}>Quick Actions</h3>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            {lead.Status === 'Paid' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                                    <button className="btn-primary" style={{ background: '#6366f1', width: '100%' }} onClick={openPaymentModal}>
                                        <RefreshCw size={18} /> Resume Service / Next Cycle
                                    </button>
                                    <button className="btn-primary" style={{ background: '#f59e0b', width: '100%' }} onClick={() => { setQuickEditServicesList(initializeEditServices(lead.ServiceInterested)); setShowEditServiceModal(true); }}>
                                        <Edit size={18} /> Edit Services
                                    </button>
                                    {user?.role !== 'Admin' && (
                                        <button className="btn-primary" style={{ background: '#ef4444', width: '100%' }} onClick={() => setShowRemoveClientModal(true)}>
                                            <XCircle size={18} /> Remove Client
                                        </button>
                                    )}
                                    {user?.role === 'Admin' && (
                                        <button
                                            className="btn-danger"
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            onClick={requestDeleteLead}
                                            disabled={submitting}
                                        >
                                            <Trash2 size={18} />
                                            {submitting ? 'Deleting...' : 'Delete Client Permanently'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {(user?.role === 'Admin' || lead.Status === 'Call Follow-up' || lead.Status === 'Follow-up' || lead.Status === 'Interested' || lead.Status === 'Quotation Needed' || lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup') && lead.Status !== 'Rejected' && lead.Status !== 'Removed' && (
                                        user?.role === 'Field Executive' && lead.Status === 'Quotation Needed' ? (
                                            <div style={{ flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                <CheckCircle2 size={18} color="#10b981" /> Request forwarded to team lead
                                            </div>
                                        ) : (
                                            <button className="btn-primary" style={{ flex: 1 }} onClick={openMeetingModal}>
                                                <Calendar size={18} /> {lead.Status === 'Quotation Needed' ? 'Upload Quotation' : 'Attend Meeting / Finalize'}
                                            </button>
                                        )
                                    )}

                                    {(lead.Status === 'Quotation' || lead.Status === 'Quotation Done' || lead.Status === 'Due Payment') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
                                            <button className="btn-primary" style={{ background: '#10b981', width: '100%' }} onClick={openPaymentModal}>
                                                <CreditCard size={window.Capacitor ? 24 : 18} /> {lead.Status === 'Due Payment' ? 'Receive Balance Payment' : 'Receive Payments'}
                                            </button>
                                            {user?.role === 'Team Lead' && (lead.Status === 'Quotation' || lead.Status === 'Quotation Done') && (
                                                <button className="btn-primary" style={{ background: '#ef4444', width: '100%' }} onClick={() => setShowRejectModal(true)}>
                                                    <XCircle size={18} /> Rejected
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {lead.Status === 'Paid' && (
                                        <button className="btn-primary" style={{ background: '#10b981', flex: 1 }} onClick={openPaymentModal}>
                                            <RefreshCw size={18} /> Resume Service / Next Cycle
                                        </button>
                                    )}
                                    {user?.role === 'Admin' && lead.Status !== 'Paid' && (
                                        <button
                                            className="btn-danger"
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            onClick={requestDeleteLead}
                                            disabled={submitting}
                                        >
                                            <Trash2 size={18} />
                                            Delete Lead
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {parseFloat(lead.LatestPendingAmount) > 0 && (
                            <div style={{ marginTop: '30px', padding: '25px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Attention: Payment Pending</p>
                                        <h2 style={{ fontSize: '2.5rem', color: '#ef4444', margin: '5px 0' }}>₹{parseFloat(lead.LatestPendingAmount).toLocaleString()}</h2>
                                    </div>
                                    <button className="btn-primary" style={{ width: 'auto', padding: '12px 24px', background: '#ef4444' }} onClick={openPaymentModal}>Collect Balance</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Finalize Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ marginBottom: '10px' }}>Meeting Outcome</h2>
                        {/* Hide standard fields if FM is uploading quotation for already requested lead */}
                        {user?.role === 'Team Lead' && lead.Status === 'Quotation Needed' && outcome === 'quotation' ? (
                            <>
                                <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} className="fade-in">
                                    <p style={{ ...labelStyle, marginBottom: '10px', color: '#6366f1' }}>Reference Meeting Details</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                        <div>
                                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Meeting Date</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                                {lead.meetings?.find(m => m.MeetingOutcome === 'quotation')?.MeetingDate
                                                    ? new Date(lead.meetings.find(m => m.MeetingOutcome === 'quotation').MeetingDate).toLocaleDateString('en-GB')
                                                    : 'Recent'}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Requested By</p>
                                            <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>{lead.meetings?.find(m => m.MeetingOutcome === 'quotation')?.FinalizedByRole || 'Staff'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Interested Services</p>
                                        <p style={{ fontSize: '0.9rem', fontWeight: '800', color: '#6366f1' }}>{lead.ServiceInterested || 'N/A'}</p>
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Meeting Notes</p>
                                        <p style={{ fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                                            "{lead.meetings?.find(m => m.MeetingOutcome === 'quotation')?.MeetingNotes || 'No specific notes recorded.'}"
                                        </p>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                        <button onClick={() => setQuotationMode('manual')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', borderColor: quotationMode === 'manual' ? '#6366f1' : '#e2e8f0', background: quotationMode === 'manual' ? '#f5f7ff' : 'white', color: quotationMode === 'manual' ? '#6366f1' : '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Upload Manual</button>
                                        <button onClick={() => setQuotationMode('auto')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', borderColor: quotationMode === 'auto' ? '#6366f1' : '#e2e8f0', background: quotationMode === 'auto' ? '#f5f7ff' : 'white', color: quotationMode === 'auto' ? '#6366f1' : '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Auto Generate</button>
                                    </div>

                                    {quotationMode === 'manual' ? (
                                        <div className="fade-in">
                                            <label style={labelStyle}>Upload Quotation (PDF) *</label>
                                            <input type="file" accept=".pdf" className="input-field" onChange={e => setQuotationFile(e.target.files[0])} required />
                                        </div>
                                    ) : (
                                        <div className="fade-in" style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px', marginBottom: '15px' }}>
                                                {selectedQuotes.map((q, idx) => (
                                                    <div key={idx} style={{ marginBottom: '20px', padding: '15px', background: 'white', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                            <span style={{ fontWeight: '700', color: '#6366f1', fontSize: '0.85rem' }}>Quotation #{idx + 1}</span>
                                                            {selectedQuotes.length > 1 && (
                                                                <button onClick={() => removeQuoteOption(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '5px' }}><XCircle size={18} /></button>
                                                            )}
                                                        </div>

                                                        <label style={labelStyle}>Quotation Type</label>
                                                        <select className="input-field" value={q.type} onChange={e => updateQuoteOption(idx, 'type', e.target.value)} style={{ marginBottom: '15px' }}>
                                                            <option value="personalized">Personalized Application</option>
                                                            <option value="digitalMarketing">Digital Marketing</option>
                                                            <option value="website">Website Development</option>
                                                            <option value="tokensBoy">Tokens Boy App</option>
                                                        </select>

                                                        {(q.type === 'personalized' || q.type === 'website') && (
                                                            <>
                                                                <label style={labelStyle}>Development Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.devPrice} onChange={e => updateQuoteOption(idx, 'devPrice', e.target.value)} placeholder="e.g. 50000" style={{ marginBottom: '10px' }} />
                                                                <label style={labelStyle}>Maintenance Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.maintenancePrice} onChange={e => updateQuoteOption(idx, 'maintenancePrice', e.target.value)} placeholder="e.g. 2000" style={{ marginBottom: '10px' }} />
                                                            </>
                                                        )}

                                                        {q.type === 'digitalMarketing' && (
                                                            <>
                                                                <label style={labelStyle}>Monthly Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.monthlyPrice} onChange={e => updateQuoteOption(idx, 'monthlyPrice', e.target.value)} placeholder="e.g. 15000" style={{ marginBottom: '10px' }} />
                                                            </>
                                                        )}

                                                        {q.type === 'tokensBoy' && (
                                                            <>
                                                                <label style={labelStyle}>Application Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.price} onChange={e => updateQuoteOption(idx, 'price', e.target.value)} placeholder="e.g. 10000" />
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                                <div ref={quoteEndRef} />
                                            </div>

                                            <button
                                                onClick={addQuoteOption}
                                                style={{ width: '100%', padding: '10px', background: 'white', border: '2px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                <RefreshCw size={16} /> Add Another Quotation
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={quotationMode === 'auto' ? handleGenerateAutoQuotation : handleAttendMeeting}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Processing...' : (quotationMode === 'auto' ? `Generate & Send ${selectedQuotes.length} Quote(s)` : 'Finalize & Send Quotation')}
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                    <span style={{ fontWeight: '700' }}>Meeting Done?</span>
                                    <button onClick={handleToggleMeetingDone} className={`toggle-btn ${isMeetingCompleted ? 'active' : ''}`}>
                                        <div className="toggle-handle" />
                                    </button>
                                </div>

                                {isMeetingCompleted || lead.Status === 'Quotation Needed' ? (
                                    <>
                                        <label style={labelStyle}>Meeting Notes *</label>
                                        <textarea className="input-field" style={{ height: '100px', marginBottom: '20px' }} value={notes} onChange={e => setNotes(stripEmojis(e.target.value))} placeholder="Enter detailed meeting summary..." required />

                                        <div style={{ marginBottom: '25px', padding: '15px', background: '#f0f4ff', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                <p style={{ ...labelStyle, margin: 0, fontSize: '0.75rem', color: '#4338ca' }}>Lead's Interested Services</p>
                                                {!isEditingServices ? (
                                                    <button onClick={() => { setIsEditingServices(true); setEditedServices(lead.ServiceInterested || ''); }} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Edit Services</button>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button onClick={handleSaveServices} disabled={savingServices} style={{ background: '#10b981', border: 'none', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px' }}>{savingServices ? 'Saving...' : 'Save'}</button>
                                                        <button onClick={() => setIsEditingServices(false)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Cancel</button>
                                                    </div>
                                                )}
                                            </div>
                                            {!isEditingServices ? (
                                                <p style={{ margin: 0, fontWeight: '800', color: '#1e1b4b', fontSize: '1rem' }}>{lead.ServiceInterested || 'None specified'}</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
                                                    <select 
                                                        className="input-field" 
                                                        style={{ padding: '8px', width: '100%' }}
                                                        value={['Web site/page development', 'Web Application development', 'Digital Marketing', 'Android/ios Application development', 'SEO', 'Graphic Design', 'IVR service'].includes(editedServices) ? editedServices : (editedServices ? 'Other' : '')} 
                                                        onChange={(e) => {
                                                            if (e.target.value !== 'Other') {
                                                                setEditedServices(e.target.value);
                                                            } else {
                                                                setEditedServices('');
                                                            }
                                                        }}
                                                    >
                                                        <option value="" disabled>Select Service</option>
                                                        <option value="Website Development">Website Development</option>
                                                        <option value="Web Application development">Web Application development</option>
                                                        <option value="Digital Marketing">Digital Marketing</option>
                                                        <option value="Android/ios Application development">Android/ios Application development</option>
                                                        <option value="SEO">SEO</option>
                                                        <option value="Graphic Design">Graphic Design</option>
                                                        <option value="IVR service">IVR service</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                    {(!['Website Development', 'Web Application development', 'Digital Marketing', 'Android/ios Application development', 'SEO', 'Graphic Design', 'IVR service', ''].includes(editedServices) || (editedServices && !['Website Development', 'Web Application development', 'Digital Marketing', 'Android/ios Application development', 'SEO', 'Graphic Design', 'IVR service'].includes(editedServices))) && (
                                                        <input 
                                                            type="text" 
                                                            className="input-field" 
                                                            value={editedServices} 
                                                            onChange={(e) => setEditedServices(stripEmojis(e.target.value))} 
                                                            style={{ padding: '8px', width: '100%' }}
                                                            placeholder="Enter custom service"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <label style={labelStyle}>Next Step</label>
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                            {['Follow-up', 'quotation', 'rejected'].map(opt => (
                                                <button key={opt} onClick={() => setOutcome(opt)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid', borderColor: outcome === opt ? '#6366f1' : '#f1f5f9', background: outcome === opt ? '#f5f7ff' : 'white', color: outcome === opt ? '#6366f1' : '#64748b', fontWeight: '800', cursor: 'pointer' }}>{opt.toUpperCase()}</button>
                                            ))}
                                        </div>

                                        {outcome === 'Follow-up' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }} className="fade-in">
                                                <div>
                                                    <label style={labelStyle}>Next Date and Time *</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                                        <input type="date" className="input-field" style={{ paddingLeft: '36px' }} value={followupDate} onChange={e => setFollowupDate(e.target.value)} required />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>PREF. Time *</label>
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

                                        {outcome === 'quotation' && (
                                            <div style={{ marginBottom: '20px' }} className="fade-in">
                                                {user?.role === 'Field Executive' ? (
                                                    <div style={{ padding: '20px', background: '#f5f7ff', borderRadius: '15px', border: '1px solid #c3dafe', textAlign: 'center', marginBottom: '20px' }}>
                                                        <p style={{ margin: 0, fontWeight: '700', color: '#1e40af' }}>Quotation request will be forwarded to Team Lead for generation and upload.</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                                            <button onClick={() => setQuotationMode('manual')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', borderColor: quotationMode === 'manual' ? '#6366f1' : '#e2e8f0', background: quotationMode === 'manual' ? '#f5f7ff' : 'white', color: quotationMode === 'manual' ? '#6366f1' : '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Upload Manual</button>
                                                            <button onClick={() => setQuotationMode('auto')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', borderColor: quotationMode === 'auto' ? '#6366f1' : '#e2e8f0', background: quotationMode === 'auto' ? '#f5f7ff' : 'white', color: quotationMode === 'auto' ? '#6366f1' : '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Auto Generate</button>
                                                        </div>

                                                        {quotationMode === 'manual' ? (
                                                            <div className="fade-in">
                                                                <label style={labelStyle}>Upload Quotation (PDF) *</label>
                                                                <input type="file" accept=".pdf" className="input-field" onChange={e => setQuotationFile(e.target.files[0])} required />
                                                            </div>
                                                        ) : (
                                                            <div className="fade-in" style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                                                                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px', marginBottom: '15px' }}>
                                                                    {selectedQuotes.map((q, idx) => (
                                                                        <div key={idx} style={{ marginBottom: '20px', padding: '15px', background: 'white', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                                                <span style={{ fontWeight: '700', color: '#6366f1', fontSize: '0.85rem' }}>Quotation #{idx + 1}</span>
                                                                                {selectedQuotes.length > 1 && (
                                                                                    <button onClick={() => removeQuoteOption(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '5px' }}><XCircle size={18} /></button>
                                                                                )}
                                                                            </div>

                                                                            <label style={labelStyle}>Quotation Type</label>
                                                                            <select className="input-field" value={q.type} onChange={e => updateQuoteOption(idx, 'type', e.target.value)} style={{ marginBottom: '15px' }}>
                                                                                <option value="personalized">Personalized Application</option>
                                                                                <option value="digitalMarketing">Digital Marketing</option>
                                                                                <option value="website">Website Development</option>
                                                                                <option value="tokensBoy">Tokens Boy App</option>
                                                                            </select>

                                                                            {(q.type === 'personalized' || q.type === 'website') && (
                                                                                <>
                                                                                    <label style={labelStyle}>Development Price (₹)</label>
                                                                                    <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.devPrice} onChange={e => updateQuoteOption(idx, 'devPrice', e.target.value)} placeholder="e.g. 50000" style={{ marginBottom: '10px' }} />
                                                                                    <label style={labelStyle}>Maintenance Price (₹)</label>
                                                                                    <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.maintenancePrice} onChange={e => updateQuoteOption(idx, 'maintenancePrice', e.target.value)} placeholder="e.g. 2000" style={{ marginBottom: '10px' }} />
                                                                                </>
                                                                            )}

                                                                            {q.type === 'digitalMarketing' && (
                                                                                <>
                                                                                    <label style={labelStyle}>Monthly Price (₹)</label>
                                                                                    <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.monthlyPrice} onChange={e => updateQuoteOption(idx, 'monthlyPrice', e.target.value)} placeholder="e.g. 15000" style={{ marginBottom: '10px' }} />
                                                                                </>
                                                                            )}

                                                                            {q.type === 'tokensBoy' && (
                                                                                <>
                                                                                    <label style={labelStyle}>Application Price (₹)</label>
                                                                                    <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.price} onChange={e => updateQuoteOption(idx, 'price', e.target.value)} placeholder="e.g. 10000" />
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    <div ref={quoteEndRef} />
                                                                </div>

                                                                <button
                                                                    onClick={addQuoteOption}
                                                                    style={{ width: '100%', padding: '10px', background: 'white', border: '2px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                                >
                                                                    <RefreshCw size={16} /> Add Another Quotation
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {outcome === 'rejected' && (
                                            <div style={{ padding: '15px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2', marginBottom: '20px' }} className="fade-in">
                                                <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>Marking this lead as rejected will notify the Admin. Please ensure you have added notes explaining why.</p>
                                            </div>
                                        )}

                                        <button
                                            className="btn-primary"
                                            onClick={(user?.role !== 'Field Executive' && quotationMode === 'auto' && outcome === 'quotation') ? handleGenerateAutoQuotation : handleAttendMeeting}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Processing...' : ((user?.role !== 'Field Executive' && quotationMode === 'auto' && outcome === 'quotation') ? `Generate & Send ${selectedQuotes.length} Quote(s)` : 'Submit Action')}
                                        </button>
                                    </>
                                ) : (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', margin: '40px 0' }}>Toggle 'Meeting Done' to continue.</p>
                                )}
                            </>
                        )}
                        <button className="btn-secondary" style={{ width: '100%', marginTop: '15px', padding: '12px' }} onClick={() => setShowModal(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{isBalancePayment ? 'Collect Balance Payment' : 'Receive Initial Payment'}</h2>
                                {isBalancePayment && (
                                    <p style={{ margin: '5px 0 0', color: '#f97316', fontWeight: '700' }}>
                                        Total Pending: ₹{parseFloat(lead.LatestPendingAmount || 0).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>Payment Date:</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input type="date" className="input-field" style={{ width: 'auto', paddingLeft: '36px' }} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {billingItems.map((item, index) => {
                                if (item.isOld) return null;
                                return (
                                <div key={index} className="glass-card" style={{ padding: '24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', position: 'relative', opacity: item.included ? 1 : 0.6, transition: '0.3s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    {/* Card Header with Toggle */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.included ? '#10b981' : '#cbd5e1' }}></div>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{item.service || 'General Service'}</h3>
                                        </div>
                                        {isBalancePayment && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: item.included ? '#10b981' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {item.included ? 'Ready to Collect' : 'Skipped'}
                                                </span>
                                                <button
                                                    className={`toggle-btn ${item.included ? 'active' : ''}`}
                                                    onClick={() => updateBillingItem(index, 'included', !item.included)}
                                                >
                                                    <div className="toggle-handle"></div>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Billing Details Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
                                        <div>
                                            <label style={labelStyle}>Total Amount *</label>
                                            <input
                                                className="input-field"
                                                placeholder="₹ 0"
                                                value={item.total}
                                                onChange={e => updateBillingItem(index, 'total', e.target.value.replace(/\D/g, ''))}
                                                disabled={!item.included}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Plan / Tenure</label>
                                            <select
                                                className="input-field"
                                                value={item.tenure}
                                                onChange={e => updateBillingItem(index, 'tenure', e.target.value)}
                                                style={{ appearance: 'auto' }}
                                                disabled={!item.included}
                                            >
                                                <option value="">Select Plan</option>
                                                <option value="1">1 Month</option>
                                                <option value="2">2 Months</option>
                                                <option value="3">3 Months</option>
                                                <option value="6">6 Months</option>
                                                <option value="12">1 Year</option>
                                                <option value="full">Full Payment</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Paid Amount *</label>
                                            <input
                                                className="input-field"
                                                placeholder="₹ 0"
                                                style={{ fontWeight: '700', color: '#10b981', border: item.included && !item.paid ? '1px solid #10b981' : '1px solid #e2e8f0' }}
                                                value={item.paid}
                                                onChange={e => updateBillingItem(index, 'paid', e.target.value.replace(/\D/g, ''))}
                                                disabled={!item.included}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Current Pending</label>
                                            <div style={{ padding: '12px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3', fontWeight: '800', color: '#ef4444', textAlign: 'center' }}>
                                                ₹{Math.max(0, (parseFloat(item.total || 0) - parseFloat(item.paid || 0))).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoice Number Field */}
                                    <div style={{ marginTop: '20px' }}>
                                        <label style={labelStyle}>Invoice Number</label>
                                        <input
                                            className="input-field"
                                            placeholder="Enter Invoice Number"
                                            value={item.invoiceNumber || ''}
                                            onChange={e => updateBillingItem(index, 'invoiceNumber', e.target.value)}
                                            disabled={!item.included}
                                        />
                                    </div>

                                    {/* Dates Section */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.7rem', color: '#64748b' }}>Due Date</label>
                                            <div style={{ position: 'relative' }}>
                                                <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                                <input 
                                                    type="date" 
                                                    className="input-field" 
                                                    style={{ width: '100%', fontSize: '0.9rem', fontWeight: '600', paddingLeft: '36px' }}
                                                    value={item.dueDate || ''}
                                                    onChange={e => updateBillingItem(index, 'dueDate', e.target.value)}
                                                    disabled={!item.included}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.7rem', color: '#64748b' }}>Resume Date</label>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#6366f1' }}>{item.resumeDate && item.resumeDate !== 'N/A' ? item.resumeDate.split('-').reverse().join('-') : 'N/A'}</div>
                                        </div>
                                    </div>

                                    {item.tenure === 'other' && (
                                        <div style={{ marginTop: '15px' }}>
                                            <label style={labelStyle}>Specify Months</label>
                                            <input
                                                type="number"
                                                className="input-field"
                                                placeholder="Months"
                                                value={item.customTenure}
                                                onChange={e => updateBillingItem(index, 'customTenure', e.target.value)}
                                                disabled={!item.included}
                                            />
                                        </div>
                                    )}
                                </div>
                                );
                            })}

                        </div>

                        <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div>
                                    <p style={{ ...labelStyle, margin: 0 }}>Selected Billing</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem' }}>₹{billingItems.filter(i => i.included).reduce((acc, i) => acc + parseFloat(i.total || 0), 0).toLocaleString()}</h3>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ ...labelStyle, margin: 0 }}>Selected Pending</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#f97316' }}>₹{billingItems.filter(i => i.included).reduce((acc, i) => acc + (parseFloat(i.total || 0) - parseFloat(i.paid || 0)), 0).toLocaleString()}</h3>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ ...labelStyle, margin: 0 }}>Selected Paid</p>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#10b981' }}>₹{billingItems.filter(i => i.included).reduce((acc, i) => acc + parseFloat(i.paid || 0), 0).toLocaleString()}</h3>
                                </div>
                            </div>
                            <button className="btn-primary" onClick={handleAcceptPayment} disabled={submitting}>
                                {submitting ? 'Recording...' : (isBalancePayment ? 'Confirm Balance Payment' : 'Confirm Initial Payment')}
                            </button>
                            <button className="btn-secondary" style={{ width: '100%', marginTop: '15px', padding: '12px' }} onClick={() => setShowPaymentModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <h2 style={{ marginBottom: '15px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={22} /> Reject Lead</h2>
                        <label style={labelStyle}>Rejection Reason *</label>
                        <textarea 
                            className="input-field" 
                            style={{ height: '100px', marginBottom: '20px' }} 
                            value={rejectReason} 
                            onChange={e => setRejectReason(stripEmojis(e.target.value))} 
                            placeholder="Why is this lead being rejected?" 
                            required 
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={handleRejectSubmit} disabled={submitting}>
                                {submitting ? 'Processing...' : 'Confirm Reject'}
                            </button>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowRejectModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Client Modal */}
            {showRemoveClientModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <h2 style={{ marginBottom: '15px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={22} /> Remove Client</h2>
                        <label style={labelStyle}>Reason for Removal *</label>
                        <textarea 
                            className="input-field" 
                            style={{ height: '100px', marginBottom: '20px' }} 
                            value={removeClientReason} 
                            onChange={e => setRemoveClientReason(stripEmojis(e.target.value))} 
                            placeholder="Why is this client being removed?" 
                            required 
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={handleRemoveClientSubmit} disabled={submitting}>
                                {submitting ? 'Processing...' : 'Confirm Removal'}
                            </button>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowRemoveClientModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Client Details Modal */}
            {showEditClientModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Edit size={22} color="#6366f1" /> Edit Client Details</h2>
                        
                        <label style={labelStyle}>Full Name *</label>
                        <input className="input-field" style={{ marginBottom: '15px' }} value={editFormData.fullName} onChange={e => setEditFormData({...editFormData, fullName: stripEmojis(e.target.value)})} placeholder="Client Name" />
                        
                        <label style={labelStyle}>Company Name *</label>
                        <input className="input-field" style={{ marginBottom: '15px' }} value={editFormData.companyName} onChange={e => setEditFormData({...editFormData, companyName: stripEmojis(e.target.value)})} placeholder="Company Name" />
                        
                        <label style={labelStyle}>Phone Number *</label>
                        <input className="input-field" style={{ marginBottom: '15px' }} value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value.replace(/[^0-9]/g, '').substring(0,10)})} placeholder="10 Digit Number" />
                        
                        <label style={labelStyle}>Email Address *</label>
                        <input
                            type="text"
                            className="input-field"
                            style={{ marginBottom: '15px' }}
                            value={editFormData.email}
                            onChange={e => setEditFormData({...editFormData, email: stripEmojis(e.target.value).toLowerCase().replace(/\s/g, '')})}
                            onKeyDown={e => { if (e.key === ' ' || e.code === 'Space') e.preventDefault(); }}
                            onBlur={() => setEditFormData(prev => ({ ...prev, email: prev.email.trim().replace(/\s/g, '') }))}
                            placeholder="Email Address"
                        />

                        <label style={labelStyle}>Services Interested</label>
                        <input className="input-field" style={{ marginBottom: '15px' }} value={editFormData.serviceInterested || ''} onChange={e => setEditFormData({...editFormData, serviceInterested: stripEmojis(e.target.value)})} placeholder="e.g. Website Development, SEO" />

                        <label style={labelStyle}>Address *</label>
                        <textarea className="input-field" style={{ height: '80px', marginBottom: '20px' }} value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: stripEmojis(e.target.value)})} placeholder="Full Address" />
                        
                        {(lead.Status === 'Interested' || lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup') && (
                            <>
                                <label style={labelStyle}>Meeting Date</label>
                                {(lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup') ? (
                                    <input 
                                        type="date" 
                                        className="input-field" 
                                        style={{ marginBottom: '15px' }} 
                                        value={editFormData.meetingFollowupDate} 
                                        onChange={e => setEditFormData({...editFormData, meetingFollowupDate: e.target.value})} 
                                    />
                                ) : (
                                    <input 
                                        type="date" 
                                        className="input-field" 
                                        style={{ marginBottom: '15px' }} 
                                        value={editFormData.meetingDate} 
                                        onChange={e => setEditFormData({...editFormData, meetingDate: e.target.value})} 
                                    />
                                )}

                                <label style={labelStyle}>Meeting Time</label>
                                {(lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup') ? (
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        style={{ marginBottom: '15px' }} 
                                        value={editFormData.meetingFollowupTime} 
                                        onChange={e => setEditFormData({...editFormData, meetingFollowupTime: e.target.value})} 
                                        placeholder="e.g. 10:30 AM" 
                                    />
                                ) : (
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        style={{ marginBottom: '15px' }} 
                                        value={editFormData.meetingTime} 
                                        onChange={e => setEditFormData({...editFormData, meetingTime: e.target.value})} 
                                        placeholder="e.g. 10:30 AM" 
                                    />
                                )}
                            </>
                        )}
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveClientDetails} disabled={submitting}>
                                {submitting ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowEditClientModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Services Modal (For Paid Leads) */}
            {showEditServiceModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '15px' }}>Edit Services & Quotation</h2>
                        
                        <label style={labelStyle}>Interested Services</label>
                        {quickEditServicesList.map((service, index) => (
                            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <select className="input-field" value={service.type} onChange={(e) => {
                                    const newList = [...quickEditServicesList];
                                    newList[index].type = e.target.value;
                                    setQuickEditServicesList(newList);
                                }} style={{ flex: 1, padding: '12px' }}>
                                    <option value="">Select a service...</option>
                                    {defaultServices.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                {service.type === 'Other' && (
                                    <input className="input-field" type="text" placeholder="Specify..." value={service.custom} onChange={(e) => {
                                        const newList = [...quickEditServicesList];
                                        newList[index].custom = stripEmojis(e.target.value);
                                        setQuickEditServicesList(newList);
                                    }} style={{ flex: 1, padding: '12px' }} />
                                )}
                                {quickEditServicesList.length > 1 && (
                                    <button onClick={() => {
                                        setQuickEditServicesList(quickEditServicesList.filter((_, i) => i !== index));
                                    }} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' }}><XCircle size={18} /></button>
                                )}
                            </div>
                        ))}
                        <button onClick={() => setQuickEditServicesList([...quickEditServicesList, { type: '', custom: '' }])} style={{ background: 'none', border: '1px dashed #6366f1', color: '#6366f1', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '20px' }}>+ Add Service</button>

                        <div style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: includeQuotation ? '15px' : '0' }}>
                                <input type="checkbox" id="includeQuote" checked={includeQuotation} onChange={e => setIncludeQuotation(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                <label htmlFor="includeQuote" style={{ fontWeight: '700', cursor: 'pointer', color: '#1e293b' }}>Send new quotation for these services</label>
                            </div>

                            {includeQuotation && (
                                <div className="fade-in" style={{ paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                        <button onClick={() => setQuotationMode('manual')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', borderColor: quotationMode === 'manual' ? '#6366f1' : '#e2e8f0', background: quotationMode === 'manual' ? '#f5f7ff' : 'white', color: quotationMode === 'manual' ? '#6366f1' : '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Upload Manual</button>
                                        <button onClick={() => setQuotationMode('auto')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', borderColor: quotationMode === 'auto' ? '#6366f1' : '#e2e8f0', background: quotationMode === 'auto' ? '#f5f7ff' : 'white', color: quotationMode === 'auto' ? '#6366f1' : '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Auto Generate</button>
                                    </div>

                                    {quotationMode === 'manual' ? (
                                        <div className="fade-in">
                                            <label style={labelStyle}>Upload Quotation (PDF) *</label>
                                            <input type="file" accept=".pdf" className="input-field" onChange={e => setQuotationFile(e.target.files[0])} />
                                        </div>
                                    ) : (
                                        <div className="fade-in" style={{ padding: '15px', background: 'white', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '5px', marginBottom: '15px' }}>
                                                {selectedQuotes.map((q, idx) => (
                                                    <div key={idx} style={{ marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                            <span style={{ fontWeight: '700', color: '#6366f1', fontSize: '0.85rem' }}>Quotation #{idx + 1}</span>
                                                            {selectedQuotes.length > 1 && (
                                                                <button onClick={() => removeQuoteOption(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '5px' }}><XCircle size={18} /></button>
                                                            )}
                                                        </div>

                                                        <label style={labelStyle}>Quotation Type</label>
                                                        <select className="input-field" value={q.type} onChange={e => updateQuoteOption(idx, 'type', e.target.value)} style={{ marginBottom: '15px' }}>
                                                            <option value="personalized">Personalized Application</option>
                                                            <option value="digitalMarketing">Digital Marketing</option>
                                                            <option value="website">Website Development</option>
                                                            <option value="tokensBoy">Tokens Boy App</option>
                                                        </select>

                                                        {(q.type === 'personalized' || q.type === 'website') && (
                                                            <>
                                                                <label style={labelStyle}>Development Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.devPrice} onChange={e => updateQuoteOption(idx, 'devPrice', e.target.value)} placeholder="e.g. 50000" style={{ marginBottom: '10px' }} />
                                                                <label style={labelStyle}>Maintenance Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.maintenancePrice} onChange={e => updateQuoteOption(idx, 'maintenancePrice', e.target.value)} placeholder="e.g. 2000" style={{ marginBottom: '10px' }} />
                                                            </>
                                                        )}

                                                        {q.type === 'digitalMarketing' && (
                                                            <>
                                                                <label style={labelStyle}>Monthly Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.monthlyPrice} onChange={e => updateQuoteOption(idx, 'monthlyPrice', e.target.value)} placeholder="e.g. 15000" style={{ marginBottom: '10px' }} />
                                                            </>
                                                        )}

                                                        {q.type === 'tokensBoy' && (
                                                            <>
                                                                <label style={labelStyle}>Application Price (₹)</label>
                                                                <input type="number" min="0" onKeyDown={handleNumberKeyDown} className="input-field" value={q.price} onChange={e => updateQuoteOption(idx, 'price', e.target.value)} placeholder="e.g. 10000" />
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                                <div ref={quoteEndRef} />
                                            </div>

                                            <button
                                                onClick={addQuoteOption}
                                                style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                <RefreshCw size={16} /> Add Another Quotation
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-primary" onClick={handleQuickEditServices} disabled={submitting}>
                                {submitting ? 'Processing...' : (includeQuotation ? 'Save & Send Quotation' : 'Save Services')}
                            </button>
                            <button className="btn-secondary" onClick={() => setShowEditServiceModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; alignItems: center; justifyContent: center; backdrop-filter: blur(4px); }
                .modal-content { background: white; width: 500px; padding: 40px; borderRadius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); -ms-overflow-style: none; scrollbar-width: none; }
                .modal-content::-webkit-scrollbar { display: none; }
                .toggle-btn { width: 54px; height: 28px; border-radius: 14px; background: #cbd5e1; border: none; cursor: pointer; position: relative; transition: 0.3s; }
                .toggle-btn.active { background: #10b981; }
                .toggle-handle { width: 22px; height: 22px; background: white; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: 0.3s; }
                .active .toggle-handle { left: 29px; }
            `}</style>

            {/* Custom Confirm Modal for ManageLead */}
            {confirmConfig.isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
                }}>
                    <div style={{
                        background: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '50%' }}>
                                <AlertTriangle size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>{confirmConfig.title}</h2>
                        </div>
                        
                        <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.5', marginBottom: '24px' }}>
                            {confirmConfig.message}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null })}
                                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}
                                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    confirmConfig.onConfirm();
                                    setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null });
                                }}
                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                                onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                                onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageLead;
