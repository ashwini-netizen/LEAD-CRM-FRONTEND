import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, Edit, Search, Loader, RefreshCw, FileText, Upload, Download, ArrowLeft, Calendar, Trash2, AlertTriangle, CheckSquare, Square, X, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, RotateCcw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { savePDF } from '../utils/pdfDownload';
import UserHeader from '../components/UserHeader';
import { stripEmojis } from '../utils/stringUtils';
import { formatCleanTime } from '../utils/notificationSync';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const statusColors = {
    'Converted': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Interested': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Not Interested': { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
    'Follow-up': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Call Follow-up': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'meetingFollowup': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    'Busy': { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    'Hold': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Switch Off': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Speaking with Someone Else': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Speaking to Someone Else': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Incoming Not Available': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Incoming Call Not Available': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Not Answering': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Not Answered': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Processing': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Out of Service': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Invalid': { bg: 'rgba(239,68,68,0.08)', color: '#ef4444' },
    'not available': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Quotation': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Quotation Needed': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Meeting Done': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Meeting Attended': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Meeting Follow-up': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    'Meeting Followup': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    'Wrong Number': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'Direct Visit': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    'Active': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Expired': { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
    'Temporarily Closed': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Permanently Closed': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'Upgraded': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    'Withdrawn': { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
    'Paid': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Due Payment': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Completed': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
};

const toTitleCase = (str) => {
    if (!str) return '';
    return str
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const canonicalStatusesCE = [
    'Interested',
    'Not Interested',
    'Follow-up',
    'Not Answering',
    'Busy',
    'Switch Off',
    'Incoming Not Available',
    'Speaking with Someone Else',
    'Hold',
    'Invalid',
    'Wrong Number',
    'Direct Visit',
    'Converted',
    'Processing',
    'Out of Service',
    'Completed',
    'Active',
    'Expired',
    'Temporarily Closed',
    'Permanently Closed',
    'Upgraded',
    'Withdrawn',
    'Paid',
    'Due Payment',
    'Quotation',
    'Meeting Done',
    'Meeting Attended',
    'Meeting Follow-up'
];

const getCanonicalStatusCE = (status) => {
    if (!status || typeof status !== 'string') return '';
    const s = status.trim().toLowerCase();
    if (!s) return '';

    // Standard conversions & common CRM statuses
    if (s === 'converted' || s === 'conversion') return 'Converted';
    if (s === 'interested' || s === 'intrested') return 'Interested';
    if (s === 'not interested' || s === 'not intrested' || s === 'not intrest') return 'Not Interested';
    if (s === 'invalid') return 'Invalid';
    if (s === 'busy' || s === 'buzy' || s === 'buzi') return 'Busy';
    if (s === 'hold') return 'Hold';
    if (s === 'processing') return 'Processing';

    // Spelling fixes & duplicates for Switch Off
    if (s === 'switch off' || s === 'switched off' || s === 'swiched off' || s === 'switchoff') return 'Switch Off';

    // Spelling fixes & duplicates for Speaking with Someone Else
    if (s === 'speaking with someone else' || s === 'speaking to someone else' || s === 'busy to speaking wth someone else' || s.includes('speaking with someone') || s.includes('speaking to someone')) {
        return 'Speaking with Someone Else';
    }

    // Spelling fixes & duplicates for Incoming Not Available
    if (s === 'incoming not available' || s === 'incoming call not available' || s === 'incoming call not available ' || s === 'no incoming' || s === 'incoming cl not available') {
        return 'Incoming Not Available';
    }

    // Spelling fixes & duplicates for Not Answering
    if (s === 'not answering' || s === 'not answered' || s === 'not answer') return 'Not Answering';

    // Spelling fixes & duplicates for Follow-up
    if (s === 'follow-up' || s === 'call follow-up' || s === 'followup' || s === 'call followup' || s === 'follow up') {
        return 'Follow-up';
    }

    // Out of Service
    if (s === 'out of service' || s === 'out of services' || s === 'outofservice') return 'Out of Service';

    // Wrong Number & spelling mistakes
    if (s === 'wrong number' || s.includes('wrong number') || s.includes('contact number is wrong') || s === 'wrong no' || s === 'wrng number') {
        return 'Wrong Number';
    }

    // Direct Visit & spelling mistakes (e.g. "Direct Vist", "filed visit", "field visit", "directvisit")
    if (s === 'direct visit' || s === 'direct vist' || s === 'directvisit' || s === 'field visit' || s === 'filed visit' || s.includes('direct visit') || s.includes('direct vist') || s.includes('field visit')) {
        return 'Direct Visit';
    }

    // Active, Expired, Upgraded, Withdrawn (normalize UPPERCASE to Title Case)
    if (s === 'active') return 'Active';
    if (s === 'expired') return 'Expired';
    if (s === 'upgraded') return 'Upgraded';
    if (s === 'withdrawn') return 'Withdrawn';

    // Closures
    if (s === 'temporarily closed' || s === 'temp closed') return 'Temporarily Closed';
    if (s === 'permanently closed' || s === 'perm closed') return 'Permanently Closed';

    // Quotation & Payments
    if (s === 'quotation' || s === 'quotation needed' || s === 'quotation done') return 'Quotation';
    if (s === 'paid') return 'Paid';
    if (s === 'due payment') return 'Due Payment';
    if (s === 'completed') return 'Completed';

    // Meetings
    if (s === 'meeting done') return 'Meeting Done';
    if (s === 'meeting attended') return 'Meeting Attended';
    if (s === 'meeting follow-up' || s === 'meeting followup' || s === 'meetingfollowup') return 'Meeting Follow-up';

    // Fallback: title case to ensure no duplicates in lower or upper char
    return toTitleCase(s);
};

const canonicalStatuses = [
    'Interested',
    'Not Interested',
    'Follow-up',
    'Not Answering',
    'Busy',
    'Hold',
    'Switch Off',
    'Speaking with Someone Else',
    'Incoming Not Available',
    'Wrong Number',
    'Direct Visit',
    'Converted',
    'Processing',
    'Out of Service',
    'Invalid'
];

const getCanonicalStatus = (status) => {
    return getCanonicalStatusCE(status);
};

const CONVERTED_STATUSES = ['converted', 'conversion', 'completed', 'paid', 'quotation', 'quotation done', 'quotation needed', 'due payment'];
const isConvertedStatus = (status) => {
    if (!status) return false;
    return CONVERTED_STATUSES.includes(status.trim().toLowerCase());
};

const NON_PENDING_STATUSES = [
    'not interested', 'invalid', 'rejected', 'canceled', 'removed',
    'converted', 'conversion', 'completed', 'paid', 'quotation', 'quotation done', 'quotation needed', 'due payment'
];
const isPendingStatus = (status) => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return !NON_PENDING_STATUSES.includes(s);
};

const hasValidPhone = (phone) => {
    if (!phone) return false;
    const str = String(phone).trim();
    if (!str) return false;
    const lower = str.toLowerCase().replace(/\s+/g, '');
    if (['n/a', 'na', 'null', 'none', '-', '--', 'nil', 'undefined', 'notavailable', 'notprovided'].includes(lower)) {
        return false;
    }
    return /\d/.test(str);
};

const getTodayDateStr = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getLocalDateStr = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            if (trimmed.length === 10 || trimmed.includes('T00:00:00')) {
                return trimmed.substring(0, 10);
            }
        }
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addDaysToDate = (dateStr, days) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getDaysDifference = (fromStr, toStr) => {
    if (!fromStr || !toStr) return 0;
    const fromTime = new Date(fromStr + 'T00:00:00').getTime();
    const toTime = new Date(toStr + 'T00:00:00').getTime();
    return Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24));
};

const isRecordInDateRange = (recordDateStr, customFrom, customTo, todayStr) => {
    if (!recordDateStr) return false;
    // Default view: if both From and To are empty, show today's records only
    if (!customFrom && !customTo) {
        return recordDateStr === todayStr;
    }
    // Manual date selection overrides default today's filtering (up to 1 month)
    if (customFrom && customTo) {
        return recordDateStr >= customFrom && recordDateStr <= customTo;
    }
    if (customFrom) {
        return recordDateStr >= customFrom;
    }
    if (customTo) {
        return recordDateStr <= customTo;
    }
    return true;
};

