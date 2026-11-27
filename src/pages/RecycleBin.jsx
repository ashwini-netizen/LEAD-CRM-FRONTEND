import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    RotateCcw, Trash2, ArrowLeft, RefreshCw, Search, AlertTriangle, 
    CheckSquare, Square, Clock, Calendar, CheckCircle2, ShieldAlert,
    Filter, HelpCircle, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import UserHeader from '../components/UserHeader';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const statusColors = {
    'Interested': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Not Interested': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'Follow-up': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Call Follow-up': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'Meeting Follow-up': { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    'Busy': { bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
    'Hold': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Switch Off': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Not Answering': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Not Answered': { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
    'Invalid': { bg: 'rgba(239,68,68,0.08)', color: '#ef4444' },
    'Quotation': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Quotation Needed': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Converted': { bg: 'rgba(16,185,129,0.15)', color: '#059669' },
    'Conversion': { bg: 'rgba(16,185,129,0.15)', color: '#059669' },
    'Paid': { bg: 'rgba(16,185,129,0.15)', color: '#059669' },
};

const formatDateIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr.endsWith && dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
        if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
    } catch {
        return String(dateStr).split('T')[0];
    }
};

const formatDateTimeIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr.endsWith && dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
        if (isNaN(d.getTime())) return String(dateStr);
        const datePart = d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
        const timePart = d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
        return `${datePart}, ${timePart}`;
    } catch {
        return String(dateStr);
    }
};

