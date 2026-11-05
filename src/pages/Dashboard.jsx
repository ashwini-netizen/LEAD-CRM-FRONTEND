import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, UserPlus, List, Settings, LogOut, Loader, AlertCircle, BarChart, Calendar, Clock, FileText, CreditCard, Navigation, Activity, Users, TrendingUp, IndianRupee, Download, FileDown, MessageSquare, CheckCircle } from 'lucide-react';
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

    // Auto-refresh dashboard stats when window regains focus, tab becomes visible, or lead status updates
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
        window.addEventListener('focus', handleAutoRefresh);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('lead_updated', handleAutoRefresh);
            window.removeEventListener('focus', handleAutoRefresh);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchOverview, callDate, startDate, endDate]);

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

                    <div className="dashboard-stats-grid">
                        {statsConfig.map((stat, i) => (
                            <div 
                                key={i} 
                                className="glass-card" 
                                onClick={() => {
                                    if (stat.filter) {
                                        const isFE = user?.role === 'Field Executive' || user?.Role === 'Field Executive';
                                        const targetPath = isFE ? '/leads/my-created' : '/leads';
                                        navigate(targetPath, { state: { categoryFilter: stat.filter } });
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
                                    cursor: stat.filter ? 'pointer' : 'default',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}
                                onMouseEnter={e => {
                                    if (stat.filter) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (stat.filter) {
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                                    }
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>{stat.label}</p>
                                    {stat.filter && (
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
                        ))}
                    </div>

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