// In-memory module cache for instant perceived page loads
let leadsCache = {
    data: null,
    userId: null,
    role: null,
    timestamp: 0
};

const LeadList = ({ user, isMyCreated }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const currentUserId = user?.id || user?.UserID;
    const currentRole = user?.role || user?.Role;
    const hasValidCache = leadsCache.data &&
        leadsCache.userId === currentUserId &&
        leadsCache.role === currentRole;

    const [categoryFilter, setCategoryFilter] = useState(() => {
        const initial = location.state?.categoryFilter || 'all';
        if (initial === 'new' || initial === 'followup') return 'all';
        return initial;
    });
    const [leads, setLeads] = useState(() => (hasValidCache ? leadsCache.data : []));
    const [loading, setLoading] = useState(!hasValidCache);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [viewFilter, setViewFilter] = useState('All');
    const [fromDate, setFromDate] = useState(location.state?.fromDate || '');
    const [toDate, setToDate] = useState(location.state?.toDate || '');
    const [singleDate, setSingleDate] = useState('');

    const isFE = user?.role === 'Field Executive' || user?.Role === 'Field Executive';
    const isCE = user?.role === 'Call Executive' || user?.Role === 'Call Executive';
    const isTL = user?.role === 'Team Lead' || user?.Role === 'Team Lead';
    const isAdmin = user?.role === 'Admin' || user?.Role === 'Admin';

    const handleFromDateChange = (val) => {
        setFromDate(val);
        if (val && toDate && val > toDate) {
            setToDate(val);
        }
    };

    const handleToDateChange = (val) => {
        if (val && fromDate && val < fromDate) {
            return;
        }
        setToDate(val);
    };
    const [statusFilter, setStatusFilter] = useState('All');
    const [importing, setImporting] = useState(false);
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [selectMode, setSelectMode] = useState(false);
    const [deletingSelected, setDeletingSelected] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('excel');
    const [exportScope, setExportScope] = useState('filtered');
    const [exporting, setExporting] = useState(false);

    // Custom Record Range Selection state
    const [rangeInput, setRangeInput] = useState('');
    const [rangeError, setRangeError] = useState('');
    const [rangeFeedback, setRangeFeedback] = useState('');
    const [activeRange, setActiveRange] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Drag to scroll refs
    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const feCallStatuses = useMemo(() => [
        'Follow-up', 'Call Follow-up', 'Busy', 'Not Answered', 'Not Answering', 'Invalid',
        'Speaking to Someone Else', 'Speaking with Someone Else', 'Out of Service',
        'Incoming Call Not Available', 'Incoming Not Available', 'Switch Off', 'Hold', 'Processing'
    ], []);

    const baseLeads = useMemo(() => {
        const currentUserIdStr = String(currentUserId || '');
        if (isMyCreated) {
            return leads.filter(l => String(l.CreatedBy) === currentUserIdStr);
        }
        if (isFE) {
            return leads.filter(l => String(l.CreatedBy) !== currentUserIdStr && !feCallStatuses.includes(l.Status));
        }
        return leads;
    }, [leads, isMyCreated, isFE, currentUserId, feCallStatuses]);

    const fetchLeads = useCallback(async (forceSpinner = false) => {
        if (forceSpinner || leads.length === 0) {
            setLoading(true);
        }
        setError('');
        try {
            const token = localStorage.getItem('crm_token');
            if (!token) {
                const curRole = localStorage.getItem('selected_role');
                navigate(curRole ? '/login' : '/', { replace: true });
                return;
            }
            const res = await fetch(`${API_URL}/api/leads`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('crm_token');
                localStorage.removeItem('crm_user');
                const curRole = localStorage.getItem('selected_role');
                navigate(curRole ? '/login' : '/', { replace: true });
                return;
            }
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Failed to fetch leads: ${res.status} ${text}`);
            }
            const data = await res.json();
            leadsCache = {
                data,
                userId: currentUserId,
                role: currentRole,
                timestamp: Date.now()
            };
            setLeads(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, currentRole, isMyCreated, leads.length, navigate]);

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Please select a valid CSV file (ending in .csv).');
            e.target.value = '';
            return;
        }

        const confirm = window.confirmDialog
            ? await window.confirmDialog(`Are you sure you want to import leads from "${file.name}"?`, 'Import', 'Cancel')
            : window.confirm(`Are you sure you want to import leads from "${file.name}"?`);

        if (!confirm) {
            e.target.value = '';
            return;
        }

        setImporting(true);

        try {
            // Read CSV file locally to bypass content:// URI fetch issues on Capacitor/Android and file path issues in Electron
            const csvText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (err) => reject(err);
                reader.readAsText(file);
            });

            const res = await fetch(`${API_URL}/api/leads/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({ csvText, filename: file.name })
            });

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                throw new Error(`Server returned an invalid response (not JSON). Response snippet: "${text.substring(0, 100)}"`);
            }

            if (!res.ok) throw new Error(data.message || 'Import failed');

            alert(data.message);
            leadsCache.data = null;
            fetchLeads(true);
        } catch (err) {
            alert(err.message);
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const toggleSelectLead = (leadId) => {
        if (isCE && activeRange) {
            const leadIndex = filtered.findIndex(l => l.LeadID === leadId);
            if (leadIndex !== -1) {
                const recordNum = leadIndex + 1;
                if (recordNum < activeRange.start || recordNum > activeRange.end) {
                    return; // Strictly restrict selection to specified range only
                }
            }
        }
        setSelectedLeads(prev =>
            prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
        );
    };

    const toggleSelectAll = () => {
        if (isCE && activeRange) {
            const inRangeLeads = filtered.slice(activeRange.start - 1, activeRange.end);
            const inRangeIds = inRangeLeads.map(l => l.LeadID);
            const allInRangeSelected = inRangeIds.every(id => selectedLeads.includes(id));
            if (allInRangeSelected) {
                setSelectedLeads(prev => prev.filter(id => !inRangeIds.includes(id)));
            } else {
                const newSelected = new Set(selectedLeads);
                inRangeIds.forEach(id => newSelected.add(id));
                setSelectedLeads(Array.from(newSelected));
            }
            return;
        }
        if (selectedLeads.length === filtered.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(filtered.map(l => l.LeadID));
        }
    };

    const handleExport = async () => {
        let recordsToExport = [];
        if (exportScope === 'selected' && selectedLeads.length > 0) {
            recordsToExport = baseLeads.filter(l => selectedLeads.includes(l.LeadID));
        } else if (exportScope === 'filtered') {
            recordsToExport = filtered;
        } else {
            recordsToExport = baseLeads;
        }

        if (!recordsToExport || recordsToExport.length === 0) {
            return alert('No records available to export.');
        }

        setExporting(true);
        try {
            const pad = (n) => String(n).padStart(2, '0');
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

            const filePrefix = isMyCreated 
                ? 'My_Created_Leads' 
                : (isFE ? 'Assigned_Meetings_Leads' : 'Leads');
            const reportTitle = isMyCreated 
                ? 'My Created Leads Report' 
                : (isFE ? 'Assigned Meetings Leads Report' : 'Lead Database Report');

            if (exportFormat === 'excel') {
                const exportData = recordsToExport.map((lead, idx) => ({
                    "S.No": idx + 1,
                    "Lead ID": lead.LeadID,
                    "Lead Name": lead.FullName || '',
                    "Primary Phone": lead.Phone || '',
                    "Alternate Phone": lead.AlternatePhone || '',
                    "Email": lead.Email || '',
                    "Company Type": lead.CompanyName || lead.CompanyType || '',
                    "Specific Company Name": lead.SpecificCompanyName || '',
                    "Status": (isCE ? getCanonicalStatusCE(lead.Status) : getCanonicalStatus(lead.Status)) || lead.Status || '',
                    "Service Interested": lead.ServiceInterested || '',
                    "Follow-up Date": lead.FollowupDate ? new Date(lead.FollowupDate).toLocaleDateString('en-GB') : '',
                    "Follow-up Time": formatCleanTime(lead.FollowupTime) || '',
                    "Meeting Date": lead.MeetingDate ? new Date(lead.MeetingDate).toLocaleDateString('en-GB') : '',
                    "Meeting Time": formatCleanTime(lead.MeetingTime) || '',
                    "Address": lead.Address || '',
                    "Call Note": lead.CallNote || '',
                    "Created Date": lead.CreatedAt ? new Date(lead.CreatedAt).toLocaleDateString('en-GB') : '',
                    "Updated Date": lead.UpdatedAt ? new Date(lead.UpdatedAt).toLocaleDateString('en-GB') : ''
                }));

                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const colWidths = Object.keys(exportData[0] || {}).map(key => ({
                    wch: Math.max(key.length, ...exportData.map(row => String(row[key] || '').length).slice(0, 50)) + 3
                }));
                worksheet['!cols'] = colWidths;

                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, isMyCreated ? 'My Created Leads' : 'Leads');

                const filename = `${filePrefix}_Export_${exportScope}_${dateStr}.xlsx`;
                XLSX.writeFile(workbook, filename);
                setShowExportModal(false);
            } else {
                // PDF Export
                const doc = new jsPDF('l', 'mm', 'a4');

                // Header Title
                doc.setFontSize(18);
                doc.setTextColor(30, 41, 59);
                doc.text(reportTitle, 14, 18);

                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text(`Generated on: ${dateStr} ${timeStr} | Scope: ${exportScope.toUpperCase()} | Total: ${recordsToExport.length} records`, 14, 25);

                const tableColumns = [
                    "S.No",
                    "Lead Name",
                    "Primary Phone",
                    "Alt Phone",
                    "Company Type",
                    "Specific Company",
                    "Status",
                    "Service Interested",
                    "Follow-up / Meeting Date"
                ];

                const tableRows = recordsToExport.map((lead, idx) => [
                    idx + 1,
                    lead.FullName || '-',
                    lead.Phone || '-',
                    lead.AlternatePhone || '-',
                    lead.CompanyName || lead.CompanyType || '-',
                    lead.SpecificCompanyName || '-',
                    (isCE ? getCanonicalStatusCE(lead.Status) : getCanonicalStatus(lead.Status)) || lead.Status || '-',
                    lead.ServiceInterested || '-',
                    lead.MeetingDate 
                        ? new Date(lead.MeetingDate).toLocaleDateString('en-GB') 
                        : (lead.FollowupDate ? new Date(lead.FollowupDate).toLocaleDateString('en-GB') : '-')
                ]);

                autoTable(doc, {
                    head: [tableColumns],
                    body: tableRows,
                    startY: 30,
                    theme: 'grid',
                    headStyles: { fillColor: [99, 102, 241], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    margin: { top: 30, left: 10, right: 10 }
                });

                const filename = `${filePrefix}_Export_${exportScope}_${dateStr}.pdf`;
                await savePDF(doc, filename);
                setShowExportModal(false);
            }
        } catch (err) {
            console.error('Export error:', err);
            alert(`Export failed: ${err.message}`);
        } finally {
            setExporting(false);
        }
    };

    const handleSelectRange = () => {
        setRangeError('');
        if (!rangeInput || !rangeInput.trim()) {
            const msg = 'Please enter a record range (e.g., 1-30, 50-100, 500-1000).';
            setRangeError(msg);
            alert(msg);
            return;
        }

        const trimmed = rangeInput.trim();

        // Reject attempts to input multiple or additional ranges (e.g. "1-6, 7-10")
        if (trimmed.includes(',') || trimmed.includes(';') || (trimmed.match(/[-–—]/g) && trimmed.match(/[-–—]/g).length > 1)) {
            const msg = 'Please specify a single range only (e.g., 1-6). Multiple ranges cannot be selected.';
            setRangeError(msg);
            alert(msg);
            return;
        }

        // Match formats: 1-30, 1–30, 1—30, 1 to 30, with optional spaces
        const match = trimmed.match(/^(\d+)\s*(?:[-–—]|to)\s*(\d+)$/i);
        if (!match) {
            const msg = 'Invalid format. Please enter a valid range (e.g., 1-30, 50-100, or 500-1000).';
            setRangeError(msg);
            alert(msg);
            return;
        }

        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);

        if (filtered.length === 0) {
            const msg = 'No records available to select in the current view.';
            setRangeError(msg);
            alert(msg);
            return;
        }

        if (start < 1) {
            const msg = 'Start record must be 1 or greater.';
            setRangeError(msg);
            alert(msg);
            return;
        }

        if (end < start) {
            const msg = `End value (${end}) cannot be smaller than start value (${start}).`;
            setRangeError(msg);
            alert(msg);
            return;
        }

        if (start > filtered.length) {
            const msg = `Start value (${start}) exceeds available records (${filtered.length}).`;
            setRangeError(msg);
            alert(msg);
            return;
        }

        if (end > filtered.length) {
            const msg = `End value (${end}) exceeds available records (${filtered.length}).`;
            setRangeError(msg);
            alert(msg);
            return;
        }

        // 1-based indexing mapped to 0-based slice
        const rangeRecords = filtered.slice(start - 1, end);
        const rangeIds = rangeRecords.map(l => l.LeadID);

        setSelectedLeads(rangeIds);
        if (isCE) {
            setActiveRange({ start, end });
        }
        setSelectMode(true);
        setRangeFeedback(`Range: ${start}–${end}`);

        // Automatically navigate to the page where the range starts
        if (pageSize !== 'all') {
            const size = Number(pageSize);
            const targetPage = Math.ceil(start / size);
            setCurrentPage(targetPage);
        }
    };

    const handleClearSelection = () => {
        setSelectedLeads([]);
        setActiveRange(null);
        setRangeFeedback('');
        setRangeInput('');
        setRangeError('');
    };

    const handleToggleSelectMode = () => {
        if (selectMode) {
            setSelectMode(false);
            handleClearSelection();
        } else {
            setSelectMode(true);
        }
    };

    const handleDeleteSelected = async () => {
        setShowDeleteModal(false);
        setDeletingSelected(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/bulk-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({ leadIds: selectedLeads })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Delete failed');
            alert(data.message);
            setSelectedLeads([]);
            setActiveRange(null);
            setRangeFeedback('');
            setRangeInput('');
            setRangeError('');
            setSelectMode(false);
            leadsCache.data = null;
            fetchLeads(true);
        } catch (err) {
            alert(err.message);
        } finally {
            setDeletingSelected(false);
        }
    };

    useEffect(() => { 
        fetchLeads(); 
        const handleLeadUpdate = () => {
            leadsCache.data = null;
            fetchLeads(true);
        };
        window.addEventListener('lead_updated', handleLeadUpdate);
        return () => window.removeEventListener('lead_updated', handleLeadUpdate);
    }, [fetchLeads]);

    useEffect(() => {
        if (location.state?.categoryFilter) {
            const cat = location.state.categoryFilter;
            setCategoryFilter((cat === 'new' || cat === 'followup') ? 'all' : cat);
        }
        if (location.state?.fromDate !== undefined) {
            setFromDate(location.state.fromDate);
        }
        if (location.state?.toDate !== undefined) {
            setToDate(location.state.toDate);
        }
    }, [location.state?.categoryFilter, location.state?.fromDate, location.state?.toDate]);

    useEffect(() => {
        if ((isTL || isFE || isAdmin) && statusFilter === 'N/A Leads') {
            setStatusFilter('All');
        }
    }, [isTL, isFE, isAdmin, statusFilter]);

    useEffect(() => {
        if (isAdmin && categoryFilter !== 'all') {
            setCategoryFilter('all');
        }
    }, [isAdmin, categoryFilter]);

    useEffect(() => {
        setCurrentPage(1);
        if (isCE && activeRange) {
            handleClearSelection();
        }
    }, [search, statusFilter, fromDate, toDate, singleDate, roleFilter, viewFilter, categoryFilter]);

    const checkDateInRange = useCallback((dateStr, start, end) => {
        if (!dateStr) return false;
        const leadDateObj = new Date(dateStr);
        const offset = leadDateObj.getTimezoneOffset();
        const localDateObj = new Date(leadDateObj.getTime() - (offset * 60 * 1000));
        const localDateStr = localDateObj.toISOString().split('T')[0];
        if (start && end) return localDateStr >= start && localDateStr <= end;
        if (start) return localDateStr >= start;
        if (end) return localDateStr <= end;
        return true;
    }, []);

    const { conversionsCount, pendingCount, allLeadsCount } = useMemo(() => {
        let conv = 0;
        let pend = 0;
        let total = 0;
        const targetList = isMyCreated ? baseLeads : leads;
        for (let i = 0; i < targetList.length; i++) {
            const l = targetList[i];
            const s = l.Status;

            let inDate = true;
            let inDateConv = true;

            if (isTL && singleDate) {
                const leadDateObj = l.CreatedAt ? new Date(l.CreatedAt) : null;
                if (!leadDateObj) {
                    inDate = false;
                    inDateConv = false;
                } else {
                    const offset = leadDateObj.getTimezoneOffset();
                    const localDateObj = new Date(leadDateObj.getTime() - (offset * 60 * 1000));
                    const localDateStr = localDateObj.toISOString().split('T')[0];
                    inDate = (localDateStr === singleDate);
                    inDateConv = inDate;
                }
            } else if (isTL && (fromDate || toDate)) {
                inDate = checkDateInRange(l.CreatedAt, fromDate, toDate);
                inDateConv = inDate || checkDateInRange(l.UpdatedAt, fromDate, toDate);
            }

            if (inDate) {
                total++;
                if (isPendingStatus(s)) pend++;
            }
            if (isConvertedStatus(s) && inDateConv) {
                conv++;
            }
        }
        return { conversionsCount: conv, pendingCount: pend, allLeadsCount: total };
    }, [leads, baseLeads, isMyCreated, isTL, singleDate, fromDate, toDate, checkDateInRange]);

    const filtered = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        const hasSearch = searchLower.length > 0;
        const hasStatus = statusFilter !== 'All';
        const statusLower = statusFilter.trim().toLowerCase();
        const isNAFilter = statusFilter === 'N/A Leads';
        const isInterestedFilter = statusLower === 'interested';
        const currentUserIdStr = String(currentUserId || '');

        return leads.filter(l => {
            if (!hasStatus) {
                if (categoryFilter === 'conversions' && !isConvertedStatus(l.Status)) return false;
                if (categoryFilter === 'pending' && !isPendingStatus(l.Status)) return false;
            }

            if (hasSearch) {
                const matchesSearch = (l.FullName && l.FullName.toLowerCase().includes(searchLower)) ||
                    (l.Phone && String(l.Phone).toLowerCase().includes(searchLower)) ||
                    (l.CompanyName && l.CompanyName.toLowerCase().includes(searchLower)) ||
                    (l.ServiceInterested && l.ServiceInterested.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }

            if (roleFilter !== 'All' && l.CreatorRole !== roleFilter) return false;

            if (viewFilter === 'Attained Meeting') {
                if (!(l.Status === 'Meeting Attended' || l.Status === 'Quotation' || l.MeetingFollowupDate)) return false;
            } else if (viewFilter === 'Created Leads') {
                if (l.CreatorRole !== 'Team Lead') return false;
            } else if (viewFilter === "Executive's Leads") {
                if (!(l.CreatorRole === 'Call Executive' || l.CreatorRole === 'Field Executive')) return false;
            }

            // Field Executives: Only show meeting-related leads in this view, unless viewing their created leads
            if (!isMyCreated && isFE) {
                if (String(l.CreatedBy) === currentUserIdStr) return false;
                if (feCallStatuses.includes(l.Status)) return false;
            }

            if (isMyCreated && String(l.CreatedBy) !== currentUserIdStr) return false;

            if (isTL) {
                if (singleDate) {
                    if (!l.CreatedAt) return false;
                    const leadDateObj = new Date(l.CreatedAt);
                    const offset = leadDateObj.getTimezoneOffset();
                    const localDateObj = new Date(leadDateObj.getTime() - (offset * 60 * 1000));
                    const localDateStr = localDateObj.toISOString().split('T')[0];
                    if (localDateStr !== singleDate) return false;
                } else if (fromDate || toDate) {
                    if (categoryFilter === 'conversions') {
                        const inCreated = checkDateInRange(l.CreatedAt, fromDate, toDate);
                        const inUpdated = checkDateInRange(l.UpdatedAt, fromDate, toDate);
                        if (!inCreated && !inUpdated) return false;
                    } else {
                        if (!checkDateInRange(l.CreatedAt, fromDate, toDate)) return false;
                    }
                }
            } else if (isFE || isAdmin) {
                if (singleDate) {
                    if (!l.CreatedAt) return false;
                    const leadDateObj = new Date(l.CreatedAt);
                    const offset = leadDateObj.getTimezoneOffset();
                    const localDateObj = new Date(leadDateObj.getTime() - (offset * 60 * 1000));
                    const localDateStr = localDateObj.toISOString().split('T')[0];
                    if (localDateStr !== singleDate) return false;
                }
            } else {
                if (fromDate || toDate) {
                    if (!checkDateInRange(l.CreatedAt, fromDate, toDate)) return false;
                }
            }

            if (isNAFilter) {
                if (hasValidPhone(l.Phone)) return false;
            } else if (hasStatus) {
                const matchesStatus = isCE
                    ? (getCanonicalStatusCE(l.Status).toLowerCase() === statusLower || (l.Status && l.Status.trim().toLowerCase() === statusLower))
                    : (getCanonicalStatus(l.Status).toLowerCase() === statusLower || (l.Status && l.Status.trim().toLowerCase() === statusLower));
                if (!matchesStatus) return false;

                if (isInterestedFilter && !hasValidPhone(l.Phone)) return false;
            }

            return true;
        });
    }, [leads, statusFilter, categoryFilter, search, roleFilter, viewFilter, isMyCreated, isFE, isCE, currentUserId, singleDate, fromDate, toDate, isTL, isAdmin, feCallStatuses, checkDateInRange]);

    const effectivePageSize = pageSize === 'all' ? (filtered.length || 1) : Number(pageSize);
    const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * effectivePageSize;
    const endIndex = Math.min(startIndex + effectivePageSize, filtered.length);
    const paginatedLeads = useMemo(() => {
        return pageSize === 'all' ? filtered : filtered.slice(startIndex, endIndex);
    }, [filtered, pageSize, startIndex, endIndex]);

    const selectedLeadsSet = useMemo(() => new Set(selectedLeads), [selectedLeads]);

    const selectablePageLeads = useMemo(() => {
        if (isCE && activeRange) {
            return paginatedLeads.filter((_, idx) => {
                const num = startIndex + idx + 1;
                return num >= activeRange.start && num <= activeRange.end;
            });
        }
        return paginatedLeads;
    }, [paginatedLeads, isCE, activeRange, startIndex]);

    const isAllCurrentPageSelected = selectablePageLeads.length > 0 && selectablePageLeads.every(l => selectedLeadsSet.has(l.LeadID));
    const isSomeCurrentPageSelected = selectablePageLeads.some(l => selectedLeadsSet.has(l.LeadID));

    const toggleSelectAllCurrentPage = () => {
        if (selectablePageLeads.length === 0) return;
        if (isAllCurrentPageSelected) {
            const pageIds = new Set(selectablePageLeads.map(l => l.LeadID));
            setSelectedLeads(prev => prev.filter(id => !pageIds.has(id)));
        } else {
            const newSelected = new Set(selectedLeads);
            selectablePageLeads.forEach(l => newSelected.add(l.LeadID));
            setSelectedLeads(Array.from(newSelected));
        }
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title={isMyCreated ? 'My Created Leads' : 'Lead Management'} />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </button>
                <header className="responsive-header">
                    <h1>{user?.role === 'Field Executive' && !isMyCreated ? 'Assigned Meetings Leads' : (isMyCreated ? 'My Created Leads' : 'Lead Database')}
                        <span style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '12px', fontWeight: '500' }}>{filtered.length} total</span>
                    </h1>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button onClick={fetchLeads} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                            <RefreshCw size={16} />
                        </button>
                        <button className="btn-primary" onClick={() => navigate('/leads/new?from=leads', { state: { from: '/leads' } })}>+ New Lead</button>
                        {(isCE || (isFE && isMyCreated)) && (
                            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                                <input
                                    type="file"
                                    id="csvImport"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: importing ? 'not-allowed' : 'pointer',
                                        zIndex: 10,
                                        pointerEvents: importing ? 'none' : 'auto'
                                    }}
                                    onChange={handleImport}
                                />
                                <button
                                    disabled={importing}
                                    style={{
                                        background: 'rgba(16,185,129,0.1)',
                                        color: '#10b981',
                                        border: '1px solid rgba(16,185,129,0.3)',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontWeight: '600'
                                    }}
                                >
                                    {importing ? <Loader size={16} className="spin" /> : <Upload size={16} />}
                                    {importing ? 'Importing...' : 'Import CSV'}
                                </button>
                            </div>
                        )}
                        {(isCE || isFE) && (
                            <button
                                onClick={() => {
                                    setExportScope((search || statusFilter !== 'All' || fromDate || toDate || singleDate) ? 'filtered' : 'all');
                                    setShowExportModal(true);
                                }}
                                style={{
                                    background: 'rgba(99,102,241,0.1)',
                                    color: '#6366f1',
                                    border: '1px solid rgba(99,102,241,0.3)',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: '600'
                                }}
                                title={isMyCreated ? 'Export My Created Leads' : 'Export Leads'}
                            >
                                <Download size={16} /> Export
                            </button>
                        )}

                    </div>
                </header>

                {/* Role Filter Tabs - Only visible to Admin */}
                {user?.role === 'Admin' && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }} className="fade-in">
                        {['All', 'Call Executive', 'Field Executive', 'Team Lead'].map(role => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid',
                                    borderColor: roleFilter === role ? '#6366f1' : 'rgba(148, 163, 184, 0.2)',
                                    background: roleFilter === role ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                    color: roleFilter === role ? '#6366f1' : '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                {role === 'All' ? 'All Leads' : role}
                            </button>
                        ))}
                    </div>
                )}

                {/* Quick Category Filter Tabs (All / Conversions / Pending) - Hidden for Admin and FE Assigned Meetings */}
                {!isAdmin && !(isFE && !isMyCreated) && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => { setCategoryFilter('all'); setStatusFilter('All'); }}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '20px',
                                border: `1.5px solid ${categoryFilter === 'all' ? '#6366f1' : '#e2e8f0'}`,
                                background: categoryFilter === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'white',
                                color: categoryFilter === 'all' ? '#6366f1' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            All Leads ({isMyCreated ? baseLeads.length : (isTL ? allLeadsCount : leads.length)})
                        </button>
                        <button
                            type="button"
                            onClick={() => { setCategoryFilter('conversions'); setStatusFilter('All'); }}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '20px',
                                border: `1.5px solid ${categoryFilter === 'conversions' ? '#10b981' : '#e2e8f0'}`,
                                background: categoryFilter === 'conversions' ? 'rgba(16, 185, 129, 0.1)' : 'white',
                                color: categoryFilter === 'conversions' ? '#059669' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Conversions ({conversionsCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => { setCategoryFilter('pending'); setStatusFilter('All'); }}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '20px',
                                border: `1.5px solid ${categoryFilter === 'pending' ? '#f59e0b' : '#e2e8f0'}`,
                                background: categoryFilter === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'white',
                                color: categoryFilter === 'pending' ? '#d97706' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Pending ({pendingCount})
                        </button>
                    </div>
                )}

                {/* Search Bar, Date Filter, Status Filter, and Custom Record Range Selection */}
                <div className="responsive-filter-bar" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            className="search-input"
                            placeholder="Search leads by name, phone, company, or service..."
                            value={search}
                            onChange={e => setSearch(stripEmojis(e.target.value))}
                            autoComplete="off"
                        />
                    </div>
                    <div style={{ minWidth: '150px', flex: '0 1 auto' }}>
                        <select
                            className="input-field"
                            style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                            value={statusFilter}
                            onChange={e => {
                                setStatusFilter(e.target.value);
                                if (e.target.value !== 'All') {
                                    setCategoryFilter('all');
                                }
                            }}
                        >
                            {(() => {
                                const rawStatuses = leads.map(l => l.Status).filter(Boolean);
                                // Case-insensitive deduplication: ensures only one entry per status regardless of lower or upper char
                                const statusMap = new Map();
                                statusMap.set('hold', 'Hold');

                                rawStatuses.forEach(raw => {
                                    const canonical = getCanonicalStatus(raw);
                                    if (!canonical) return;
                                    const key = canonical.toLowerCase();
                                    if (!statusMap.has(key)) {
                                        statusMap.set(key, canonical);
                                    }
                                });

                                statusMap.delete('all');
                                statusMap.delete('n/a leads');

                                const currentCanonicalList = isCE ? canonicalStatusesCE : canonicalStatuses;
                                const sorted = Array.from(statusMap.values()).sort((a, b) => {
                                    const idxA = currentCanonicalList.indexOf(a);
                                    const idxB = currentCanonicalList.indexOf(b);
                                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                    if (idxA !== -1) return -1;
                                    if (idxB !== -1) return 1;
                                    return a.localeCompare(b);
                                });

                                const statusOptions = (isTL || isFE || isAdmin) ? ['All', ...sorted] : ['All', 'N/A Leads', ...sorted];
                                return statusOptions.map(s => (
                                    <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
                                ));
                            })()}
                        </select>
                    </div>
                    {/* Team Lead, Field Executive & Admin Single Date Picker */}
                    {(isTL || isFE || isAdmin) && (
                        <div style={{ position: 'relative', minWidth: '160px', flex: '0 1 auto', display: 'flex', alignItems: 'center' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input
                                    type="date"
                                    className="input-field"
                                    title="Filter by Date"
                                    placeholder="Filter by Date"
                                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '40px', paddingRight: singleDate ? '34px' : '14px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', fontSize: '0.85rem' }}
                                    value={singleDate}
                                    onChange={e => {
                                        setSingleDate(e.target.value);
                                        if (e.target.value) {
                                            setFromDate('');
                                            setToDate('');
                                        }
                                    }}
                                />
                                {singleDate && (
                                    <button
                                        type="button"
                                        onClick={() => setSingleDate('')}
                                        title="Clear date filter"
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#64748b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: 0
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {isTL && !singleDate && (fromDate || toDate) && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            borderRadius: '20px',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            border: '1px solid #c7d2fe'
                        }}>
                            <span>Period: {fromDate ? fromDate.split('-').reverse().join('-') : 'Start'} to {toDate ? toDate.split('-').reverse().join('-') : 'End'}</span>
                            <button
                                type="button"
                                onClick={() => { setFromDate(''); setToDate(''); }}
                                title="Clear date range"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#4338ca',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#4338ca'; }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Team Lead, Field Executive & Admin Standalone Select Button */}
                    {(isTL || isFE || isAdmin) && (
                        <button
                            type="button"
                            onClick={handleToggleSelectMode}
                            style={{
                                background: selectMode ? '#4338ca' : '#6366f1',
                                color: 'white',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap',
                                boxShadow: selectMode ? '0 2px 8px rgba(67, 56, 202, 0.4)' : '0 2px 6px rgba(99,102,241,0.25)',
                                transition: 'all 0.15s ease'
                            }}
                            title={selectMode ? 'Exit Selection Mode' : 'Enable Selection Mode'}
                        >
                            <CheckSquare size={16} /> {selectMode ? 'Deselect' : 'Select'}
                        </button>
                    )}

                    {/* From Date – To Date Range Filter */}
                    {!isTL && !isFE && !isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '0 1 auto' }}>
                            <div style={{ position: 'relative', minWidth: '150px', flex: '1 1 auto' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input
                                    type="date"
                                    className="input-field"
                                    title="From Date"
                                    placeholder="From Date"
                                    max={toDate || undefined}
                                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '40px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', fontSize: '0.85rem' }}
                                    value={fromDate}
                                    onChange={e => handleFromDateChange(e.target.value)}
                                />
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '700' }}>–</span>
                            <div style={{ position: 'relative', minWidth: '150px', flex: '1 1 auto' }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                <input
                                    type="date"
                                    className="input-field"
                                    title="To Date"
                                    placeholder="To Date"
                                    min={fromDate || undefined}
                                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '40px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', fontSize: '0.85rem' }}
                                    value={toDate}
                                    onChange={e => handleToDateChange(e.target.value)}
                                />
                            </div>
                            {(fromDate || toDate) && (
                                <button
                                    type="button"
                                    onClick={() => { setFromDate(''); setToDate(''); }}
                                    title="Clear date filter"
                                    style={{
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        padding: '8px 10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        color: '#64748b',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#ef4444'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                                >
                                    <X size={14} /> Clear
                                </button>
                            )}
                        </div>
                    )}

                    {/* Custom Record Range Selection (Call Executive, etc.) */}
                    {!isTL && !isFE && !isAdmin && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px', flex: '0 1 auto' }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Range (e.g. 1-30, 50-100)"
                                value={rangeInput}
                                onChange={e => {
                                    setRangeInput(e.target.value);
                                    if (rangeError) setRangeError('');
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSelectRange();
                                }}
                                style={{
                                    width: '100%',
                                    minWidth: '150px',
                                    boxSizing: 'border-box',
                                    background: 'white',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                    borderColor: rangeError ? '#ef4444' : undefined,
                                    fontSize: '0.85rem'
                                }}
                                title="Enter record range (e.g. 1-30, 50-100, 500-1000 or 2000-3000)"
                            />
                            <button
                                type="button"
                                onClick={handleSelectRange}
                                style={{
                                    background: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <CheckSquare size={16} /> Select
                            </button>
                            {isCE && activeRange && (
                                <button
                                    type="button"
                                    onClick={handleClearSelection}
                                    style={{
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        border: '1px solid #fecaca',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '0.85rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                    }}
                                    title="Clear range selection"
                                >
                                    <X size={14} /> Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Selected Records Status Banner */}
                {selectedLeads.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        padding: '12px 18px',
                        marginBottom: '20px',
                        borderRadius: '12px',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.06)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3730a3', fontSize: '0.9rem' }}>
                            <div style={{ background: '#6366f1', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Check size={14} />
                            </div>
                            <span>
                                <strong>{selectedLeads.length}</strong> record{selectedLeads.length > 1 ? 's' : ''} currently selected
                                {rangeFeedback ? <span style={{ marginLeft: '6px', color: '#6366f1', fontWeight: '600' }}>({rangeFeedback})</span> : null}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {selectedLeads.length < filtered.length && !(isCE && activeRange) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedLeads(filtered.map(l => l.LeadID));
                                        setRangeFeedback(`All ${filtered.length} records`);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6366f1',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Select all {filtered.length} leads
                                </button>
                            )}
                            {isCE && activeRange && selectedLeads.length < (activeRange.end - activeRange.start + 1) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const inRangeLeads = filtered.slice(activeRange.start - 1, activeRange.end);
                                        setSelectedLeads(inRangeLeads.map(l => l.LeadID));
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6366f1',
                                        fontSize: '0.85rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Select all in Range {activeRange.start}–{activeRange.end}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                style={{
                                    background: 'white',
                                    border: '1px solid #cbd5e1',
                                    color: '#64748b',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <X size={14} /> Clear Selection
                            </button>
                        </div>
                    </div>
                )}

                {/* Sub-Filters below search bar - Only visible for Team Lead */}
                {user?.role === 'Team Lead' && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }} className="fade-in">
                        {['All', 'Attained Meeting', 'Created Leads', "Executive's Leads"].map(filter => (
                            <button
                                key={filter}
                                onClick={() => setViewFilter(filter)}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: viewFilter === filter ? '#6366f1' : 'rgba(226, 232, 240, 0.8)',
                                    background: viewFilter === filter ? 'rgba(99, 102, 241, 0.08)' : 'white',
                                    color: viewFilter === filter ? '#6366f1' : '#64748b',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    boxShadow: viewFilter === filter ? '0 2px 8px rgba(99, 102, 241, 0.1)' : 'none'
                                }}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                )}

                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '14px 18px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span>⚠️ {error.toLowerCase().includes('token') || error.includes('401') ? 'Your session has expired. Please log in again.' : error}</span>
                        {error.toLowerCase().includes('token') || error.includes('401') ? (
                            <button 
                                onClick={() => {
                                    localStorage.removeItem('crm_token');
                                    localStorage.removeItem('crm_user');
                                    const currentRole = localStorage.getItem('selected_role');
                                    navigate(currentRole ? '/login' : '/', { replace: true });
                                }} 
                                style={{ color: '#fff', background: '#ef4444', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                            >
                                Log In Again
                            </button>
                        ) : (
                            <button onClick={fetchLeads} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
                        )}
                    </div>
                )}

                <div 
                    ref={tableContainerRef}
                    className="glass-card responsive-table-container hide-scrollbar" 
                    style={{ 
                        padding: '0', 
                        overflowX: 'auto', 
                        width: '100%', 
                        maxWidth: '100%', 
                        cursor: isDragging ? 'grabbing' : 'grab' 
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading leads...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                            {search ? `No leads matching "${search}"` : (
                                isFE && !isMyCreated 
                                    ? 'No assigned meeting leads yet.' 
                                    : (categoryFilter === 'conversions'
                                        ? 'No converted leads yet.'
                                        : (categoryFilter === 'pending'
                                            ? 'No pending leads yet.'
                                            : 'No leads yet. Create your first lead!'))
                            )}
                        </div>
                    ) : (
                        <table style={{ width: '100%', minWidth: user?.role === 'Admin' ? '1600px' : '1250px', borderCollapse: 'collapse', textAlign: 'left', userSelect: isDragging ? 'none' : 'auto' }}>
                            <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <tr style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                    {selectMode && (
                                        <th style={{ padding: '16px 12px', width: '40px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={isAllCurrentPageSelected}
                                                ref={el => {
                                                    if (el) {
                                                        el.indeterminate = !isAllCurrentPageSelected && isSomeCurrentPageSelected;
                                                    }
                                                }}
                                                onChange={toggleSelectAllCurrentPage}
                                                disabled={selectablePageLeads.length === 0}
                                                style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    cursor: selectablePageLeads.length === 0 ? 'not-allowed' : 'pointer',
                                                    accentColor: '#6366f1',
                                                    opacity: selectablePageLeads.length === 0 ? 0.35 : 1
                                                }}
                                                title={
                                                    selectablePageLeads.length === 0
                                                        ? (isCE && activeRange ? `No records on this page within specified range (${activeRange.start}–${activeRange.end})` : "No selectable records")
                                                        : (isAllCurrentPageSelected ? "Deselect current page" : "Select all on current page")
                                                }
                                            />
                                        </th>
                                    )}
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>S.No</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Name</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Phone</th>
                                    <th style={{ padding: '16px 14px', whiteSpace: 'nowrap', width: '160px', minWidth: '140px', maxWidth: '180px' }}>Location</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Email</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Company</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Service</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Created By</th>
                                    {user?.role === 'Admin' && (
                                        <>
                                            <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Assigned By (TL)</th>
                                            <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Assigned To (FE)</th>
                                            <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Meeting Done By</th>
                                            <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Finalized By (TL)</th>
                                        </>
                                    )}
                                    {user?.role === 'Field Executive' && (
                                        <>
                                            <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Meeting Date</th>
                                            <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Meeting Time</th>
                                        </>
                                    )}
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Status</th>
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Created At</th>
                                    {!isTL && <th style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>Updated At</th>}
                                    <th style={{ padding: '16px 20px', whiteSpace: 'nowrap', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLeads.map((lead, i) => {
                                    const currentCanonicalStatus = (isCE ? getCanonicalStatusCE(lead.Status) : getCanonicalStatus(lead.Status)) || lead.Status;
                                    const sc = statusColors[currentCanonicalStatus] || { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' };
                                    const isLeadSelected = selectedLeadsSet.has(lead.LeadID);
                                    return (
                                        <tr key={lead.LeadID} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: '0.15s', background: isLeadSelected ? 'rgba(99,102,241,0.06)' : 'transparent' }}
                                            onMouseEnter={e => { if (!isLeadSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                            onMouseLeave={e => { if (!isLeadSelected) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            {selectMode && (() => {
                                                const recordNum = startIndex + i + 1;
                                                const isOutOfRange = isCE && activeRange && (recordNum < activeRange.start || recordNum > activeRange.end);
                                                return (
                                                    <td style={{ padding: '16px 12px', textAlign: 'center', width: '40px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isLeadSelected}
                                                            disabled={isOutOfRange}
                                                            onChange={() => toggleSelectLead(lead.LeadID)}
                                                            title={isOutOfRange ? `Selection restricted to specified range (${activeRange.start}–${activeRange.end})` : ''}
                                                            style={{
                                                                width: '18px',
                                                                height: '18px',
                                                                cursor: isOutOfRange ? 'not-allowed' : 'pointer',
                                                                accentColor: '#6366f1',
                                                                opacity: isOutOfRange ? 0.25 : 1
                                                            }}
                                                        />
                                                    </td>
                                                );
                                            })()}
                                            <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{startIndex + i + 1}</td>
                                            <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{lead.FullName}</td>
                                            <td style={{ padding: '16px 20px', color: '#64748b', whiteSpace: 'nowrap' }}>{lead.Phone || 'N/A'}</td>
                                            <td style={{ padding: '16px 14px', color: '#64748b', width: '160px', minWidth: '140px', maxWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'middle' }}>
                                                <div 
                                                    style={{ 
                                                        width: '100%',
                                                        maxWidth: '180px', 
                                                        whiteSpace: 'normal', 
                                                        wordBreak: 'break-word', 
                                                        lineHeight: '1.4' 
                                                    }} 
                                                    title={lead.Address || ''}
                                                >
                                                    {lead.Address || 'N/A'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px', color: '#64748b', whiteSpace: 'nowrap' }}>{lead.Email || 'N/A'}</td>
                                            <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: '800', whiteSpace: 'nowrap' }}>{lead.CompanyName || 'N/A'}</td>
                                            <td style={{ padding: '16px 20px', color: '#4f46e5', fontWeight: '800', whiteSpace: 'nowrap' }}>{lead.ServiceInterested || 'N/A'}</td>
                                            <td style={{ padding: '16px 20px', color: '#6366f1', fontWeight: '600', whiteSpace: 'nowrap' }}>{lead.CreatorName || 'N/A'}</td>
                                            {user?.role === 'Admin' && (
                                                <>
                                                    <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{lead.AssignedByName || 'N/A'}</td>
                                                    <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: '500', whiteSpace: 'nowrap' }}>{lead.AssignedToName ? `${lead.AssignedToName} ${lead.AssignedToEmpID ? `(${lead.AssignedToEmpID})` : ''}` : 'N/A'}</td>
                                                    <td style={{ padding: '16px 20px', color: '#6366f1', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{lead.MeetingDoneByName || 'N/A'}</td>
                                                    <td style={{ padding: '16px 20px', color: '#f59e0b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{lead.QuotationUploadedByName || 'N/A'}</td>
                                                </>
                                            )}
                                            {user?.role === 'Field Executive' && (
                                                <>
                                                    <td style={{ padding: '16px 20px', color: '#0f172a', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                        {(() => {
                                                            const mDate = (lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup')
                                                                ? (lead.MeetingFollowupDate || lead.MeetingDate)
                                                                : (lead.MeetingDate || lead.MeetingFollowupDate);
                                                            return mDate ? new Date(mDate).toLocaleDateString('en-GB') : 'N/A';
                                                        })()}
                                                    </td>
                                                    <td style={{ padding: '16px 20px', color: '#0f172a', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                        {(() => {
                                                            const rawT = (lead.Status === 'meetingFollowup' || lead.Status === 'Meeting Follow-up' || lead.Status === 'Meeting Followup')
                                                                ? (lead.MeetingFollowupTime || lead.MeetingTime || 'N/A')
                                                                : (lead.MeetingTime || lead.MeetingFollowupTime || 'N/A');
                                                            return rawT === 'N/A' ? 'N/A' : (formatCleanTime(rawT) || 'N/A');
                                                        })()}
                                                    </td>
                                                </>
                                            )}
                                            <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                                                <span style={{ padding: '4px 12px', background: sc.bg, color: sc.color, borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>
                                                    {currentCanonicalStatus}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px', color: '#334155', fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                                {lead.CreatedAt ? new Date(lead.CreatedAt).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>
                                            {!isTL && (
                                                <td style={{ padding: '16px 20px', color: '#334155', fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                                    {lead.UpdatedAt ? new Date(lead.UpdatedAt).toLocaleDateString('en-GB') : 'N/A'}
                                                </td>
                                            )}
                                            <td style={{ padding: '16px 20px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Eye
                                                        size={17}
                                                        style={{ cursor: 'pointer', color: '#6366f1' }}
                                                        onClick={() => navigate(`/leads/${lead.LeadID}`, { 
                                                            state: { 
                                                                from: isMyCreated ? '/leads/my-created' : '/leads', 
                                                                label: isMyCreated ? 'My Created Leads' : 'Leads'
                                                            } 
                                                        })}
                                                        title="View Details"
                                                    />
                                                    {user?.role === 'Admin' && (
                                                        <FileText
                                                            size={17}
                                                            style={{ cursor: 'pointer', color: '#10b981' }}
                                                            onClick={() => navigate(`/leads/manage/${lead.LeadID}`, { 
                                                                state: { 
                                                                    from: isMyCreated ? '/leads/my-created' : '/leads', 
                                                                    label: isMyCreated ? 'My Created Leads' : 'Leads'
                                                                } 
                                                            })}
                                                            title="Manage Lead"
                                                        />
                                                    )}
                                                    {user?.role === 'Field Executive' && (
                                                        ['Interested', 'Meeting Follow-up', 'Meeting Followup', 'meetingFollowup'].includes(lead.Status) ? (
                                                            <FileText
                                                                size={17}
                                                                style={{ cursor: 'pointer', color: '#10b981' }}
                                                                onClick={() => navigate(`/leads/manage/${lead.LeadID}`, { 
                                                                    state: { 
                                                                        from: isMyCreated ? '/leads/my-created' : '/leads', 
                                                                        label: isMyCreated ? 'My Created Leads' : (user?.role === 'Field Executive' ? 'Assigned Meetings Leads' : 'Leads')
                                                                    } 
                                                                })}
                                                                title="Manage Lead"
                                                            />
                                                        ) : (
                                                            !['Paid'].includes(lead.Status) && (
                                                                <Edit
                                                                    size={17}
                                                                    style={{ cursor: 'pointer', color: '#f59e0b' }}
                                                                    onClick={() => navigate(`/leads/call-manage/${lead.LeadID}`, { state: { from: isMyCreated ? '/leads/my-created' : '/leads', label: isMyCreated ? 'My Created Leads' : 'Leads' } })}
                                                                    title="Repeat Call Action"
                                                                />
                                                            )
                                                        )
                                                    )}
                                                    {user?.role === 'Call Executive' && !['Paid'].includes(lead.Status) && (
                                                        <Edit
                                                            size={17}
                                                            style={{ cursor: 'pointer', color: '#f59e0b' }}
                                                            onClick={() => navigate(`/leads/call-manage/${lead.LeadID}`, { state: { from: isMyCreated ? '/leads/my-created' : '/leads', label: isMyCreated ? 'My Created Leads' : 'Leads' } })}
                                                            title="Repeat Call Action"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Controls Bar */}
                {filtered.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                        padding: '16px 20px',
                        background: 'white',
                        borderRadius: '12px',
                        marginTop: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                        {/* Left side: Showing X-Y of Z */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                Showing <strong style={{ color: '#1e293b' }}>{filtered.length === 0 ? 0 : startIndex + 1}</strong> to <strong style={{ color: '#1e293b' }}>{endIndex}</strong> of <strong style={{ color: '#1e293b' }}>{filtered.length}</strong> records
                            </span>

                            {/* Rows per page selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={e => {
                                        const newSize = e.target.value === 'all' ? 'all' : Number(e.target.value);
                                        setPageSize(newSize);
                                        setCurrentPage(1);
                                    }}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        background: '#f8fafc',
                                        fontSize: '0.82rem',
                                        fontWeight: '600',
                                        color: '#334155',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                    <option value={500}>500</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                        </div>

                        {/* Right side: Page navigation */}
                        {pageSize !== 'all' && totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={safeCurrentPage === 1}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: safeCurrentPage === 1 ? '#f8fafc' : 'white',
                                        color: safeCurrentPage === 1 ? '#cbd5e1' : '#475569',
                                        cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="First Page"
                                >
                                    <ChevronsLeft size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={safeCurrentPage === 1}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: safeCurrentPage === 1 ? '#f8fafc' : 'white',
                                        color: safeCurrentPage === 1 ? '#cbd5e1' : '#475569',
                                        cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Previous Page"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                {(() => {
                                    const pages = [];
                                    const maxButtons = 5;
                                    let startP = Math.max(1, safeCurrentPage - 2);
                                    let endP = Math.min(totalPages, startP + maxButtons - 1);
                                    if (endP - startP + 1 < maxButtons) {
                                        startP = Math.max(1, endP - maxButtons + 1);
                                    }

                                    if (startP > 1) {
                                        pages.push(
                                            <button
                                                key={1}
                                                type="button"
                                                onClick={() => setCurrentPage(1)}
                                                style={{
                                                    minWidth: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e2e8f0',
                                                    background: 'white',
                                                    color: '#475569',
                                                    cursor: 'pointer',
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                1
                                            </button>
                                        );
                                        if (startP > 2) {
                                            pages.push(<span key="dots-start" style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>);
                                        }
                                    }

                                    for (let p = startP; p <= endP; p++) {
                                        const isActive = p === safeCurrentPage;
                                        pages.push(
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setCurrentPage(p)}
                                                style={{
                                                    minWidth: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    border: `1px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                                                    background: isActive ? '#6366f1' : 'white',
                                                    color: isActive ? 'white' : '#475569',
                                                    cursor: 'pointer',
                                                    fontSize: '0.82rem',
                                                    fontWeight: isActive ? '700' : '600',
                                                    boxShadow: isActive ? '0 2px 6px rgba(99,102,241,0.25)' : 'none'
                                                }}
                                            >
                                                {p}
                                            </button>
                                        );
                                    }

                                    if (endP < totalPages) {
                                        if (endP < totalPages - 1) {
                                            pages.push(<span key="dots-end" style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>);
                                        }
                                        pages.push(
                                            <button
                                                key={totalPages}
                                                type="button"
                                                onClick={() => setCurrentPage(totalPages)}
                                                style={{
                                                    minWidth: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e2e8f0',
                                                    background: 'white',
                                                    color: '#475569',
                                                    cursor: 'pointer',
                                                    fontSize: '0.82rem',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {totalPages}
                                            </button>
                                        );
                                    }

                                    return pages;
                                })()}

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={safeCurrentPage === totalPages}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: safeCurrentPage === totalPages ? '#f8fafc' : 'white',
                                        color: safeCurrentPage === totalPages ? '#cbd5e1' : '#475569',
                                        cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Next Page"
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={safeCurrentPage === totalPages}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: safeCurrentPage === totalPages ? '#f8fafc' : 'white',
                                        color: safeCurrentPage === totalPages ? '#cbd5e1' : '#475569',
                                        cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Last Page"
                                >
                                    <ChevronsRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Floating Action Bar for Selected Leads */}
            {selectMode && selectedLeads.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    background: '#1e293b', color: 'white', padding: '14px 28px', borderRadius: '16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '16px',
                    zIndex: 99999, animation: 'slideUp 0.25s ease-out', maxWidth: '90vw', flexWrap: 'wrap', justifyContent: 'center'
                }}>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                        {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                        {rangeFeedback ? ` (${rangeFeedback})` : ''}
                    </span>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        disabled={deletingSelected}
                        style={{
                            background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px',
                            borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex',
                            alignItems: 'center', gap: '8px', fontSize: '0.9rem', whiteSpace: 'nowrap'
                        }}
                    >
                        {deletingSelected ? <Loader size={16} className="spin" /> : <Trash2 size={16} />}
                        {deletingSelected ? 'Deleting...' : 'Delete Selected'}
                    </button>
                    <button
                        onClick={handleClearSelection}
                        style={{
                            background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', padding: '10px 16px',
                            borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap'
                        }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => { handleClearSelection(); setSelectMode(false); }}
                        style={{
                            background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 14px',
                            borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Export Modal - For Call Executive & Field Executive */}
            {(isCE || isFE) && showExportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        padding: '28px',
                        maxWidth: '460px',
                        width: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '10px', borderRadius: '12px', color: '#6366f1', display: 'flex' }}>
                                    <Download size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '700' }}>
                                        {isMyCreated ? 'Export My Created Leads' : 'Export Leads'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                        {isMyCreated ? 'Download your created lead records with all details' : 'Download lead records with all details'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowExportModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Format Selection */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                                Export Format
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('excel')}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: `2px solid ${exportFormat === 'excel' ? '#10b981' : '#e2e8f0'}`,
                                        background: exportFormat === 'excel' ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
                                        color: exportFormat === 'excel' ? '#059669' : '#475569',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <FileSpreadsheet size={18} /> Excel (.xlsx)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExportFormat('pdf')}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: `2px solid ${exportFormat === 'pdf' ? '#ef4444' : '#e2e8f0'}`,
                                        background: exportFormat === 'pdf' ? 'rgba(239, 68, 68, 0.08)' : '#ffffff',
                                        color: exportFormat === 'pdf' ? '#dc2626' : '#475569',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <FileText size={18} /> PDF (.pdf)
                                </button>
                            </div>
                        </div>

                        {/* Records Scope Selection */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                                Records to Include
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    border: `1.5px solid ${exportScope === 'filtered' ? '#6366f1' : '#e2e8f0'}`,
                                    background: exportScope === 'filtered' ? 'rgba(99, 102, 241, 0.06)' : '#f8fafc',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}>
                                    <input
                                        type="radio"
                                        name="exportScope"
                                        value="filtered"
                                        checked={exportScope === 'filtered'}
                                        onChange={() => setExportScope('filtered')}
                                        style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>
                                            Filtered / Searched Records
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                            Exports currently displayed leads ({filtered.length} {filtered.length === 1 ? 'record' : 'records'})
                                        </div>
                                    </div>
                                </label>

                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    border: `1.5px solid ${exportScope === 'all' ? '#6366f1' : '#e2e8f0'}`,
                                    background: exportScope === 'all' ? 'rgba(99, 102, 241, 0.06)' : '#f8fafc',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}>
                                    <input
                                        type="radio"
                                        name="exportScope"
                                        value="all"
                                        checked={exportScope === 'all'}
                                        onChange={() => setExportScope('all')}
                                        style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>
                                            All Records
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                            {isMyCreated
                                                ? `Exports all my created leads (${baseLeads.length} ${baseLeads.length === 1 ? 'record' : 'records'})`
                                                : (isFE
                                                    ? `Exports all assigned meeting leads (${baseLeads.length} ${baseLeads.length === 1 ? 'record' : 'records'})`
                                                    : `Exports entire database (${leads.length} ${leads.length === 1 ? 'record' : 'records'})`)}
                                        </div>
                                    </div>
                                </label>

                                {selectedLeads.length > 0 && (
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        border: `1.5px solid ${exportScope === 'selected' ? '#6366f1' : '#e2e8f0'}`,
                                        background: exportScope === 'selected' ? 'rgba(99, 102, 241, 0.06)' : '#f8fafc',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        <input
                                            type="radio"
                                            name="exportScope"
                                            value="selected"
                                            checked={exportScope === 'selected'}
                                            onChange={() => setExportScope('selected')}
                                            style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>
                                                Selected Records Only
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                Exports checked leads ({selectedLeads.length} {selectedLeads.length === 1 ? 'record' : 'records'})
                                            </div>
                                        </div>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={exporting || (exportScope === 'filtered' ? filtered.length === 0 : (exportScope === 'selected' ? selectedLeads.length === 0 : baseLeads.length === 0))}
                                className="btn-primary"
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontSize: '0.95rem'
                                }}
                            >
                                {exporting ? <Loader size={18} className="spin" /> : <><Download size={18} /> Download {exportFormat === 'excel' ? 'Excel' : 'PDF'}</>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="btn-secondary"
                                style={{
                                    padding: '0 20px',
                                    height: '44px',
                                    fontSize: '0.95rem',
                                    border: '1px solid #cbd5e1'
                                }}
                                disabled={exporting}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Selected Confirmation Modal */}
            {showDeleteModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
                }}>
                    <div style={{
                        background: 'white', padding: '36px', borderRadius: '24px', width: '90%', maxWidth: '420px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '50%', flexShrink: 0 }}>
                                <AlertTriangle size={26} />
                            </div>
                            <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0 }}>Delete Selected Leads</h2>
                        </div>
                        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
                            Are you sure you want to <strong>permanently delete {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''}</strong>? This action cannot be undone and will remove all associated meetings and payments.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Trash2 size={16} /> Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
};

const detailLabel = { display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' };
const detailValue = { fontSize: '0.95rem', color: '#1e293b', fontWeight: '500' };

export default LeadList;