const RecycleBin = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [retentionFilter, setRetentionFilter] = useState('all'); // 'all', '15', '30', 'expired'
    const [selectedLeads, setSelectedLeads] = useState([]);

    // Modal States
    const [modalAction, setModalAction] = useState(null); // 'restore', 'delete', 'clear-expired'
    const [targetLeads, setTargetLeads] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    const fetchRecycleBin = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('crm_token') || '';
            const res = await fetch(`${API_URL}/api/leads/recycle-bin`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to fetch Recycle Bin leads');
            }

            const data = await res.json();
            setLeads(data);
            setSelectedLeads([]);
        } catch (err) {
            console.error('Fetch Recycle Bin Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecycleBin();
    }, []);

    // Filter leads based on search and retention filter
    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            const searchMatch = !search.trim() || 
                l.FullName?.toLowerCase().includes(search.toLowerCase()) ||
                l.CompanyName?.toLowerCase().includes(search.toLowerCase()) ||
                l.SpecificCompanyName?.toLowerCase().includes(search.toLowerCase()) ||
                (l.Phone && String(l.Phone).includes(search)) ||
                l.Status?.toLowerCase().includes(search.toLowerCase()) ||
                l.Email?.toLowerCase().includes(search.toLowerCase());

            if (!searchMatch) return false;

            const isExpired = Number(l.RemainingDays) <= 0;
            if (retentionFilter === 'expired') return isExpired;
            if (retentionFilter === '15') return Number(l.DeleteRetentionDays) === 15;
            if (retentionFilter === '30') return Number(l.DeleteRetentionDays) === 30 || !l.DeleteRetentionDays;

            return true;
        });
    }, [leads, search, retentionFilter]);

    // Statistics counts
    const stats = useMemo(() => {
        const total = leads.length;
        const count15 = leads.filter(l => Number(l.DeleteRetentionDays) === 15).length;
        const count30 = leads.filter(l => Number(l.DeleteRetentionDays) === 30 || !l.DeleteRetentionDays).length;
        const expired = leads.filter(l => Number(l.RemainingDays) <= 0).length;
        return { total, count15, count30, expired };
    }, [leads]);

    // Selection handlers
    const handleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(filteredLeads.map(l => l.LeadID));
        }
    };

    const handleToggleSelect = (id) => {
        setSelectedLeads(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // Trigger action modals
    const openRestoreModal = (leadIds) => {
        setTargetLeads(leadIds);
        setModalAction('restore');
    };

    const openDeleteModal = (leadIds) => {
        setTargetLeads(leadIds);
        setModalAction('delete');
    };

    const openClearExpiredModal = () => {
        const expiredIds = leads.filter(l => Number(l.RemainingDays) <= 0).map(l => l.LeadID);
        setTargetLeads(expiredIds);
        setModalAction('clear-expired');
    };

    const closeModal = () => {
        setModalAction(null);
        setTargetLeads([]);
    };

    // Execute Actions
    const handleConfirmAction = async () => {
        if (!modalAction) return;
        setActionLoading(true);

        const token = localStorage.getItem('crm_token') || '';
        try {
            if (modalAction === 'restore') {
                const res = await fetch(`${API_URL}/api/leads/recycle-bin/restore`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ leadIds: targetLeads })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to restore leads');
                toast.success(data.message || 'Lead(s) restored successfully to active Lead Database');
            } else if (modalAction === 'delete') {
                const res = await fetch(`${API_URL}/api/leads/recycle-bin/permanent-delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ leadIds: targetLeads })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to permanently delete leads');
                toast.success(data.message || 'Lead(s) permanently deleted');
            } else if (modalAction === 'clear-expired') {
                const res = await fetch(`${API_URL}/api/leads/recycle-bin/clear-expired`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to clear expired records');
                toast.success(data.message || 'Expired records purged permanently');
            }

            closeModal();
            fetchRecycleBin();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
            <UserHeader user={user} title="Team Lead Management" />

            <div className="page-main-container" style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
                {/* Navigation Back button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="btn-secondary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                color: '#475569',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            <ArrowLeft size={18} /> Back to Dashboard
                        </button>
                        <button
                            onClick={() => navigate('/leads')}
                            className="btn-secondary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                color: '#475569',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            Lead Database
                        </button>
                    </div>

                    {stats.expired > 0 && (
                        <button
                            onClick={openClearExpiredModal}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '9px 18px',
                                borderRadius: '10px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                fontWeight: '700',
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Trash2 size={16} />
                            Clear All Expired ({stats.expired})
                        </button>
                    )}
                </div>

                {/* Section Header */}
                <div style={{
                    background: '#ffffff',
                    padding: '24px 28px',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '14px',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#059669',
                                flexShrink: 0
                            }}>
                                <RotateCcw size={26} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                                        Recycle Bin
                                    </h1>
                                    <span style={{
                                        background: '#10b981',
                                        color: 'white',
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Team Lead
                                    </span>
                                </div>
                                <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '4px 0 0 0' }}>
                                    View deleted leads, restore records back to the active database, or permanently remove them.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={fetchRecycleBin}
                            disabled={loading}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 18px',
                                borderRadius: '12px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                fontWeight: '600',
                                fontSize: '0.88rem',
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} />
                            Refresh
                        </button>
                    </div>

                    {/* Stat Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                        marginTop: '24px',
                        paddingTop: '20px',
                        borderTop: '1px solid #f1f5f9'
                    }}>
                        <div 
                            onClick={() => setRetentionFilter('all')}
                            style={{
                                padding: '16px 20px',
                                borderRadius: '14px',
                                background: retentionFilter === 'all' ? '#f0fdf4' : '#f8fafc',
                                border: retentionFilter === 'all' ? '2px solid #10b981' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                                Total in Bin
                            </span>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                                {stats.total}
                            </div>
                        </div>

                        <div 
                            onClick={() => setRetentionFilter('30')}
                            style={{
                                padding: '16px 20px',
                                borderRadius: '14px',
                                background: retentionFilter === '30' ? '#eff6ff' : '#f8fafc',
                                border: retentionFilter === '30' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>
                                30-Day Retention
                            </span>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e3a8a', marginTop: '4px' }}>
                                {stats.count30}
                            </div>
                        </div>

                        <div 
                            onClick={() => setRetentionFilter('15')}
                            style={{
                                padding: '16px 20px',
                                borderRadius: '14px',
                                background: retentionFilter === '15' ? '#fefce8' : '#f8fafc',
                                border: retentionFilter === '15' ? '2px solid #eab308' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ca8a04', textTransform: 'uppercase' }}>
                                15-Day Retention
                            </span>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#854d0e', marginTop: '4px' }}>
                                {stats.count15}
                            </div>
                        </div>

                        <div 
                            onClick={() => setRetentionFilter('expired')}
                            style={{
                                padding: '16px 20px',
                                borderRadius: '14px',
                                background: retentionFilter === 'expired' ? '#fef2f2' : '#f8fafc',
                                border: retentionFilter === 'expired' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>
                                Expired Leads
                            </span>
                            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#991b1b', marginTop: '4px' }}>
                                {stats.expired}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        position: 'relative',
                        flex: '1 1 320px',
                        maxWidth: '480px'
                    }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Search by name, company, phone, status..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 46px',
                                borderRadius: '12px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                fontSize: '0.92rem',
                                color: '#0f172a',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Filter size={15} /> Retention:
                        </span>
                        {['all', '30', '15', 'expired'].map(filterKey => (
                            <button
                                key={filterKey}
                                onClick={() => setRetentionFilter(filterKey)}
                                style={{
                                    padding: '7px 14px',
                                    borderRadius: '10px',
                                    border: retentionFilter === filterKey ? '1px solid #10b981' : '1px solid #e2e8f0',
                                    background: retentionFilter === filterKey ? '#ecfdf5' : 'white',
                                    color: retentionFilter === filterKey ? '#059669' : '#64748b',
                                    fontWeight: retentionFilter === filterKey ? '700' : '500',
                                    fontSize: '0.84rem',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {filterKey === 'all' ? 'All Leads' : filterKey === 'expired' ? 'Expired' : `${filterKey} Days`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Batch Actions Bar (when leads selected) */}
                {selectedLeads.length > 0 && (
                    <div style={{
                        background: '#0f172a',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        marginBottom: '20px',
                        flexWrap: 'wrap',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                                {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                            </span>
                            <button
                                onClick={() => setSelectedLeads([])}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Deselect
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button
                                onClick={() => openRestoreModal(selectedLeads)}
                                style={{
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <RotateCcw size={16} /> Restore Selected
                            </button>
                            <button
                                onClick={() => openDeleteModal(selectedLeads)}
                                style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Trash2 size={16} /> Delete Permanently
                            </button>
                        </div>
                    </div>
                )}

                {/* Table Content */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
                    overflow: 'hidden'
                }}>
                    {loading ? (
                        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
                            <Loader2 size={36} className="spin" style={{ margin: '0 auto 16px auto', color: '#10b981' }} />
                            <p style={{ fontWeight: '600', fontSize: '1rem', margin: 0 }}>Loading Recycle Bin...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ef4444' }}>
                            <AlertTriangle size={36} style={{ margin: '0 auto 12px auto' }} />
                            <p style={{ fontWeight: '700', margin: 0 }}>{error}</p>
                            <button
                                onClick={fetchRecycleBin}
                                style={{
                                    marginTop: '16px',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
                            <RotateCcw size={48} style={{ margin: '0 auto 16px auto', color: '#94a3b8', strokeWidth: 1.5 }} />
                            <h3 style={{ fontSize: '1.2rem', color: '#1e293b', fontWeight: '700', margin: '0 0 6px 0' }}>
                                Recycle Bin is empty
                            </h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                                {search || retentionFilter !== 'all' 
                                    ? 'No deleted leads match the selected filter criteria.' 
                                    : 'Deleted leads will be stored here for their retention period before automatic deletion.'}
                            </p>
                        </div>
                    ) : (
                        <div
                            ref={tableContainerRef}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeave}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                            style={{
                                overflowX: 'auto',
                                cursor: isDragging ? 'grabbing' : 'default',
                                userSelect: isDragging ? 'none' : 'auto'
                            }}
                        >
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '16px 20px', width: '40px' }}>
                                            <div
                                                onClick={handleSelectAll}
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                title="Select all"
                                            >
                                                {selectedLeads.length === filteredLeads.length && filteredLeads.length > 0 ? (
                                                    <CheckSquare size={19} color="#10b981" />
                                                ) : (
                                                    <Square size={19} color="#94a3b8" />
                                                )}
                                            </div>
                                        </th>
                                        <th style={{ padding: '16px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Lead Details
                                        </th>
                                        <th style={{ padding: '16px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Contact
                                        </th>
                                        <th style={{ padding: '16px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Status
                                        </th>
                                        <th style={{ padding: '16px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Deleted Date
                                        </th>
                                        <th style={{ padding: '16px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Expiry Date
                                        </th>
                                        <th style={{ padding: '16px 16px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Retention
                                        </th>
                                        <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.map((lead, idx) => {
                                        const isSelected = selectedLeads.includes(lead.LeadID);
                                        const remaining = Number(lead.RemainingDays);
                                        const isExpired = remaining <= 0;
                                        const statusStyle = statusColors[lead.Status] || { bg: '#f1f5f9', color: '#475569' };

                                        return (
                                            <tr 
                                                key={lead.LeadID}
                                                style={{
                                                    borderBottom: '1px solid #f1f5f9',
                                                    background: isSelected ? '#f0fdf4' : idx % 2 === 0 ? 'white' : '#fafafa',
                                                    transition: 'background 0.15s ease'
                                                }}
                                            >
                                                <td style={{ padding: '16px 20px' }}>
                                                    <div 
                                                        onClick={() => handleToggleSelect(lead.LeadID)}
                                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={19} color="#10b981" />
                                                        ) : (
                                                            <Square size={19} color="#cbd5e1" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 16px' }}>
                                                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>
                                                        {lead.FullName || 'Unnamed Lead'}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                                        {lead.CompanyName || lead.CompanyType || 'No Company'}
                                                    </div>
                                                    {lead.DeletedByName && (
                                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                                                            Deleted by: {lead.DeletedByName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 16px' }}>
                                                    <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>
                                                        {lead.Phone || 'N/A'}
                                                    </div>
                                                    {lead.Email && (
                                                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                                            {lead.Email}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 16px' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                        background: statusStyle.bg,
                                                        color: statusStyle.color
                                                    }}>
                                                        {lead.Status || 'Active'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 16px', fontSize: '0.85rem', color: '#334155' }}>
                                                    <div style={{ fontWeight: '600' }}>
                                                        {formatDateIST(lead.DeletedAt)}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {lead.DeletedAt ? formatDateTimeIST(lead.DeletedAt).split(',')[1] : ''}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 16px', fontSize: '0.85rem', color: '#334155' }}>
                                                    <div style={{ fontWeight: '600' }}>
                                                        {formatDateIST(lead.DeleteExpiryDate)}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                        Plan: {lead.DeleteRetentionDays || 30} Days
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 16px' }}>
                                                    {isExpired ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            background: '#fee2e2',
                                                            color: '#b91c1c',
                                                            fontWeight: '800',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            <AlertTriangle size={13} /> Expired
                                                        </span>
                                                    ) : remaining <= 3 ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            background: '#fef3c7',
                                                            color: '#b45309',
                                                            fontWeight: '700',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            <Clock size={13} /> {remaining} {remaining === 1 ? 'day' : 'days'} left
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            background: '#dcfce7',
                                                            color: '#15803d',
                                                            fontWeight: '700',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            <Clock size={13} /> {remaining} days left
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <button
                                                            onClick={() => openRestoreModal([lead.LeadID])}
                                                            title="Restore Lead"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: '#ecfdf5',
                                                                border: '1px solid #a7f3d0',
                                                                color: '#059669',
                                                                fontWeight: '700',
                                                                fontSize: '0.8rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <RotateCcw size={14} /> Restore
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteModal([lead.LeadID])}
                                                            title="Delete Permanently"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '6px 10px',
                                                                borderRadius: '8px',
                                                                background: '#fef2f2',
                                                                border: '1px solid #fecaca',
                                                                color: '#dc2626',
                                                                fontWeight: '700',
                                                                fontSize: '0.8rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modals */}
            {modalAction && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '32px',
                        borderRadius: '24px',
                        width: '100%',
                        maxWidth: '440px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: modalAction === 'restore' ? '#ecfdf5' : '#fee2e2',
                                color: modalAction === 'restore' ? '#059669' : '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {modalAction === 'restore' ? (
                                    <RotateCcw size={24} />
                                ) : (
                                    <AlertTriangle size={24} />
                                )}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                                    {modalAction === 'restore' 
                                        ? 'Restore Lead' 
                                        : modalAction === 'clear-expired' 
                                            ? 'Clear Expired Records' 
                                            : 'Permanently Delete'}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0' }}>
                                    {modalAction === 'restore'
                                        ? `Returning ${targetLeads.length} record(s) to active database`
                                        : 'Permanent deletion warning'}
                                </p>
                            </div>
                        </div>

                        <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '24px' }}>
                            {modalAction === 'restore' ? (
                                <>
                                    Are you sure you want to restore <strong>{targetLeads.length} lead{targetLeads.length > 1 ? 's' : ''}</strong>? The lead will be returned to the active Lead Database with all original details, call history, and meeting logs intact.
                                </>
                            ) : modalAction === 'clear-expired' ? (
                                <>
                                    Are you sure you want to permanently delete all <strong>{targetLeads.length} expired lead{targetLeads.length > 1 ? 's' : ''}</strong>? Their retention period has elapsed. This action <strong>cannot be undone</strong>.
                                </>
                            ) : (
                                <>
                                    Are you sure you want to permanently delete <strong>{targetLeads.length} lead{targetLeads.length > 1 ? 's' : ''}</strong>? This action <strong>cannot be undone</strong> and will permanently wipe the lead and its associated records.
                                </>
                            )}
                        </p>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={closeModal}
                                disabled={actionLoading}
                                style={{
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: 'none',
                                    padding: '11px 20px',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                disabled={actionLoading}
                                style={{
                                    background: modalAction === 'restore' ? '#10b981' : '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    padding: '11px 22px',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {actionLoading ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        Processing...
                                    </>
                                ) : modalAction === 'restore' ? (
                                    <>
                                        <RotateCcw size={16} /> Restore
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} /> Yes, Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecycleBin;
