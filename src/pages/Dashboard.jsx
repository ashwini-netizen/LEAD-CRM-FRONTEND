import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, UserPlus, List, Settings, LogOut, Loader, AlertCircle, BarChart, Calendar, Clock, FileText, CreditCard, Navigation, Activity, Users, TrendingUp, IndianRupee, Download, FileDown, MessageSquare, CheckCircle, PhoneCall, RotateCcw, Filter, Award, CheckCircle2, XCircle, Search, UserCheck, Eye, BarChart3, Phone, RefreshCw, X } from 'lucide-react';
import {
    BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { savePDF } from '../utils/pdfDownload';
import { Browser } from '@capacitor/browser';
import UserHeader from '../components/UserHeader';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

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

// Robust time parser to minutes from midnight (0 - 1439). Handles AM/PM, repeated meridians, 12/24hr
const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 1440;
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
    if (!match) return 1440;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3] ? match[3].toUpperCase() : null;
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

// Date-wise Sorting for Call Executive Follow-up Leads:
// Priority 1: Follow-ups scheduled for Today (sorted by time ASC)
// Priority 2: Overdue follow-ups (displayed after today's, most recent overdue first, time ASC)
// Priority 3: Nearest upcoming follow-ups first (nearest upcoming date first, time ASC)
const sortFollowupLeads = (a, b, todayStr) => {
    const dateA = getLocalDateStr(a.FollowupDate) || getLocalDateStr(a.MeetingFollowupDate) || getLocalDateStr(a.UpdatedAt);
    const dateB = getLocalDateStr(b.FollowupDate) || getLocalDateStr(b.MeetingFollowupDate) || getLocalDateStr(b.UpdatedAt);

    const getRank = (d) => {
        if (!d) return 4;
        if (d === todayStr) return 1; // Priority 1: Today
        if (d < todayStr) return 2;   // Priority 2: Overdue
        return 3;                     // Priority 3: Upcoming
    };

    const rankA = getRank(dateA);
    const rankB = getRank(dateB);

    if (rankA !== rankB) return rankA - rankB;

    // Within Priority 1 (Today): sort by scheduled time ascending
    if (rankA === 1) {
        const timeA = parseTimeToMinutes(a.FollowupTime || a.MeetingFollowupTime || a.MeetingTime);
        const timeB = parseTimeToMinutes(b.FollowupTime || b.MeetingFollowupTime || b.MeetingTime);
        if (timeA !== timeB) return timeA - timeB;
        return (b.LeadID || 0) - (a.LeadID || 0);
    }

    // Within Priority 2 (Overdue): sort by date (most recent overdue first) then time ascending
    if (rankA === 2) {
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const timeA = parseTimeToMinutes(a.FollowupTime || a.MeetingFollowupTime || a.MeetingTime);
        const timeB = parseTimeToMinutes(b.FollowupTime || b.MeetingFollowupTime || b.MeetingTime);
        if (timeA !== timeB) return timeA - timeB;
        return (b.LeadID || 0) - (a.LeadID || 0);
    }

    // Within Priority 3 (Upcoming): nearest upcoming date first (ascending) then time ascending
    if (rankA === 3) {
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = parseTimeToMinutes(a.FollowupTime || a.MeetingFollowupTime || a.MeetingTime);
        const timeB = parseTimeToMinutes(b.FollowupTime || b.MeetingFollowupTime || b.MeetingTime);
        if (timeA !== timeB) return timeA - timeB;
        return (b.LeadID || 0) - (a.LeadID || 0);
    }

    return (b.LeadID || 0) - (a.LeadID || 0);
};

