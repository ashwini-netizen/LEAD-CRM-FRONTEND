import React, { useState, useEffect } from 'react';
import { Info, HelpCircle } from 'lucide-react';

const GlobalModal = () => {
    const [modal, setModal] = useState({
        isOpen: false,
        message: '',
        isConfirm: false,
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    });

    useEffect(() => {
        // Override native window.alert globally
        window.alert = (message) => {
            setModal({
                isOpen: true,
                message: String(message),
                isConfirm: false,
                confirmText: 'OK',
                cancelText: 'Cancel',
                onConfirm: null,
                onCancel: null
            });
        };

        // Custom promise-based confirm dialog globally available
        window.confirmDialog = (message, confirmText = 'OK', cancelText = 'Cancel') => {
            return new Promise((resolve) => {
                setModal({
                    isOpen: true,
                    message: String(message),
                    isConfirm: true,
                    confirmText,
                    cancelText,
                    onConfirm: () => {
                        setModal({ isOpen: false, message: '', isConfirm: false, confirmText: 'OK', cancelText: 'Cancel', onConfirm: null, onCancel: null });
                        resolve(true);
                    },
                    onCancel: () => {
                        setModal({ isOpen: false, message: '', isConfirm: false, confirmText: 'OK', cancelText: 'Cancel', onConfirm: null, onCancel: null });
                        resolve(false);
                    }
                });
            });
        };
    }, []);

    if (!modal.isOpen) return null;

    // Parse message to see if there's a title/description vs a path/filepath
    const newlineIndex = modal.message.indexOf('\n');
    let mainMessage = modal.message;
    let pathDetail = '';

    if (newlineIndex !== -1) {
        mainMessage = modal.message.substring(0, newlineIndex);
        pathDetail = modal.message.substring(newlineIndex + 1).trim();
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                background: 'white',
                padding: '28px 32px',
                borderRadius: '24px',
                width: '90%',
                maxWidth: '440px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        background: modal.isConfirm ? '#e0f2fe' : '#e0e7ff',
                        color: modal.isConfirm ? '#0284c7' : '#6366f1',
                        padding: '10px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {modal.isConfirm ? <HelpCircle size={24} /> : <Info size={24} />}
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                        {modal.isConfirm ? 'Confirmation' : 'Message'}
                    </h2>
                </div>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{
                        color: '#334155',
                        fontSize: '0.975rem',
                        lineHeight: '1.5',
                        fontWeight: '500',
                        margin: 0,
                        whiteSpace: 'pre-wrap'
                    }}>
                        {mainMessage}
                    </p>

                    {pathDetail && (
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                            fontSize: '0.825rem',
                            color: '#475569',
                            wordBreak: 'break-all',
                            userSelect: 'all',
                            lineHeight: '1.4'
                        }}>
                            {pathDetail}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    {modal.isConfirm ? (
                        <>
                            <button
                                onClick={modal.onCancel}
                                style={{
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                            >
                                {modal.cancelText || 'Cancel'}
                            </button>
                            <button
                                onClick={modal.onConfirm}
                                style={{
                                    background: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#4f46e5'}
                                onMouseLeave={(e) => e.target.style.background = '#6366f1'}
                            >
                                {modal.confirmText || 'OK'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setModal({ isOpen: false, message: '', isConfirm: false, confirmText: 'OK', cancelText: 'Cancel', onConfirm: null, onCancel: null })}
                            style={{
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#4f46e5'}
                            onMouseLeave={(e) => e.target.style.background = '#6366f1'}
                        >
                            OK
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default GlobalModal;

