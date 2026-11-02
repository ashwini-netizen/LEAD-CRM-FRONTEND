import { useState, useEffect } from 'react';
import { X, UserCheck, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

const AssignModal = ({ lead, onClose, onAssign, onlyField = false }) => {
    const [executives, setExecutives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [selectedRole, setSelectedRole] = useState(onlyField ? 'Field Executive' : 'Call Executive');

    useEffect(() => {
        const fetchExecutives = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/users?role=${encodeURIComponent(selectedRole)}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}` }
                });
                if (!res.ok) throw new Error('Failed to fetch executives');
                const data = await res.json();
                setExecutives(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchExecutives();
    }, [selectedRole]);

    const handleAssign = async (execId) => {
        setAssigning(true);
        try {
            const res = await fetch(`${API_URL}/api/leads/${lead.LeadID}/assign`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('crm_token') || ''}`
                },
                body: JSON.stringify({ assignedTo: execId })
            });
            if (!res.ok) throw new Error('Assignment failed');
            const exec = executives.find(e => String(e.UserID || e.id) === String(execId));
            onAssign(lead.LeadID, execId, exec?.EmployeeName || exec?.name || 'Executive', selectedRole);
            onClose();
        } catch (err) {
            alert(err.message);
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div style={{ background: 'white', width: '450px', maxWidth: '90%', boxSizing: 'border-box', borderRadius: '20px', padding: '24px 20px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem' }}>Assign Lead: <span style={{ color: '#6366f1' }}>{lead.FullName}</span></h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
                </div>

                {!onlyField && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <button
                            onClick={() => setSelectedRole('Call Executive')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '10px',
                                border: selectedRole === 'Call Executive' ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                background: selectedRole === 'Call Executive' ? 'rgba(99, 102, 241, 0.1)' : 'white',
                                color: selectedRole === 'Call Executive' ? '#6366f1' : '#64748b',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Call Executive
                        </button>
                        <button
                            onClick={() => setSelectedRole('Field Executive')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '10px',
                                border: selectedRole === 'Field Executive' ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                background: selectedRole === 'Field Executive' ? 'rgba(99, 102, 241, 0.1)' : 'white',
                                color: selectedRole === 'Field Executive' ? '#6366f1' : '#64748b',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Field Executive
                        </button>
                    </div>
                )}

                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}><Loader size={30} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} /></div>
                    ) : error ? (
                        <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>
                    ) : executives.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8' }}>No {selectedRole}s found.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {executives.map(exec => (
                                <div 
                                    key={exec.UserID} 
                                    style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        padding: '15px', 
                                        background: '#f8fafc', 
                                        borderRadius: '12px', 
                                        border: lead.AssignedTo === exec.UserID ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                        transition: '0.2s'
                                    }}
                                >
                                    <div>
                                        <p style={{ fontWeight: '600' }}>{exec.EmployeeName}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{exec.EmployeeID} • {exec.ContactNumber}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleAssign(exec.UserID)}
                                        disabled={assigning || lead.AssignedTo === exec.UserID}
                                        style={{ 
                                            padding: '8px 16px', 
                                            background: lead.AssignedTo === exec.UserID ? '#10b981' : '#6366f1', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '8px', 
                                            cursor: lead.AssignedTo === exec.UserID ? 'default' : 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        {lead.AssignedTo === exec.UserID ? <><UserCheck size={16} /> Assigned</> : 'Select'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssignModal;