const Dashboard = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [callDate, setCallDate] = useState(new Date().toISOString().split('T')[0]);
    const [showAllStatuses, setShowAllStatuses] = useState(false);
    const [callPage, setCallPage] = useState(1);
    const CALLS_PER_PAGE = 15;

    // Call Executive Leads List State (New Leads & Follow-up Leads categories)
    const [ceLeads, setCeLeads] = useState([]);
    const [loadingCeLeads, setLoadingCeLeads] = useState(false);
    const [ceLeadsCategory, setCeLeadsCategory] = useState('new'); // 'new' | 'followup'
    const [ceLeadsSearch, setCeLeadsSearch] = useState('');
    const [ceLeadsPage, setCeLeadsPage] = useState(1);
    const CE_LEADS_PER_PAGE = 15;

    // Independent date ranges for CE Leads categories (default: empty, displaying today's records only)
    const [ceNewDateRange, setCeNewDateRange] = useState({ from: '', to: '' });
    const [ceFollowupDateRange, setCeFollowupDateRange] = useState({ from: '', to: '' });
    const [ceDateRangeError, setCeDateRangeError] = useState('');

    const todayStr = useMemo(() => getTodayDateStr(), []);
    const activeCeRange = ceLeadsCategory === 'new' ? ceNewDateRange : ceFollowupDateRange;

    const handleCeFromDateChange = (val) => {
        setCeDateRangeError('');
        const updateRange = (prev) => {
            let to = prev.to;
            if (val && to) {
                if (val > to) {
                    to = val;
                } else if (getDaysDifference(val, to) > 31) {
                    to = addDaysToDate(val, 31);
                    setCeDateRangeError('Date range adjusted to 1 month maximum (31 days)');
                }
            }
            return { from: val, to };
        };

        if (ceLeadsCategory === 'new') {
            setCeNewDateRange(updateRange);
        } else {
            setCeFollowupDateRange(updateRange);
        }
        setCeLeadsPage(1);
    };

    const handleCeToDateChange = (val) => {
        setCeDateRangeError('');
        const updateRange = (prev) => {
            let from = prev.from;
            if (val && from) {
                if (val < from) {
                    setCeDateRangeError('To Date cannot be earlier than From Date');
                    return prev;
                }
                if (getDaysDifference(from, val) > 31) {
                    setCeDateRangeError('Date range cannot exceed 1 month (maximum 31 days)');
                    val = addDaysToDate(from, 31);
                }
            }
            return { from, to: val };
        };

        if (ceLeadsCategory === 'new') {
            setCeNewDateRange(updateRange);
        } else {
            setCeFollowupDateRange(updateRange);
        }
        setCeLeadsPage(1);
    };

    const handleCeClearDates = () => {
        setCeDateRangeError('');
        if (ceLeadsCategory === 'new') {
            setCeNewDateRange({ from: '', to: '' });
        } else {
            setCeFollowupDateRange({ from: '', to: '' });
        }
        setCeLeadsPage(1);
    };

    // Team Lead & Admin Real-Time Call Activity Tracking State
    const [adminCeFilter, setAdminCeFilter] = useState('all');
    const [adminCallDate, setAdminCallDate] = useState(new Date().toISOString().split('T')[0]);
    const [showAllTeamStatuses, setShowAllTeamStatuses] = useState(false);
    const [teamCallSearch, setTeamCallSearch] = useState('');
    const [teamCallPage, setTeamCallPage] = useState(1);
    const [callTrackingTab, setCallTrackingTab] = useState('overview'); // 'overview' | 'comparison' | 'activity'

    const handleStartDateChange = (val) => {
        setStartDate(val);
        if (val && endDate && val > endDate) {
            setEndDate(val);
        }
    };

    const handleEndDateChange = (val) => {
        if (val && startDate && val < startDate) {
            return;
        }
        setEndDate(val);
    };
    const [timeData, setTimeData] = useState([]);
    const [loadingCharts, setLoadingCharts] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [isOnline, setIsOnline] = useState(user?.IsOnline || false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [logoutWarning, setLogoutWarning] = useState('');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const NavItem = ({ to, children, active = false, onClick }) => {
        const isExecutive = user?.role === 'Call Executive' || user?.role === 'Field Executive';
        const restricted = isExecutive && !isOnline && to !== '/dashboard';

        if (restricted) {
            return (
                <div 
                    style={{ ...navStyle, opacity: 0.5, cursor: 'not-allowed' }} 
                    title="Please turn on online status to perform the activities"
                >
                    {children}
                </div>
            );
        }

        return (
            <Link to={to} state={{ from: location.pathname }} style={active ? navActiveStyle : navStyle} onClick={(e) => {
                if (isMobile) setIsSidebarOpen(false);
                if (onClick) onClick(e);
            }}>
                {children}
            </Link>
        );
    };

    const isTLOrAdmin = user?.role === 'Admin' || user?.role === 'Team Lead';

    const fetchOverview = useCallback(async (ceDate, adminDate, ceFilter, startD, endD) => {
        setLoading(true);
        setError('');
        try {
            const isAdminOrTL = user?.role === 'Admin' || user?.role === 'Team Lead';
            const dateParam = isAdminOrTL
                ? (adminDate || new Date().toISOString().split('T')[0])
                : (ceDate || new Date().toISOString().split('T')[0]);

            let url = `${API_URL}/api/stats/overview?date=${dateParam}`;
            if (isAdminOrTL) {
                if (startD && endD) {
                    url += `&startDate=${startD}&endDate=${endD}`;
                }
                if (ceFilter) {
                    url += `&executiveId=${ceFilter}`;
                }
            }
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
            });
            if (!res.ok) throw new Error('Failed to load dashboard stats');
            const data = await res.json();
            setOverview(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user?.role]);

    useEffect(() => {
        fetchOverview(callDate, adminCallDate, adminCeFilter, startDate, endDate);
    }, [fetchOverview, callDate, adminCallDate, adminCeFilter, startDate, endDate]);

    // Auto-refresh dashboard stats when window regains focus, tab becomes visible, or call/lead status updates
    useEffect(() => {
        const handleAutoRefresh = () => {
            fetchOverview(callDate, adminCallDate, adminCeFilter, startDate, endDate);
            fetchCeLeads();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleAutoRefresh();
            }
        };

        window.addEventListener('lead_updated', handleAutoRefresh);
        window.addEventListener('call_logged', handleAutoRefresh);
        window.addEventListener('focus', handleAutoRefresh);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('lead_updated', handleAutoRefresh);
            window.removeEventListener('call_logged', handleAutoRefresh);
            window.removeEventListener('focus', handleAutoRefresh);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchOverview, callDate, adminCallDate, adminCeFilter, startDate, endDate]);

    // Fetch Call Executive leads for New Leads & Follow-up Leads categories
    const fetchCeLeads = useCallback(async () => {
        const isCE = user?.role === 'Call Executive' || user?.Role === 'Call Executive';
        if (!isCE) return;
        setLoadingCeLeads(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch(`${API_URL}/api/leads`, {
                headers: { Authorization: `Bearer ${token || ''}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCeLeads(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch CE leads:', err);
        } finally {
            setLoadingCeLeads(false);
        }
    }, [user?.role, user?.Role]);

    useEffect(() => {
        fetchCeLeads();
    }, [fetchCeLeads]);

    // Real-time periodic auto-sync for Call Executive, Team Lead, and Admin (every 15s)
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchOverview(callDate, adminCallDate, adminCeFilter, startDate, endDate);
                fetchCeLeads();
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchOverview, fetchCeLeads, callDate, adminCallDate, adminCeFilter, startDate, endDate]);

    const fetchTimeSeries = useCallback(async () => {
        if (user?.role !== 'Admin' && user?.role !== 'Team Lead') return;
        setLoadingCharts(true);
        try {
            const res = await fetch(`${API_URL}/api/stats/time-series?startDate=${startDate}&endDate=${endDate}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) setTimeData(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCharts(false);
        }
    }, [startDate, endDate, user?.role]);

    useEffect(() => {
        fetchTimeSeries();
    }, [fetchTimeSeries]);

    const handleDownloadPDF = async () => {
        setExporting(true);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFillColor(99, 102, 241); // indigo-500
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('CRM Performance Report', 20, 25);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const pad = (n) => String(n).padStart(2, '0');
            const now = new Date();
            const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const fmtPeriod = (dStr) => dStr ? dStr.split('-').reverse().join('-') : '';
            doc.text(`Generated on: ${dateStr} ${timeStr}`, 20, 32);
            doc.text(`Period: ${fmtPeriod(startDate)} to ${fmtPeriod(endDate)}`, pageWidth - 20, 32, { align: 'right' });

            let y = 55;

            // Totals Section
            const totals = timeData.reduce((acc, curr) => {
                acc.interested += curr.interested;
                acc.converted += curr.converted;
                acc.followups += curr.followups;
                acc.notInterested += curr.notInterested;
                acc.pending += curr.pending || 0;
                acc.revenue += curr.revenue;
                acc.due += curr.due;
                return acc;
            }, { interested: 0, converted: 0, followups: 0, notInterested: 0, pending: 0, revenue: 0, due: 0 });

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(16);
            doc.text('Performance Summary', 20, y);
            y += 10;

            doc.setDrawColor(226, 232, 240);
            doc.line(20, y, pageWidth - 20, y);
            y += 10;

            doc.setFontSize(11);
            const gridX = [20, 80, 140];
            doc.text([`Interested: ${totals.interested}`, `Converted: ${totals.converted}`, `Pending: ${totals.pending}`], gridX[0], y);
            doc.text([`Follow-ups: ${totals.followups}`, `Not Interested: ${totals.notInterested}`], gridX[1], y);
            doc.text([`Revenue: INR ${totals.revenue.toLocaleString()}`, `Due Amount: INR ${totals.due.toLocaleString()}`], gridX[2], y);

            y += 18;
            doc.setDrawColor(226, 232, 240);
            doc.line(20, y, pageWidth - 20, y);
            y += 12;

            // Chart 1
            const leadChart = document.getElementById('lead-chart-export');
            if (leadChart) {
                doc.setFontSize(14);
                doc.text('Lead Distribution Trends', 20, y);
                y += 5;
                const canvas = await html2canvas(leadChart, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 20, y, 170, 85);
                y += 95;
            }

            // Chart 2
            const finChart = document.getElementById('financial-chart-export');
            if (finChart) {
                if (y > 200) { doc.addPage(); y = 20; }
                doc.setFontSize(14);
                doc.text('Financial Growth Trends', 20, y);
                y += 5;
                const canvas = await html2canvas(finChart, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 20, y, 170, 85);
            }
            const base64 = doc.output('datauristring').split(',')[1];
            const filename = `CRM_Report_${fmtPeriod(startDate)}_${fmtPeriod(endDate)}.pdf`;

            await savePDF(doc, filename);

            const isNativeCapacitor = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web';
            if (isNativeCapacitor) {
                try {
                    const uploadRes = await fetch(`${API_URL}/api/stats/upload-pdf`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('crm_token') || ''}`
                        },
                        body: JSON.stringify({ filename, base64 })
                    });
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        if (uploadData.success && uploadData.url) {
                            const absoluteUrl = uploadData.url.startsWith('http') 
                                ? uploadData.url 
                                : `${API_URL}${uploadData.url}`;
                            setPdfPreviewUrl(absoluteUrl);
                        }
                    } else {
                        console.error('Failed to upload PDF for preview');
                    }
                } catch (uploadErr) {
                    console.error('Error uploading PDF for preview:', uploadErr);
                }
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate PDF');
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        const syncOnlineStatus = async () => {
            const cleanRole = String(user?.role || user?.Role || '').trim().toLowerCase();
            if (cleanRole === 'admin' || cleanRole === 'team lead' || cleanRole === 'team_lead') return;
            try {
                const res = await fetch(`${API_URL}/api/users/profile`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.IsOnline !== undefined) {
                        const isOnlineBool = data.IsOnline === true || data.IsOnline === 1;
                        setIsOnline(isOnlineBool);
                        const updatedUser = { ...user, IsOnline: isOnlineBool };
                        localStorage.setItem('crm_user', JSON.stringify(updatedUser));
                    }
                }
            } catch (err) {
                console.error('Failed to sync online status:', err);
            }
        };
        syncOnlineStatus();
    }, [user?.role, user?.Role]);

    useEffect(() => {
        if (user?.IsOnline !== undefined) {
            setIsOnline(user?.IsOnline === true || user?.IsOnline === 1);
        }
    }, [user?.IsOnline]);

    const toggleStatus = async () => {
        const newStatus = !isOnline;
        try {
            const res = await fetch(`${API_URL}/api/users/toggle-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updatedUser = { ...user, IsOnline: newStatus };
                localStorage.setItem('crm_user', JSON.stringify(updatedUser));
                setIsOnline(newStatus);
                window.dispatchEvent(new Event('user_updated'));
            }
        } catch (err) {
            console.error('Toggle status error:', err);
        }
    };

    const isTL = user?.role === 'Team Lead' || user?.Role === 'Team Lead';
    const isCallExecutive = user?.role === 'Call Executive' || user?.Role === 'Call Executive';

    const standardStatusDefs = [
        { label: 'Interested', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
        { label: 'Not Interested', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
        { label: 'Follow-up', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
        { label: 'Not Answering', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
        { label: 'Direct Visit', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
        { label: 'Switch Off', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
        { label: 'Busy', color: '#d97706', bg: '#fffbeb', border: '#fed7aa' },
        { label: 'Invalid', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
        { label: 'Speaking with Someone Else', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
        { label: 'Hold', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
        { label: 'Incoming Not Available', color: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
        { label: 'Processing', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
        { label: 'Out of Service', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
        { label: 'Wrong Number', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
    ];

    const callStatusCards = useMemo(() => {
        if (!isCallExecutive) return [];

        const breakdown = overview?.callBreakdown || [];
        const breakdownMap = new Map();
        breakdown.forEach(item => {
            if (item.status) {
                breakdownMap.set(item.status.trim().toLowerCase(), item.count);
            }
        });

        const cards = [];

        // 1. Standard statuses
        standardStatusDefs.forEach(def => {
            const count = breakdownMap.get(def.label.toLowerCase()) || 0;
            cards.push({
                label: def.label,
                count,
                color: def.color,
                bg: def.bg,
                border: def.border,
                isStandard: true
            });
            breakdownMap.delete(def.label.toLowerCase());
        });

        // 2. Any additional dynamic statuses recorded on this date
        breakdownMap.forEach((count, key) => {
            const original = breakdown.find(b => b.status?.trim().toLowerCase() === key);
            const label = original?.status?.trim() || (key.charAt(0).toUpperCase() + key.slice(1));
            cards.push({
                label,
                count,
                color: '#6366f1',
                bg: '#f5f3ff',
                border: '#e0e7ff',
                isStandard: false
            });
        });

        return cards;
    }, [isCallExecutive, overview?.callBreakdown]);

    const visibleCallCards = useMemo(() => {
        if (showAllStatuses) return callStatusCards;
        // Default: cards with count > 0, plus standard Interested, Not Interested, Follow-up
        return callStatusCards.filter(c => c.count > 0 || ['Interested', 'Not Interested', 'Follow-up'].includes(c.label));
    }, [callStatusCards, showAllStatuses]);

    const callRecords = overview?.callRecords || [];
    const totalPages = Math.ceil(callRecords.length / CALLS_PER_PAGE) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (callPage - 1) * CALLS_PER_PAGE;
        return callRecords.slice(start, start + CALLS_PER_PAGE);
    }, [callRecords, callPage]);

    // Helper to identify Follow-up leads
    const isFollowupLead = useCallback((l) => {
        if (!l) return false;
        const s = String(l.Status || '').trim().toLowerCase();
        const hasFollowupStatus = s === 'follow-up' || s === 'call follow-up' || s === 'followup' || s === 'call followup' || s === 'meetingfollowup' || s === 'meeting follow-up';
        const hasFollowupDate = Boolean(l.FollowupDate && String(l.FollowupDate).trim() !== '');
        return hasFollowupStatus || hasFollowupDate;
    }, []);

    // Category A: New Leads (Assigned or created leads not in follow-up, filtered by CreatedAt)
    // Default view: created today. Custom range: created within selected period up to 1 month.
    const ceNewLeads = useMemo(() => {
        return ceLeads.filter(l => {
            if (isFollowupLead(l)) return false;
            const cDate = getLocalDateStr(l.CreatedAt);
            return isRecordInDateRange(cDate, ceNewDateRange.from, ceNewDateRange.to, todayStr);
        });
    }, [ceLeads, isFollowupLead, ceNewDateRange, todayStr]);

    // Category B: Follow-up Leads (Leads scheduled for follow-up, filtered by actual FollowupDate)
    // Default view: scheduled for today. Custom range: scheduled within selected period up to 1 month.
    // Date-wise sorted:
    // - Today's scheduled follow-ups first (sorted by time ascending)
    // - Overdue follow-ups displayed after today's scheduled follow-ups (most recent overdue first, time ascending)
    // - Nearest upcoming follow-ups next (ascending order of upcoming dates, time ascending)
    const ceFollowupLeads = useMemo(() => {
        const list = ceLeads.filter(l => {
            if (!isFollowupLead(l)) return false;
            const fDate = getLocalDateStr(l.FollowupDate) || getLocalDateStr(l.UpdatedAt);
            return isRecordInDateRange(fDate, ceFollowupDateRange.from, ceFollowupDateRange.to, todayStr);
        });
        return [...list].sort((a, b) => sortFollowupLeads(a, b, todayStr));
    }, [ceLeads, isFollowupLead, ceFollowupDateRange, todayStr]);

    // Filter active category leads by search
    const activeCategoryLeads = useMemo(() => {
        const sourceList = ceLeadsCategory === 'new' ? ceNewLeads : ceFollowupLeads;
        if (!ceLeadsSearch.trim()) return sourceList;
        const q = ceLeadsSearch.toLowerCase();
        return sourceList.filter(l => 
            (l.FullName && l.FullName.toLowerCase().includes(q)) ||
            (l.Phone && String(l.Phone).toLowerCase().includes(q)) ||
            (l.CompanyName && l.CompanyName.toLowerCase().includes(q)) ||
            (l.Status && l.Status.toLowerCase().includes(q)) ||
            (l.ServiceInterested && l.ServiceInterested.toLowerCase().includes(q)) ||
            (l.CallNote && l.CallNote.toLowerCase().includes(q))
        );
    }, [ceLeadsCategory, ceNewLeads, ceFollowupLeads, ceLeadsSearch]);

    const totalCeLeadsPages = Math.ceil(activeCategoryLeads.length / CE_LEADS_PER_PAGE) || 1;
    const paginatedCeLeads = useMemo(() => {
        const start = (ceLeadsPage - 1) * CE_LEADS_PER_PAGE;
        return activeCategoryLeads.slice(start, start + CE_LEADS_PER_PAGE);
    }, [activeCategoryLeads, ceLeadsPage]);

    // Team Lead & Admin Real-Time Call Status Cards
    const teamCallStatusCards = useMemo(() => {
        if (!isTL && user?.role !== 'Admin') return [];

        const breakdown = overview?.callBreakdown || [];
        const breakdownMap = new Map();
        breakdown.forEach(item => {
            if (item.status) {
                breakdownMap.set(item.status.trim().toLowerCase(), item.count);
            }
        });

        const cards = [];

        // 1. Standard statuses
        standardStatusDefs.forEach(def => {
            const count = breakdownMap.get(def.label.toLowerCase()) || 0;
            cards.push({
                label: def.label,
                count,
                color: def.color,
                bg: def.bg,
                border: def.border,
                isStandard: true
            });
            breakdownMap.delete(def.label.toLowerCase());
        });

        // 2. Dynamic statuses
        breakdownMap.forEach((count, key) => {
            const original = breakdown.find(b => b.status?.trim().toLowerCase() === key);
            const label = original?.status?.trim() || (key.charAt(0).toUpperCase() + key.slice(1));
            cards.push({
                label,
                count,
                color: '#6366f1',
                bg: '#f5f3ff',
                border: '#e0e7ff',
                isStandard: false
            });
        });

        return cards;
    }, [isTL, user?.role, overview?.callBreakdown]);

    const visibleTeamCallCards = useMemo(() => {
        if (showAllTeamStatuses) return teamCallStatusCards;
        return teamCallStatusCards.filter(c => c.count > 0 || ['Interested', 'Not Interested', 'Follow-up'].includes(c.label));
    }, [teamCallStatusCards, showAllTeamStatuses]);

    const TEAM_CALLS_PER_PAGE = 15;
    const teamCallRecords = overview?.callRecords || [];
    const filteredTeamCallRecords = useMemo(() => {
        if (!teamCallSearch.trim()) return teamCallRecords;
        const q = teamCallSearch.toLowerCase();
        return teamCallRecords.filter(r => 
            (r.FullName && r.FullName.toLowerCase().includes(q)) ||
            (r.CompanyName && r.CompanyName.toLowerCase().includes(q)) ||
            (r.Phone && String(r.Phone).toLowerCase().includes(q)) ||
            (r.Status && r.Status.toLowerCase().includes(q)) ||
            (r.ExecutiveName && r.ExecutiveName.toLowerCase().includes(q)) ||
            (r.ExecutiveEmpID && r.ExecutiveEmpID.toLowerCase().includes(q)) ||
            (r.CallNote && r.CallNote.toLowerCase().includes(q))
        );
    }, [teamCallRecords, teamCallSearch]);

    const totalTeamCallPages = Math.ceil(filteredTeamCallRecords.length / TEAM_CALLS_PER_PAGE) || 1;
    const paginatedTeamCallRecords = useMemo(() => {
        const start = (teamCallPage - 1) * TEAM_CALLS_PER_PAGE;
        return filteredTeamCallRecords.slice(start, start + TEAM_CALLS_PER_PAGE);
    }, [filteredTeamCallRecords, teamCallPage]);

    const getBadgeColor = (status) => {
        const s = String(status || '').trim().toLowerCase();
        if (s === 'interested') return { bg: '#dcfce7', text: '#15803d' };
        if (s === 'not interested' || s === 'invalid') return { bg: '#fee2e2', text: '#b91c1c' };
        if (s === 'follow-up' || s === 'call follow-up') return { bg: '#fef3c7', text: '#b45309' };
        if (s.includes('busy')) return { bg: '#ffedd5', text: '#c2410c' };
        if (s.includes('answering') || s.includes('answered')) return { bg: '#f3e8ff', text: '#7e22ce' };
        if (s.includes('direct visit')) return { bg: '#e0f2fe', text: '#0369a1' };
        if (s.includes('switch off')) return { bg: '#f1f5f9', text: '#475569' };
        return { bg: '#e0e7ff', text: '#4338ca' };
    };

    const convCardStyle = (color, bg, border) => ({
        background: 'white',
        padding: '18px 20px',
        borderRadius: '16px',
        border: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease'
    });

    const statsConfig = [
        { label: 'Total Leads', key: 'totalLeads', color: '#6366f1', filter: 'all' },
        { label: 'Conversions', key: 'conversions', color: '#10b981', filter: 'conversions' },
        { label: 'Pending', key: 'pending', color: '#f59e0b', filter: 'pending' },
        ...(user?.role !== 'Call Executive' && user?.role !== 'Field Executive' ? [
            { label: 'Revenue', key: 'totalRevenue', color: '#ec4899', isCurrency: true },
            { label: 'Due Revenue', key: 'dueRevenue', color: '#f43f5e', isCurrency: true },
            { label: 'Call Records', key: 'totalCalls', color: '#8b5cf6', isCallCard: true }
        ] : [])
    ];

    const handleLogoutClick = () => {
        const crmUser = JSON.parse(localStorage.getItem('crm_user') || '{}');
        const role = user?.role || user?.Role || crmUser?.role || crmUser?.Role;
        const onlineVal = isOnline || user?.IsOnline || crmUser?.IsOnline;
        const cleanRole = String(role || '').trim().toLowerCase();

        if ((cleanRole === 'field executive' || cleanRole === 'field_executive' || cleanRole === 'call executive' || cleanRole === 'call_executive') && onlineVal) {
            setLogoutWarning('Please turn off online status or go offline before logging out.');
            setShowLogoutModal(true);
        } else {
            setLogoutWarning('');
            setShowLogoutModal(true);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
            {isMobile && isSidebarOpen && (
                <div 
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 999 }}
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <aside style={{
                width: '260px',
                minWidth: '260px',
                flexShrink: 0,
                background: 'white',
                borderRight: '1px solid #e2e8f0',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                position: isMobile ? 'fixed' : 'relative',
                left: isMobile ? (isSidebarOpen ? '0' : '-260px') : '0',
                top: 0,
                height: '100vh',
                zIndex: 1000,
                transition: 'left 0.3s ease',
                boxShadow: isMobile && isSidebarOpen ? '0 10px 30px rgba(0,0,0,0.15)' : 'none'
            }}>
                <h2 style={{ color: '#6366f1', marginBottom: '40px', fontSize: '1.8rem', fontWeight: '800' }}>CRM Portal</h2>
                <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '5px' }}>
                    <NavItem to="/dashboard" active={location.pathname === '/dashboard'}><LayoutDashboard size={20} /> Dashboard</NavItem>
                    {user?.role !== 'Admin' && <NavItem to="/leads/new?from=dashboard" active={location.pathname === '/leads/new'}><UserPlus size={20} /> New Lead</NavItem>}
                    <NavItem to="/leads" active={location.pathname === '/leads'}><List size={20} /> {user?.role === 'Field Executive' ? 'Assigned Meetings Leads' : 'Leads List'}</NavItem>
                    {user?.role === 'Field Executive' && (
                        <>
                            <NavItem to="/leads/my-created" active={location.pathname === '/leads/my-created'}><List size={20} /> Lead List</NavItem>
                            <NavItem to="/leads/assigned" active={location.pathname === '/leads/assigned'}><UserPlus size={20} /> Assigned Call Leads</NavItem>
                            <NavItem to="/leads/finalized" active={location.pathname === '/leads/finalized'}><CheckCircle size={20} /> Finalized Leads</NavItem>
                        </>
                    )}
                    {(user?.role === 'Team Lead' || user?.role === 'Call Executive') && (
                        <>
                            {user?.role === 'Team Lead' && <NavItem to="/leads/interested" active={location.pathname === '/leads/interested'}><BarChart size={20} /> Interested Leads</NavItem>}
                            <NavItem to="/leads/lead-gen-followup" active={location.pathname === '/leads/lead-gen-followup'}><Clock size={20} /> Lead Gen Follow-up</NavItem>
                            {user?.role === 'Call Executive' && <NavItem to="/leads/assigned" active={location.pathname === '/leads/assigned'}><UserPlus size={20} /> Assigned Leads</NavItem>}
                            {user?.role === 'Team Lead' && (
                                <>
                                    <NavItem to="/leads/meeting-followup" active={location.pathname === '/leads/meeting-followup'}><Calendar size={20} /> Meeting Follow-up</NavItem>
                                    <NavItem to="/leads/quotation-needed" active={location.pathname === '/leads/quotation-needed'}><FileText size={20} /> Quotation Requests</NavItem>
                                    <NavItem to="/leads/payment-pending" active={location.pathname === '/leads/payment-pending'}><CreditCard size={20} /> Payments</NavItem>
                                    <NavItem to="/tracking" active={location.pathname === '/tracking'}><Navigation size={20} /> Live Tracking</NavItem>
                                
                                </>
                            )}
                        </>
                    )}
                    {user?.role === 'Admin' && (
                        <>
                            <NavItem to="/tracking" active={location.pathname === '/tracking'}><Navigation size={20} /> Live Tracking</NavItem>
                            <NavItem to="/admin" active={location.pathname === '/admin'} onClick={() => localStorage.removeItem('admin_panel_selected_role')}><Settings size={20} /> Admin Tools</NavItem>
                            <NavItem to="/admin/history" active={location.pathname === '/admin/history'}><Activity size={20} /> Lead History</NavItem>
                        </>
                    )}
                    {(user?.role === 'Admin' || user?.role === 'Team Lead') && (
                        <>
                            <NavItem to="/admin/clients" active={location.pathname === '/admin/clients'}><Users size={20} /> Clients</NavItem>
                        </>
                    )}
                </nav>
                <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <button 
                        className="logout-btn"
                        onClick={handleLogoutClick}
                    >
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </aside>

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
                <UserHeader user={user} title={`${user?.role?.replace('_', ' ')} Overview`} onToggleSidebar={isMobile ? () => setIsSidebarOpen(!isSidebarOpen) : null} />
                <section style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {(user?.role === 'Field Executive' || user?.role === 'Call Executive') && (
                        <div className="glass-card" style={{ padding: '15px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ padding: '8px', background: isOnline ? '#dcfce7' : '#f1f5f9', borderRadius: '10px', color: isOnline ? '#10b981' : '#94a3b8' }}>
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Availability Status</h4>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Turn online to record activity and share location</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isOnline ? '#10b981' : '#64748b' }}>
                                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                                <div
                                    onClick={toggleStatus}
                                    style={{
                                        width: '44px',
                                        height: '22px',
                                        background: isOnline ? '#10b981' : '#cbd5e1',
                                        borderRadius: '22px',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: '0.3s'
                                    }}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        background: 'white',
                                        borderRadius: '50%',
                                        position: 'absolute',
                                        top: '3px',
                                        left: isOnline ? '25px' : '3px',
                                        transition: '0.3s'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}
                    {(user?.role === 'Admin' || user?.role === 'Team Lead') && (
                        <div className="glass-card" style={{
                            padding: '16px 24px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            flexWrap: 'wrap',
                            gap: '15px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Calendar size={20} color="#6366f1" />
                                <span style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>Filter Dashboard Data</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>From:</label>
                                    <div style={{ position: 'relative', width: '160px' }}>
                                        <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                        <input
                                            type="date"
                                            className="input-field"
                                            title="From Date"
                                            max={endDate || undefined}
                                            style={{ padding: '8px 8px 8px 30px', width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}
                                            value={startDate}
                                            onChange={e => handleStartDateChange(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>To:</label>
                                    <div style={{ position: 'relative', width: '160px' }}>
                                        <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                        <input
                                            type="date"
                                            className="input-field"
                                            title="To Date"
                                            min={startDate || undefined}
                                            style={{ padding: '8px 8px 8px 30px', width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}
                                            value={endDate}
                                            onChange={e => handleEndDateChange(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {isCallExecutive ? (
                        <div className="call-executive-dashboard fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Section 1: Conversion Tracking & Overview */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Award size={20} color="#6366f1" />
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#1e293b' }}>
                                            Conversion & Lead Tracking
                                        </h3>
                                    </div>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        Real-time verified conversion & lead records
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                                    {/* Monthly Conversions */}
                                    <div className="glass-card" style={convCardStyle('#10b981', '#ecfdf5', '#a7f3d0')}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: '#065f46' }}>Monthly Conversions</p>
                                                <span style={{ fontSize: '0.7rem', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}>
                                                    {new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div style={{ padding: '8px', background: '#d1fae5', borderRadius: '10px', color: '#10b981' }}>
                                                <TrendingUp size={20} />
                                            </div>
                                        </div>
                                        <h2 style={{ fontSize: '2rem', margin: '14px 0 0 0', color: '#047857', fontWeight: '800' }}>
                                            {loading ? '...' : (overview?.stats?.monthlyConversions ?? 0)}
                                        </h2>
                                    </div>

                                    {/* Lifetime Conversions */}
                                    <div className="glass-card" style={convCardStyle('#6366f1', '#eef2ff', '#c7d2fe')}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: '#3730a3' }}>Lifetime Conversions</p>
                                                <span style={{ fontSize: '0.7rem', color: '#4f46e5', background: '#e0e7ff', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}>
                                                    All-Time
                                                </span>
                                            </div>
                                            <div style={{ padding: '8px', background: '#e0e7ff', borderRadius: '10px', color: '#6366f1' }}>
                                                <Award size={20} />
                                            </div>
                                        </div>
                                        <h2 style={{ fontSize: '2rem', margin: '14px 0 0 0', color: '#4338ca', fontWeight: '800' }}>
                                            {loading ? '...' : (overview?.stats?.lifetimeConversions ?? overview?.stats?.conversions ?? 0)}
                                        </h2>
                                    </div>

                                    {/* Total Leads */}
                                    <div 
                                        className="glass-card" 
                                        onClick={() => navigate('/leads', { state: { categoryFilter: 'all' } })}
                                        style={{ ...convCardStyle('#3b82f6', '#eff6ff', '#bfdbfe'), cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: '#1e40af' }}>Total Leads</p>
                                                <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '700', display: 'inline-block', marginTop: '4px' }}>
                                                    View list →
                                                </span>
                                            </div>
                                            <div style={{ padding: '8px', background: '#dbeafe', borderRadius: '10px', color: '#3b82f6' }}>
                                                <Users size={20} />
                                            </div>
                                        </div>
                                        <h2 style={{ fontSize: '2rem', margin: '14px 0 0 0', color: '#1d4ed8', fontWeight: '800' }}>
                                            {loading ? '...' : (overview?.stats?.totalLeads ?? 0)}
                                        </h2>
                                    </div>

                                    {/* Pending Leads */}
                                    <div 
                                        className="glass-card" 
                                        onClick={() => navigate('/leads', { state: { categoryFilter: 'pending' } })}
                                        style={{ ...convCardStyle('#f59e0b', '#fffbeb', '#fde68a'), cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: '#92400e' }}>Pending Leads</p>
                                                <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '700', display: 'inline-block', marginTop: '4px' }}>
                                                    View list →
                                                </span>
                                            </div>
                                            <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '10px', color: '#f59e0b' }}>
                                                <Clock size={20} />
                                            </div>
                                        </div>
                                        <h2 style={{ fontSize: '2rem', margin: '14px 0 0 0', color: '#b45309', fontWeight: '800' }}>
                                            {loading ? '...' : (overview?.stats?.pending ?? 0)}
                                        </h2>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Daily Call Tracking */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div className="glass-card" style={{
                                    padding: '14px 20px',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '14px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '8px', background: '#e0e7ff', borderRadius: '10px', color: '#6366f1' }}>
                                            <PhoneCall size={20} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
                                                    Daily Call Tracking
                                                </h4>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '700',
                                                    color: '#059669',
                                                    background: '#d1fae5',
                                                    padding: '2px 8px',
                                                    borderRadius: '10px'
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                                    Real-Time
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
                                                {callDate === new Date().toISOString().split('T')[0] 
                                                    ? "Showing today's call records and status counts" 
                                                    : `Showing records for ${callDate.split('-').reverse().join('-')}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <label style={{ fontSize: '0.84rem', fontWeight: '600', color: '#475569' }}>Date:</label>
                                            <div style={{ position: 'relative', width: '160px' }}>
                                                <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                                <input
                                                    type="date"
                                                    className="input-field"
                                                    style={{ padding: '8px 8px 8px 30px', width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem' }}
                                                    value={callDate}
                                                    onChange={e => {
                                                        setCallDate(e.target.value);
                                                        setCallPage(1);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {callDate !== new Date().toISOString().split('T')[0] && (
                                            <button
                                                onClick={() => {
                                                    setCallDate(new Date().toISOString().split('T')[0]);
                                                    setCallPage(1);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 12px',
                                                    background: '#e0e7ff',
                                                    color: '#4f46e5',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <RotateCcw size={14} /> Today
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setShowAllStatuses(!showAllStatuses)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 12px',
                                                background: showAllStatuses ? '#f1f5f9' : '#ffffff',
                                                color: '#475569',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Filter size={14} /> {showAllStatuses ? 'Show Active Only' : 'Show All Statuses'}
                                        </button>
                                    </div>
                                </div>

                                {/* Call Stats Cards Grid (Reduced Size / Good UI) */}
                                <div className="call-stats-grid">
                                    {/* Primary Highlighted Card: Total Calls Made */}
                                    <div
                                        className="glass-card"
                                        style={{
                                            background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
                                            border: '2px solid #818cf8',
                                            borderRadius: '14px',
                                            padding: '16px 18px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.12)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#4338ca' }}>
                                                Total Calls Made
                                            </span>
                                            <PhoneCall size={16} color="#6366f1" />
                                        </div>
                                        <h2 style={{ fontSize: '2rem', margin: '10px 0 4px 0', color: '#3730a3', fontWeight: '900' }}>
                                            {loading ? '...' : (overview?.stats?.totalCallsMade ?? overview?.stats?.totalCalls ?? 0)}
                                        </h2>
                                        <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: '600' }}>
                                            Actual calls logged
                                        </span>
                                    </div>

                                    {/* Dynamic and Standard Status Cards */}
                                    {visibleCallCards.map((card, idx) => (
                                        <div
                                            key={idx}
                                            className="glass-card"
                                            style={{
                                                background: 'white',
                                                border: `1px solid ${card.count > 0 ? card.border : '#e2e8f0'}`,
                                                borderLeft: `4px solid ${card.color}`,
                                                borderRadius: '14px',
                                                padding: '16px 18px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                opacity: card.count === 0 ? 0.75 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', lineHeight: '1.2' }}>
                                                    {card.label}
                                                </span>
                                                {card.count > 0 && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: card.color, flexShrink: 0, marginTop: '4px' }} />
                                                )}
                                            </div>
                                            <h2 style={{ fontSize: '1.8rem', margin: '8px 0 0 0', color: card.count > 0 ? card.color : '#94a3b8', fontWeight: '800' }}>
                                                {loading ? '...' : card.count}
                                            </h2>
                                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '500', marginTop: '4px' }}>
                                                {card.count === 1 ? '1 call' : `${card.count} calls`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: Call Records for Selected Date */}
                            <div className="glass-card" style={{
                                background: 'white',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '14px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <List size={18} color="#6366f1" />
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>
                                            Call History on {callDate.split('-').reverse().join('-')}
                                        </h4>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                            {callRecords.length} records
                                        </span>
                                    </div>
                                </div>

                                {callRecords.length === 0 ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                                        No calls recorded on {callDate.split('-').reverse().join('-')}.
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                                                    <th style={{ padding: '10px 12px' }}>#</th>
                                                    <th style={{ padding: '10px 12px' }}>Time</th>
                                                    <th style={{ padding: '10px 12px' }}>Lead Name</th>
                                                    <th style={{ padding: '10px 12px' }}>Company</th>
                                                    <th style={{ padding: '10px 12px' }}>Phone</th>
                                                    <th style={{ padding: '10px 12px' }}>Call Status</th>
                                                    <th style={{ padding: '10px 12px' }}>Call Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedRecords.map((r, i) => (
                                                    <tr key={r.HistoryID || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{(callPage - 1) * CALLS_PER_PAGE + i + 1}</td>
                                                        <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                            {r.CreatedAt ? new Date(r.CreatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>
                                                            <Link to={`/leads?search=${encodeURIComponent(r.FullName || '')}`} style={{ color: '#6366f1', textDecoration: 'none' }}>
                                                                {r.FullName || 'Unknown'}
                                                            </Link>
                                                        </td>
                                                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.CompanyName || '-'}</td>
                                                        <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{r.Phone || '-'}</td>
                                                        <td style={{ padding: '10px 12px' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '3px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '700',
                                                                background: getBadgeColor(r.Status).bg,
                                                                color: getBadgeColor(r.Status).text
                                                            }}>
                                                                {r.Status || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '300px' }}>
                                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.CallNote}>
                                                                {r.CallNote || 'No notes'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {totalPages > 1 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    Showing {(callPage - 1) * CALLS_PER_PAGE + 1} to {Math.min(callPage * CALLS_PER_PAGE, callRecords.length)} of {callRecords.length}
                                                </span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        disabled={callPage === 1}
                                                        onClick={() => setCallPage(p => Math.max(1, p - 1))}
                                                        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: callPage === 1 ? 'not-allowed' : 'pointer', opacity: callPage === 1 ? 0.5 : 1 }}
                                                    >
                                                        Previous
                                                    </button>
                                                    <button
                                                        disabled={callPage >= totalPages}
                                                        onClick={() => setCallPage(p => Math.min(totalPages, p + 1))}
                                                        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: callPage >= totalPages ? 'not-allowed' : 'pointer', opacity: callPage >= totalPages ? 0.5 : 1 }}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section 4: Leads List – Separate Categories (New Leads & Follow-up Leads) */}
                            <div id="ce-leads-list-section" className="glass-card" style={{
                                background: 'white',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                padding: '22px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}>
                                {/* Section Header & Controls */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '10px', background: '#e0e7ff', borderRadius: '12px', color: '#6366f1' }}>
                                            <List size={22} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>
                                                    Leads List
                                                </h3>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: '700',
                                                    color: '#059669',
                                                    background: '#d1fae5',
                                                    padding: '2px 8px',
                                                    borderRadius: '10px'
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                                    Real-Time
                                                </span>
                                            </div>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                                {ceLeadsCategory === 'new'
                                                    ? 'Newly created and assigned leads available for outreach'
                                                    : 'Leads scheduled for follow-up based on interaction history'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Category Filter Switcher Tabs */}
                                    <div style={{
                                        display: 'flex',
                                        background: '#f1f5f9',
                                        padding: '4px',
                                        borderRadius: '12px',
                                        gap: '6px'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCeLeadsCategory('new');
                                                setCeLeadsPage(1);
                                            }}
                                            style={{
                                                padding: '8px 18px',
                                                borderRadius: '9px',
                                                border: 'none',
                                                background: ceLeadsCategory === 'new' ? 'white' : 'transparent',
                                                color: ceLeadsCategory === 'new' ? '#4f46e5' : '#64748b',
                                                fontWeight: '800',
                                                fontSize: '0.84rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                boxShadow: ceLeadsCategory === 'new' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <UserCheck size={16} />
                                            <span>New Leads</span>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                padding: '2px 7px',
                                                borderRadius: '10px',
                                                background: ceLeadsCategory === 'new' ? '#e0e7ff' : '#e2e8f0',
                                                color: ceLeadsCategory === 'new' ? '#4338ca' : '#64748b'
                                            }}>
                                                {ceNewLeads.length}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCeLeadsCategory('followup');
                                                setCeLeadsPage(1);
                                            }}
                                            style={{
                                                padding: '8px 18px',
                                                borderRadius: '9px',
                                                border: 'none',
                                                background: ceLeadsCategory === 'followup' ? 'white' : 'transparent',
                                                color: ceLeadsCategory === 'followup' ? '#d97706' : '#64748b',
                                                fontWeight: '800',
                                                fontSize: '0.84rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                boxShadow: ceLeadsCategory === 'followup' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <Clock size={16} />
                                            <span>Follow-up Leads</span>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                padding: '2px 7px',
                                                borderRadius: '10px',
                                                background: ceLeadsCategory === 'followup' ? '#fef3c7' : '#e2e8f0',
                                                color: ceLeadsCategory === 'followup' ? '#b45309' : '#64748b'
                                            }}>
                                                {ceFollowupLeads.length}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Independent Date Range Filter Bar for New Leads & Follow-up Leads */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    padding: '10px 14px',
                                    background: '#f8fafc',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.8rem', fontWeight: '700' }}>
                                            <Calendar size={14} color="#6366f1" />
                                            <span>{ceLeadsCategory === 'new' ? 'Creation Date:' : 'Follow-up Date:'}</span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="date"
                                                className="input-field"
                                                title={`From Date (${ceLeadsCategory === 'new' ? 'New Leads' : 'Follow-up Leads'})`}
                                                placeholder="From Date"
                                                max={activeCeRange.to || undefined}
                                                style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                                                value={activeCeRange.from}
                                                onChange={e => handleCeFromDateChange(e.target.value)}
                                            />
                                        </div>
                                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>–</span>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="date"
                                                className="input-field"
                                                title={`To Date (${ceLeadsCategory === 'new' ? 'New Leads' : 'Follow-up Leads'})`}
                                                placeholder="To Date"
                                                min={activeCeRange.from || undefined}
                                                max={activeCeRange.from ? addDaysToDate(activeCeRange.from, 31) : undefined}
                                                style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                                                value={activeCeRange.to}
                                                onChange={e => handleCeToDateChange(e.target.value)}
                                            />
                                        </div>
                                        {(activeCeRange.from || activeCeRange.to) && (
                                            <button
                                                type="button"
                                                onClick={handleCeClearDates}
                                                title="Remove custom date range and return to today's records"
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e1',
                                                    background: 'white',
                                                    color: '#dc2626',
                                                    fontSize: '0.78rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <X size={13} /> Clear
                                            </button>
                                        )}
                                        {ceDateRangeError && (
                                            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '600' }}>
                                                {ceDateRangeError}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/leads', { state: { categoryFilter: ceLeadsCategory, fromDate: activeCeRange.from, toDate: activeCeRange.to } })}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #c7d2fe',
                                                background: '#e0e7ff',
                                                color: '#4338ca',
                                                fontSize: '0.78rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            <Eye size={13} /> Full Lead Database
                                        </button>
                                    </div>
                                </div>

                                {/* Search Bar & Count Summary */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
                                        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder={`Search ${ceLeadsCategory === 'new' ? 'New Leads' : 'Follow-up Leads'} by name, phone, company...`}
                                            style={{ padding: '8px 10px 8px 34px', width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.82rem' }}
                                            value={ceLeadsSearch}
                                            onChange={e => {
                                                setCeLeadsSearch(e.target.value);
                                                setCeLeadsPage(1);
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>
                                            Showing {activeCategoryLeads.length} {ceLeadsCategory === 'new' ? 'new leads' : 'follow-up leads'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => fetchCeLeads()}
                                            disabled={loadingCeLeads}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                background: 'white',
                                                color: '#475569',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            <RefreshCw size={13} className={loadingCeLeads ? 'spin' : ''} /> Refresh
                                        </button>
                                    </div>
                                </div>

                                {/* Category Table */}
                                {loadingCeLeads && ceLeads.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                        <Loader className="spin" size={24} style={{ margin: '0 auto 10px auto' }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading leads...</p>
                                    </div>
                                ) : activeCategoryLeads.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#64748b' }}>
                                            {ceLeadsCategory === 'new' ? 'No new leads found.' : 'No follow-up leads scheduled.'}
                                        </p>
                                        <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem' }}>
                                            {ceLeadsSearch ? 'Try adjusting your search criteria.' : (ceLeadsCategory === 'new' ? 'Newly created or assigned leads will appear here automatically.' : 'Leads marked with Follow-up status will appear here automatically.')}
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                                                    <th style={{ padding: '10px 12px' }}>#</th>
                                                    <th style={{ padding: '10px 12px' }}>Lead Name</th>
                                                    <th style={{ padding: '10px 12px' }}>Contact Number</th>
                                                    <th style={{ padding: '10px 12px' }}>Company</th>
                                                    {ceLeadsCategory === 'followup' ? (
                                                        <>
                                                            <th style={{ padding: '10px 12px' }}>Follow-up Date & Time</th>
                                                            <th style={{ padding: '10px 12px' }}>Current Status</th>
                                                            <th style={{ padding: '10px 12px' }}>Last Call Note</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th style={{ padding: '10px 12px' }}>Status</th>
                                                            <th style={{ padding: '10px 12px' }}>Service Interested</th>
                                                            <th style={{ padding: '10px 12px' }}>Created Date</th>
                                                        </>
                                                    )}
                                                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedCeLeads.map((lead, idx) => {
                                                    const badge = getBadgeColor(lead.Status);
                                                    const fDateStr = ceLeadsCategory === 'followup' 
                                                        ? (getLocalDateStr(lead.FollowupDate) || getLocalDateStr(lead.MeetingFollowupDate) || getLocalDateStr(lead.UpdatedAt))
                                                        : '';
                                                    const isOverdue = ceLeadsCategory === 'followup' && Boolean(fDateStr && fDateStr < todayStr);
                                                    const isToday = ceLeadsCategory === 'followup' && Boolean(fDateStr && fDateStr === todayStr);
                                                    const isUpcoming = ceLeadsCategory === 'followup' && Boolean(fDateStr && fDateStr > todayStr);

                                                    return (
                                                        <tr 
                                                            key={lead.LeadID || idx} 
                                                            style={{ 
                                                                borderBottom: '1px solid #f1f5f9',
                                                                background: isOverdue ? 'rgba(254, 242, 242, 0.45)' : (isToday ? 'rgba(240, 253, 244, 0.35)' : 'transparent'),
                                                                transition: 'background 0.2s ease'
                                                            }}
                                                        >
                                                            <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                                                                {(ceLeadsPage - 1) * CE_LEADS_PER_PAGE + idx + 1}
                                                            </td>
                                                            <td style={{ padding: '10px 12px' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/leads/call-manage/${lead.LeadID}`, { state: { from: '/dashboard', label: 'Dashboard' } })}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        padding: 0,
                                                                        color: '#4f46e5',
                                                                        fontWeight: '700',
                                                                        fontSize: '0.85rem',
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left'
                                                                    }}
                                                                >
                                                                    {lead.FullName || 'Unknown Lead'}
                                                                </button>
                                                                {lead.Email && (
                                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                                                        {lead.Email}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}>
                                                                    <Phone size={13} color="#6366f1" />
                                                                    <span>{lead.Phone || '-'}</span>
                                                                </div>
                                                                {lead.AlternatePhone && (
                                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '19px' }}>
                                                                        Alt: {lead.AlternatePhone}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '10px 12px', color: '#475569' }}>
                                                                {lead.CompanyName || lead.SpecificCompanyName || '-'}
                                                            </td>

                                                            {ceLeadsCategory === 'followup' ? (
                                                                <>
                                                                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                                                        {lead.FollowupDate ? (
                                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                                                                                <span style={{
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '5px',
                                                                                    padding: '3px 8px',
                                                                                    background: isOverdue ? '#fee2e2' : (isToday ? '#dcfce7' : '#eff6ff'),
                                                                                    color: isOverdue ? '#991b1b' : (isToday ? '#166534' : '#1e40af'),
                                                                                    border: isOverdue ? '1px solid #fecaca' : (isToday ? '1px solid #bbf7d0' : '1px solid #bfdbfe'),
                                                                                    borderRadius: '6px',
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: '700'
                                                                                }}>
                                                                                    <Calendar size={12} />
                                                                                    {new Date(lead.FollowupDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                    {lead.FollowupTime && (
                                                                                        <span style={{ marginLeft: '4px', fontWeight: '800' }}>• {lead.FollowupTime}</span>
                                                                                    )}
                                                                                </span>
                                                                                {isOverdue && (
                                                                                    <span style={{
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '3px',
                                                                                        padding: '2px 7px',
                                                                                        background: '#ef4444',
                                                                                        color: '#ffffff',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '0.68rem',
                                                                                        fontWeight: '800',
                                                                                        letterSpacing: '0.4px',
                                                                                        textTransform: 'uppercase',
                                                                                        boxShadow: '0 1px 2px rgba(239, 68, 68, 0.25)'
                                                                                    }}>
                                                                                        <AlertCircle size={10} /> Overdue
                                                                                    </span>
                                                                                )}
                                                                                {isToday && (
                                                                                    <span style={{
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        padding: '2px 7px',
                                                                                        background: '#16a34a',
                                                                                        color: '#ffffff',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '0.68rem',
                                                                                        fontWeight: '800',
                                                                                        letterSpacing: '0.4px',
                                                                                        textTransform: 'uppercase'
                                                                                    }}>
                                                                                        Today
                                                                                    </span>
                                                                                )}
                                                                                {isUpcoming && (
                                                                                    <span style={{
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        padding: '2px 7px',
                                                                                        background: '#3b82f6',
                                                                                        color: '#ffffff',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '0.68rem',
                                                                                        fontWeight: '800',
                                                                                        letterSpacing: '0.4px',
                                                                                        textTransform: 'uppercase'
                                                                                    }}>
                                                                                        Upcoming
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No date set</span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px' }}>
                                                                        <span style={{
                                                                            display: 'inline-block',
                                                                            padding: '3px 8px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: '700',
                                                                            background: badge.bg,
                                                                            color: badge.text
                                                                        }}>
                                                                            {lead.Status || 'Follow-up'}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '240px' }}>
                                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.CallNote}>
                                                                            {lead.CallNote || 'No notes'}
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td style={{ padding: '10px 12px' }}>
                                                                        <span style={{
                                                                            display: 'inline-block',
                                                                            padding: '3px 8px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: '700',
                                                                            background: badge.bg,
                                                                            color: badge.text
                                                                        }}>
                                                                            {lead.Status || 'New'}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                                                        {lead.ServiceInterested || '-'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                                        {lead.CreatedAt ? new Date(lead.CreatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                                    </td>
                                                                </>
                                                            )}

                                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/leads/call-manage/${lead.LeadID}`, { state: { from: '/dashboard', label: 'Dashboard' } })}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '5px',
                                                                        padding: '6px 12px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: '700',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #c7d2fe',
                                                                        background: '#eef2ff',
                                                                        color: '#4f46e5',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <PhoneCall size={12} /> Call / Manage →
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* Pagination Controls */}
                                        {totalCeLeadsPages > 1 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    Showing {(ceLeadsPage - 1) * CE_LEADS_PER_PAGE + 1} to {Math.min(ceLeadsPage * CE_LEADS_PER_PAGE, activeCategoryLeads.length)} of {activeCategoryLeads.length} leads
                                                </span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        disabled={ceLeadsPage === 1}
                                                        onClick={() => setCeLeadsPage(p => Math.max(1, p - 1))}
                                                        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: ceLeadsPage === 1 ? 'not-allowed' : 'pointer', opacity: ceLeadsPage === 1 ? 0.5 : 1 }}
                                                    >
                                                        Previous
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={ceLeadsPage >= totalCeLeadsPages}
                                                        onClick={() => setCeLeadsPage(p => Math.min(totalCeLeadsPages, p + 1))}
                                                        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: ceLeadsPage >= totalCeLeadsPages ? 'not-allowed' : 'pointer', opacity: ceLeadsPage >= totalCeLeadsPages ? 0.5 : 1 }}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="dashboard-stats-grid">
                            {statsConfig.map((stat, i) => {
                                const isClickable = Boolean(stat.filter && !isTL);
                                const isCallTrackingClickable = stat.isCallCard && (user?.role === 'Admin' || user?.role === 'Team Lead');
                                return (
                                    <div 
                                        key={i} 
                                        className="glass-card" 
                                        onClick={() => {
                                            if (isClickable) {
                                                const isFE = user?.role === 'Field Executive' || user?.Role === 'Field Executive';
                                                const targetPath = isFE ? '/leads/my-created' : '/leads';
                                                navigate(targetPath, { 
                                                    state: { 
                                                        categoryFilter: stat.filter
                                                    } 
                                                });
                                            } else if (isCallTrackingClickable) {
                                                const el = document.getElementById('team-call-tracking-section');
                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                            }
                                        }}
                                        style={{ 
                                            background: 'white', 
                                            padding: '24px', 
                                            borderRadius: '16px', 
                                            border: '1px solid #e2e8f0', 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            justifyContent: 'space-between', 
                                            position: 'relative',
                                            cursor: (isClickable || isCallTrackingClickable) ? 'pointer' : 'default',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={e => {
                                            if (isClickable) {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (isClickable) {
                                                e.currentTarget.style.transform = 'none';
                                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>{stat.label}</p>
                                            {isClickable && (
                                                <span style={{ fontSize: '0.75rem', color: stat.color, fontWeight: '700' }}>
                                                    View list →
                                                </span>
                                            )}
                                            {isCallTrackingClickable && (
                                                <span style={{ fontSize: '0.75rem', color: stat.color, fontWeight: '700' }}>
                                                    Track calls ↓
                                                </span>
                                            )}
                                        </div>
                                    <h2 style={{ fontSize: '2.2rem', marginTop: '12px', color: stat.color, marginBottom: 0 }}>
                                        {loading ? '...' : (stat.isCurrency ? `₹${(overview?.stats?.[stat.key] || 0).toLocaleString()}` : (overview?.stats?.[stat.key] || 0))}
                                    </h2>
                                    {stat.isCallCard && !loading && (
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', borderRadius: '8px', padding: '4px 10px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }}></span>
                                                <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: '600' }}>CE: {overview?.stats?.ceCallsToday ?? 0}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', borderRadius: '8px', padding: '4px 10px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', flexShrink: 0 }}></span>
                                                <span style={{ fontSize: '0.75rem', color: '#3730a3', fontWeight: '600' }}>TL: {overview?.stats?.tlCallsToday ?? 0}</span>
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Section C: Real-Time Call Tracking & Performance for Team Lead and Admin */}
                    {(user?.role === 'Admin' || user?.role === 'Team Lead') && (
                        <div id="team-call-tracking-section" className="team-call-tracking-section fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px', marginBottom: '30px' }}>
                            {/* Section Header & Filter Controls */}
                            <div className="glass-card" style={{
                                padding: '18px 24px',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ padding: '10px', background: '#e0e7ff', borderRadius: '12px', color: '#6366f1' }}>
                                        <PhoneCall size={22} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#1e293b' }}>
                                                Real-Time Call Activity & Performance Tracking
                                            </h3>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                fontSize: '0.72rem',
                                                fontWeight: '700',
                                                color: '#059669',
                                                background: '#d1fae5',
                                                padding: '3px 10px',
                                                borderRadius: '12px'
                                            }}>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                                Live Real-Time
                                            </span>
                                        </div>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                            {adminCeFilter === 'all'
                                                ? `Monitoring combined team call activity for ${adminCallDate.split('-').reverse().join('-')}`
                                                : `Monitoring call performance for ${overview?.executivesList?.find(e => String(e.UserID) === String(adminCeFilter))?.FullName || 'selected executive'} on ${adminCallDate.split('-').reverse().join('-')}`
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* Filter Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                    {/* Executive Selector */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Executive:</label>
                                        <select
                                            className="input-field"
                                            value={adminCeFilter}
                                            onChange={e => {
                                                setAdminCeFilter(e.target.value);
                                                setTeamCallPage(1);
                                            }}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.84rem',
                                                fontWeight: '600',
                                                color: '#1e293b',
                                                background: '#f8fafc',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="all">👥 All Call Executives (Team)</option>
                                            {(overview?.executivesList || []).map(exec => (
                                                <option key={exec.UserID} value={exec.UserID}>
                                                    👤 {exec.FullName} ({exec.EmployeeID || 'CE'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Date Picker */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Date:</label>
                                        <div style={{ position: 'relative', width: '150px' }}>
                                            <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                            <input
                                                type="date"
                                                className="input-field"
                                                style={{ padding: '8px 8px 8px 30px', width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.84rem' }}
                                                value={adminCallDate}
                                                onChange={e => {
                                                    setAdminCallDate(e.target.value);
                                                    setTeamCallPage(1);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Quick Today Button */}
                                    {adminCallDate !== new Date().toISOString().split('T')[0] && (
                                        <button
                                            onClick={() => {
                                                setAdminCallDate(new Date().toISOString().split('T')[0]);
                                                setTeamCallPage(1);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 12px',
                                                background: '#e0e7ff',
                                                color: '#4f46e5',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <RotateCcw size={14} /> Today
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* View Tabs & Status Filter */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '12px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    background: '#f1f5f9',
                                    padding: '4px',
                                    borderRadius: '10px',
                                    gap: '4px',
                                    width: 'fit-content'
                                }}>
                                    <button
                                        onClick={() => setCallTrackingTab('overview')}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: callTrackingTab === 'overview' ? 'white' : 'transparent',
                                            color: callTrackingTab === 'overview' ? '#4f46e5' : '#64748b',
                                            fontWeight: '700',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            boxShadow: callTrackingTab === 'overview' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <BarChart3 size={15} /> Call Status Breakdown
                                    </button>
                                    <button
                                        onClick={() => setCallTrackingTab('comparison')}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: callTrackingTab === 'comparison' ? 'white' : 'transparent',
                                            color: callTrackingTab === 'comparison' ? '#4f46e5' : '#64748b',
                                            fontWeight: '700',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            boxShadow: callTrackingTab === 'comparison' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <Users size={15} /> Executive Comparison
                                    </button>
                                    <button
                                        onClick={() => setCallTrackingTab('activity')}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: callTrackingTab === 'activity' ? 'white' : 'transparent',
                                            color: callTrackingTab === 'activity' ? '#4f46e5' : '#64748b',
                                            fontWeight: '700',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            boxShadow: callTrackingTab === 'activity' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <List size={15} /> Live Call Activity Log ({filteredTeamCallRecords.length})
                                    </button>
                                </div>

                                {callTrackingTab === 'overview' && (
                                    <button
                                        onClick={() => setShowAllTeamStatuses(!showAllTeamStatuses)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '7px 12px',
                                            background: showAllTeamStatuses ? '#e2e8f0' : '#ffffff',
                                            color: '#475569',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Filter size={14} /> {showAllTeamStatuses ? 'Show Active Only' : 'Show All Statuses'}
                                    </button>
                                )}
                            </div>

                            {/* Tab 1: Call Status Breakdown Cards */}
                            {callTrackingTab === 'overview' && (
                                <div className="call-stats-grid">
                                    {/* Total Calls Made Card */}
                                    <div
                                        className="glass-card"
                                        style={{
                                            background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
                                            border: '2px solid #818cf8',
                                            borderRadius: '14px',
                                            padding: '16px 18px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.12)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#4338ca' }}>
                                                {adminCeFilter === 'all' ? 'Team Total Calls Made' : 'Total Calls Made'}
                                            </span>
                                            <PhoneCall size={16} color="#6366f1" />
                                        </div>
                                        <h2 style={{ fontSize: '2rem', margin: '10px 0 4px 0', color: '#3730a3', fontWeight: '900' }}>
                                            {loading ? '...' : (overview?.stats?.totalCallsMade ?? 0)}
                                        </h2>
                                        <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: '600' }}>
                                            {adminCeFilter === 'all' ? 'Across all Call Executives' : 'By selected executive'}
                                        </span>
                                    </div>

                                    {/* Dynamic and Standard Status Cards */}
                                    {visibleTeamCallCards.map((card, idx) => (
                                        <div
                                            key={idx}
                                            className="glass-card"
                                            style={{
                                                background: 'white',
                                                border: `1px solid ${card.count > 0 ? card.border : '#e2e8f0'}`,
                                                borderLeft: `4px solid ${card.color}`,
                                                borderRadius: '14px',
                                                padding: '16px 18px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                opacity: card.count === 0 ? 0.75 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', lineHeight: '1.2' }}>
                                                    {card.label}
                                                </span>
                                                {card.count > 0 && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: card.color, flexShrink: 0, marginTop: '4px' }} />
                                                )}
                                            </div>
                                            <h2 style={{ fontSize: '1.8rem', margin: '8px 0 0 0', color: card.count > 0 ? card.color : '#94a3b8', fontWeight: '800' }}>
                                                {loading ? '...' : card.count}
                                            </h2>
                                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '500', marginTop: '4px' }}>
                                                {card.count === 1 ? '1 call' : `${card.count} calls`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tab 2: Individual Executive Performance Comparison Matrix */}
                            {callTrackingTab === 'comparison' && (
                                <div className="glass-card" style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '14px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Users size={18} color="#6366f1" />
                                            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: '#1e293b' }}>
                                                Call Executive Performance Comparison Matrix
                                            </h4>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            Date: {adminCallDate.split('-').reverse().join('-')}
                                        </span>
                                    </div>

                                    {(overview?.teamExecutivePerformance || []).length === 0 ? (
                                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                                            No Call Executive records found.
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                                                        <th style={{ padding: '10px 14px' }}>Executive</th>
                                                        <th style={{ padding: '10px 14px' }}>Status</th>
                                                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Total Calls</th>
                                                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Interested</th>
                                                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Follow-ups</th>
                                                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Not Interested</th>
                                                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Other Statuses</th>
                                                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(overview?.teamExecutivePerformance || []).map((exec) => (
                                                        <tr key={exec.UserID} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '12px 14px' }}>
                                                                <div style={{ fontWeight: '700', color: '#1e293b' }}>{exec.EmployeeName}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{exec.EmployeeID || 'ID: ' + exec.UserID}</div>
                                                            </td>
                                                            <td style={{ padding: '12px 14px' }}>
                                                                <span style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: '700',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '10px',
                                                                    background: exec.IsOnline ? '#dcfce7' : '#f1f5f9',
                                                                    color: exec.IsOnline ? '#15803d' : '#64748b'
                                                                }}>
                                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: exec.IsOnline ? '#10b981' : '#94a3b8' }} />
                                                                    {exec.IsOnline ? 'Online' : 'Offline'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                <span style={{ fontWeight: '800', fontSize: '1rem', color: '#4338ca' }}>
                                                                    {exec.totalCalls}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                <span style={{ fontWeight: '700', color: '#10b981' }}>{exec.interested}</span>
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                <span style={{ fontWeight: '700', color: '#f59e0b' }}>{exec.followups}</span>
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                <span style={{ fontWeight: '700', color: '#ef4444' }}>{exec.notInterested}</span>
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>
                                                                {exec.other}
                                                            </td>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        setAdminCeFilter(String(exec.UserID));
                                                                        setCallTrackingTab('overview');
                                                                    }}
                                                                    style={{
                                                                        padding: '5px 12px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: '700',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #c7d2fe',
                                                                        background: '#eef2ff',
                                                                        color: '#4f46e5',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Analyze Performance →
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab 3: Live Call Activity Log */}
                            {callTrackingTab === 'activity' && (
                                <div className="glass-card" style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '14px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <List size={18} color="#6366f1" />
                                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>
                                                Call Activity Stream on {adminCallDate.split('-').reverse().join('-')}
                                            </h4>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                                {filteredTeamCallRecords.length} calls
                                            </span>
                                        </div>

                                        {/* Search Filter */}
                                        <div style={{ position: 'relative', width: '260px' }}>
                                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="Search by executive, lead, phone..."
                                                style={{ padding: '6px 8px 6px 30px', width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem' }}
                                                value={teamCallSearch}
                                                onChange={e => {
                                                    setTeamCallSearch(e.target.value);
                                                    setTeamCallPage(1);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {filteredTeamCallRecords.length === 0 ? (
                                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                                            No calls found for the selected criteria on {adminCallDate.split('-').reverse().join('-')}.
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                                                        <th style={{ padding: '10px 12px' }}>#</th>
                                                        <th style={{ padding: '10px 12px' }}>Time</th>
                                                        <th style={{ padding: '10px 12px' }}>Executive</th>
                                                        <th style={{ padding: '10px 12px' }}>Lead Name</th>
                                                        <th style={{ padding: '10px 12px' }}>Company</th>
                                                        <th style={{ padding: '10px 12px' }}>Phone</th>
                                                        <th style={{ padding: '10px 12px' }}>Call Status</th>
                                                        <th style={{ padding: '10px 12px' }}>Call Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedTeamCallRecords.map((r, i) => (
                                                        <tr key={r.HistoryID || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{(teamCallPage - 1) * TEAM_CALLS_PER_PAGE + i + 1}</td>
                                                            <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                                {r.CreatedAt ? new Date(r.CreatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                                            </td>
                                                            <td style={{ padding: '10px 12px' }}>
                                                                <span style={{ fontWeight: '600', color: '#4f46e5' }}>
                                                                    {r.ExecutiveName || 'Call Executive'}
                                                                </span>
                                                                {r.ExecutiveEmpID && (
                                                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>
                                                                        {r.ExecutiveEmpID}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>
                                                                <Link to={`/leads?search=${encodeURIComponent(r.FullName || '')}`} style={{ color: '#6366f1', textDecoration: 'none' }}>
                                                                    {r.FullName || 'Unknown'}
                                                                </Link>
                                                            </td>
                                                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.CompanyName || '-'}</td>
                                                            <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{r.Phone || '-'}</td>
                                                            <td style={{ padding: '10px 12px' }}>
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    padding: '3px 8px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '700',
                                                                    background: getBadgeColor(r.Status).bg,
                                                                    color: getBadgeColor(r.Status).text
                                                                }}>
                                                                    {r.Status || 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '280px' }}>
                                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.CallNote}>
                                                                    {r.CallNote || 'No notes'}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {totalTeamCallPages > 1 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        Showing {(teamCallPage - 1) * TEAM_CALLS_PER_PAGE + 1} to {Math.min(teamCallPage * TEAM_CALLS_PER_PAGE, filteredTeamCallRecords.length)} of {filteredTeamCallRecords.length}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            disabled={teamCallPage === 1}
                                                            onClick={() => setTeamCallPage(p => Math.max(1, p - 1))}
                                                            style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: teamCallPage === 1 ? 'not-allowed' : 'pointer', opacity: teamCallPage === 1 ? 0.5 : 1 }}
                                                        >
                                                            Previous
                                                        </button>
                                                        <button
                                                            disabled={teamCallPage >= totalTeamCallPages}
                                                            onClick={() => setTeamCallPage(p => Math.min(totalTeamCallPages, p + 1))}
                                                            style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: teamCallPage >= totalTeamCallPages ? 'not-allowed' : 'pointer', opacity: teamCallPage >= totalTeamCallPages ? 0.5 : 1 }}
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(user?.role === 'Admin' || user?.role === 'Team Lead') && (
                        <div style={{ marginTop: '0px', flex: 1, display: 'flex', flexDirection: 'column' }} className="fade-in">                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <TrendingUp size={24} color="#6366f1" />
                                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Analytics & Trends</h2>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', marginRight: '10px' }}>
                                        Range: {startDate.split('-').reverse().join('-')} to {endDate.split('-').reverse().join('-')}
                                    </span>
                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={exporting || loadingCharts || timeData.length === 0}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            fontSize: '0.85rem',
                                            opacity: (exporting || loadingCharts || timeData.length === 0) ? 0.6 : 1
                                        }}
                                    >
                                        {exporting ? <Loader className="spin" size={16} /> : <FileDown size={16} />}
                                        Download Report
                                    </button>
                                </div>
                            </div>
 
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '30px', flex: 1 }}>
                                {/* Leads Distribution Chart */}
                                <div id="lead-chart-export" className="glass-card" style={{ padding: '25px', minHeight: '300px', background: 'white', display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                        <List size={18} color="#6366f1" /> Lead Distribution
                                    </h3>
                                    {loadingCharts ? (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader className="spin" color="#6366f1" /></div>
                                    ) : (
                                        <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ReBarChart data={timeData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis
                                                          dataKey="label"
                                                          axisLine={false}
                                                          tickLine={false}
                                                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                          tickFormatter={(val) => val ? val.split('-').reverse().slice(0, 2).join('/') : ''}
                                                          padding={{ left: 20, right: 20 }}
                                                          interval="preserveStartEnd"
                                                      />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickMargin={10} />
                                                    <ReTooltip
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                        labelFormatter={(label) => label ? label.split('-').reverse().slice(0, 2).join('/') : ''}
                                                    />
                                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                                    <Bar dataKey="interested" name="Interested" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="converted" name="Converted" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="followups" name="Follow-ups" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="notInterested" name="Not Interested" fill="#f87171" radius={[4, 4, 0, 0]} />
                                                     <Bar dataKey="pending" name="Pending" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                                </ReBarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>

                                {/* Revenue Chart */}
                                <div id="financial-chart-export" className="glass-card" style={{ padding: '25px', minHeight: '300px', background: 'white', display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                        <IndianRupee size={18} color="#10b981" /> Financial Trends
                                    </h3>
                                    {loadingCharts ? (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader className="spin" color="#6366f1" /></div>
                                    ) : (
                                        <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={timeData}>
                                                    <defs>
                                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis
                                                          dataKey="label"
                                                          axisLine={false}
                                                          tickLine={false}
                                                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                          tickFormatter={(val) => val ? val.split('-').reverse().slice(0, 2).join('/') : ''}
                                                          padding={{ left: 20, right: 20 }}
                                                          interval="preserveStartEnd"
                                                      />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickMargin={10} />
                                                    <ReTooltip
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                        formatter={(val) => [`₹${val.toLocaleString()}`, '']}
                                                        labelFormatter={(label) => label ? label.split('-').reverse().slice(0, 2).join('/') : ''}
                                                    />
                                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
                                                    <Area type="monotone" dataKey="due" name="Due Amount" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDue)" strokeWidth={3} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* Custom Logout Confirmation Modal */}
            {showLogoutModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }}>
                    <div style={{
                        background: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', padding: '12px', borderRadius: '50%' }}>
                                <LogOut size={28} />
                            </div>
                            <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0 }}>Log Out</h2>
                        </div>
                        
                        {logoutWarning ? (
                            <>
                                <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.5', marginBottom: '24px' }}>
                                    {logoutWarning}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setShowLogoutModal(false)}
                                        style={{ background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        Understood
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.5', marginBottom: '24px' }}>
                                    Are you sure you want to log out of your session?
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setShowLogoutModal(false)}
                                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}
                                        onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                                        onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowLogoutModal(false);
                                            onLogout();
                                            navigate('/');
                                        }}
                                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                                        onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                                        onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                                    >
                                        Yes, Log Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Custom PDF Preview Modal (Capacitor/Tablet/APK) */}
            {window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web' && pdfPreviewUrl && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }}>
                    <div style={{
                        background: 'white', padding: '24px', borderRadius: '24px', width: '90%', maxWidth: '850px', height: '85%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#e0e7ff', color: '#6366f1', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center' }}>
                                    <FileText size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0, fontWeight: '700' }}>Report Preview</h3>
                            </div>
                            <button
                                onClick={() => setPdfPreviewUrl('')}
                                style={{
                                    marginLeft: 'auto', background: '#f1f5f9', color: '#64748b', border: 'none',
                                    width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold'
                                }}
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div style={{ flex: 1, width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <iframe
                                src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfPreviewUrl)}`}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="PDF Report Preview"
                            />
                        </div>                         <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                            <button
                                onClick={() => setPdfPreviewUrl('')}
                                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await Browser.open({ url: pdfPreviewUrl });
                                    } catch (err) {
                                        window.open(pdfPreviewUrl, '_blank');
                                    }
                                }}
                                style={{ background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Download size={16} /> Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const navStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', color: '#64748b', textDecoration: 'none', borderRadius: '12px', transition: '0.2s' };
const navActiveStyle = { ...navStyle, color: 'white', background: '#6366f1' };

export default Dashboard;
