import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, Calendar, CheckCircle2, XCircle, User, Filter, ArrowLeft, Download } from 'lucide-react';
import UserHeader from '../components/UserHeader';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePDF } from '../utils/pdfDownload';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const LeadHistory = ({ user }) => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedDate, setSelectedDate] = useState('');

    // Drag to scroll hook
    const { ref: tableContainerRef, isDragging, handleMouseDown, handleMouseLeave, handleMouseUp, handleMouseMove } = useDraggableScroll();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API_URL}/api/leads/history`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLeads(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const getInvoiceNumbers = (breakdownStr) => {
        if (!breakdownStr) return [];
        try {
            const breakdown = JSON.parse(breakdownStr);
            if (!Array.isArray(breakdown)) return [];
            return [...new Set(breakdown.map(item => item.invoiceNumber).filter(Boolean))];
        } catch (e) {
            return [];
        }
    };

    const filteredLeads = leads.filter(l => {
        const matchesSearch = l.FullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.Phone.includes(searchTerm);
        const matchesFilter = filterStatus === 'All' || l.Status === filterStatus;

        const leadDate = l.UpdatedAt ? new Date(l.UpdatedAt).toISOString().split('T')[0] : '';
        const matchesDate = !selectedDate || leadDate === selectedDate;

        return matchesSearch && matchesFilter && matchesDate;
    });

    const handleDownloadPDF = async () => {
        const doc = jsPDF ? new jsPDF('l', 'mm', 'a4') : null;
        if (!doc) return;

        // Add Title
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59);
        doc.text('Lead History Report', 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        const pad = (n) => String(n).padStart(2, '0');
        const now = new Date();
        const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        doc.text(`Generated on: ${dateStr} ${timeStr}`, 14, 30);
        doc.text(`Filter Status: ${filterStatus} | Total Records: ${filteredLeads.length}`, 14, 37);

        const tableColumn = ["S.No", "Lead Name", "Company", "ID", "Status", "Contact", "Invoice", "Executive", "Date"];
        const tableRows = [];

        filteredLeads.forEach((l, index) => {
            const invoiceNumbers = getInvoiceNumbers(l.BillingBreakdown).join(', ');
            const leadData = [
                index + 1,
                l.FullName,
                l.CompanyName || 'N/A',
                l.LeadID,
                l.Status === 'Quotation' ? 'Converted' : l.Status,
                l.Phone,
                invoiceNumbers || 'N/A',
                l.AssignedToName || 'Unassigned',
                new Date(l.UpdatedAt).toLocaleDateString('en-GB')
            ];
            tableRows.push(leadData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241], fontSize: 10, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 15 }, // S.No
                3: { cellWidth: 15 }, // ID
                4: { cellWidth: 25 }, // Status
                5: { cellWidth: 30 }, // Contact
                7: { cellWidth: 30 }, // Executive
                8: { cellWidth: 28 }  // Date
            },
            margin: { top: 45 }
        });

        await savePDF(doc, `Lead_History_${filterStatus}_${dateStr}.pdf`);
    };

    if (loading) return <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={40} className="spin" color="#6366f1" /></div>;

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
            <UserHeader user={user} title="Lead Archives & History" />

            <div className="page-main-container" style={{ maxWidth: '100%', boxSizing: 'border-box', flex: 1, width: '100%' }}>
                <header style={{ marginBottom: '10px' }}>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', width: 'fit-content' }}
                    >
                        <ArrowLeft size={18} /> Back to Dashboard
                    </button>
                    <div className="responsive-header">
                        <div>
                            <h1 style={{ fontSize: '2.2rem', color: '#1e293b', margin: 0, borderLeft: '6px solid #6366f1', paddingLeft: '20px' }}>Lead History</h1>
                            <p style={{ color: '#64748b', margin: '5px 0 0 0', paddingLeft: '26px' }}>Records of all converted, rejected, and canceled leads.</p>
                        </div>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={filteredLeads.length === 0}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '800',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                                opacity: filteredLeads.length === 0 ? 0.6 : 1,
                                transition: '0.3s'
                            }}
                        >
                            <Download size={18} /> Download List PDF
                        </button>
                    </div>
                </header>

                <div className="responsive-filter-bar" style={{ background: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', padding: '24px', marginBottom: '30px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by name or phone..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoComplete="off"
                        />
                    </div>
                    <div style={{ position: 'relative', minWidth: '185px' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                        <input
                            type="date"
                            className="input-field"
                            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '44px', background: 'white' }}
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div style={{ position: 'relative', minWidth: '180px' }}>
                        <Filter size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                        <select 
                            className="input-field" 
                            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '44px', cursor: 'pointer', background: 'white' }} 
                            value={filterStatus} 
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Paid">Paid / Joined</option>
                            <option value="Due Payment">Due Payment</option>
                            <option value="Quotation">Converted (Quote Uploaded)</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Canceled">Canceled</option>
                            <option value="Not Interested">Not Interested</option>
                        </select>
                    </div>
                </div>

                <div 
                    ref={tableContainerRef}
                    className="glass-card responsive-table-container hide-scrollbar" 
                    style={{ 
                        padding: 0, 
                        overflowX: 'auto',
                        cursor: isDragging ? 'grabbing' : 'grab' 
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: isDragging ? 'none' : 'auto', minWidth: '1000px' }}>
                        <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                            <tr style={{ textAlign: 'left' }}>
                                <th style={thStyle}>S.No</th>
                                <th style={thStyle}>Lead Name</th>
                                <th style={thStyle}>Company</th>
                                <th style={thStyle}>Final Status</th>
                                <th style={thStyle}>Contact</th>
                                <th style={thStyle}>Invoice</th>
                                <th style={thStyle}>Executive</th>
                                <th style={thStyle}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.map((l, index) => (
                                <tr key={l.LeadID} style={{ borderBottom: '1px solid #f1f5f9' }} className="row-hover">
                                    <td style={{ ...tdStyle, fontWeight: '800', color: '#64748b' }}>{index + 1}</td>
                                    <td style={tdStyle}>
                                        <p style={{ fontWeight: '800', margin: 0, color: '#0f172a', fontSize: '1rem' }}>{l.FullName}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, fontWeight: '800' }}>ID: {l.LeadID}</p>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#1e293b', fontSize: '0.9rem', fontWeight: '800' }}>{l.CompanyName || 'N/A'}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '800',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            background: l.Status === 'Paid' ? '#dcfce7' :
                                                l.Status === 'Due Payment' ? '#fef9c3' :
                                                    l.Status === 'Meeting Done' ? '#dcfce7' :
                                                        l.Status === 'Quotation' ? '#e0e7ff' : '#fee2e2',
                                            color: l.Status === 'Paid' ? '#166534' :
                                                l.Status === 'Due Payment' ? '#854d0e' :
                                                    l.Status === 'Meeting Done' ? '#166534' :
                                                        l.Status === 'Quotation' ? '#3730a3' : '#991b1b',
                                            border: '1px solid rgba(0,0,0,0.05)'
                                        }}>
                                            {l.Status === 'Paid' || l.Status === 'Meeting Done' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {l.Status === 'Quotation' ? 'Converted' : l.Status}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#1e293b', fontWeight: '800' }}>{l.Phone}</td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {getInvoiceNumbers(l.BillingBreakdown).length > 0 ? (
                                                getInvoiceNumbers(l.BillingBreakdown).map((inv, idx) => (
                                                    <span key={idx} style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', border: '1px solid rgba(67, 56, 202, 0.2)' }}>
                                                        {inv}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: '600' }}>No Invoice</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '24px', height: '24px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={12} /></div>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b' }}>{l.AssignedToName ? `${l.AssignedToName} ${l.AssignedToEmpID ? `(${l.AssignedToEmpID})` : ''}` : 'Unassigned'}</span>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#1e293b', fontWeight: '800' }}>
                                            <Calendar size={14} /> {new Date(l.UpdatedAt).toLocaleDateString('en-GB')}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLeads.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                            No archived leads match your search criteria.
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .glass-card { background: white; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; }
                .input-field { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 0.9rem; }
                .input-field:focus { outline: none; border-color: #6366f1; }
                .row-hover:hover { background: #f8fafc; }
                .view-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid #6366f1; color: #6366f1; background: transparent; cursor: pointer; font-size: 0.8rem; font-weight: 600; }
                .view-btn:hover { background: #6366f1; color: white; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

const thStyle = { padding: '16px 20px', color: '#1e293b', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '800' };
const tdStyle = { padding: '16px 20px' };

export default LeadHistory;
