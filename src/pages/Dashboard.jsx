import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, UserPlus, List, Settings, LogOut, Loader, AlertCircle, BarChart, Calendar, Clock, FileText, CreditCard, Navigation, Activity, Users, TrendingUp, IndianRupee, Download, FileDown, MessageSquare, CheckCircle, PhoneCall, RotateCcw, Filter, Award, CheckCircle2, XCircle } from 'lucide-react';
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

    const fetchOverview = useCallback(async (selectedCallDate, startD, endD) => {
        setLoading(true);
        setError('');
        try {
            const dateParam = selectedCallDate || new Date().toISOString().split('T')[0];
            let url = `${API_URL}/api/stats/overview?date=${dateParam}`;
            if (user?.role === 'Admin' || user?.role === 'Team Lead') {
                if (startD && endD) {
                    url += `&startDate=${startD}&endDate=${endD}`;
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
        fetchOverview(callDate, startDate, endDate);
    }, [fetchOverview, callDate, startDate, endDate]);

    // Auto-refresh dashboard stats when window regains focus, tab becomes visible, or call/lead status updates
    useEffect(() => {
        const handleAutoRefresh = () => {
            fetchOverview(callDate, startDate, endDate);
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
    }, [fetchOverview, callDate, startDate, endDate]);

    // Real-time periodic auto-sync for Call Executive (every 15s)
    useEffect(() => {
        const isCE = user?.role === 'Call Executive' || user?.Role === 'Call Executive';
        if (!isCE) return;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchOverview(callDate, startDate, endDate);
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [user?.role, user?.Role, fetchOverview, callDate, startDate, endDate]);

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
                        </div>
                    ) : (
                        <div className="dashboard-stats-grid">
                            {statsConfig.map((stat, i) => {
                                const isClickable = Boolean(stat.filter && !isTL);
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
                                            cursor: isClickable ? 'pointer' : 'default',
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
