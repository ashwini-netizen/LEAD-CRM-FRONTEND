import React, { useState, useEffect } from 'react';
import { Info, HelpCircle, AlertCircle, CheckCircle2, X } from 'lucide-react';

const GlobalModal = () => {
    const [modal, setModal] = useState({
        isOpen: false,
        title: 'Notice',
        message: '',
        type: 'info', // 'info' | 'warning' | 'error' | 'success' | 'confirm'
        isConfirm: false,
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    });

    const closeModal = () => {
        setModal(prev => ({
            ...prev,
            isOpen: false,
            message: '',
            onConfirm: null,
            onCancel: null
        }));
    };

    useEffect(() => {
        // Override native window.alert globally with clean styling and smart categorization
        window.alert = (message, customTitle = null) => {
            let type = 'info';
            let title = customTitle || 'Notice';

            if (typeof message === 'object' && message !== null) {
                title = message.title || customTitle || 'Notice';
                type = message.type || 'info';
                message = message.message || JSON.stringify(message);
            } else {
                const lowerMsg = String(message).toLowerCase();
                if (lowerMsg.includes('success') || lowerMsg.includes('saved successfully') || lowerMsg.includes('updated successfully') || lowerMsg.includes('created successfully')) {
                    type = 'success';
                    title = customTitle || 'Success';
                } else if (lowerMsg.includes('repeated digits') || lowerMsg.includes('phone') || lowerMsg.includes('valid 10-digit') || lowerMsg.includes('digits')) {
                    type = 'warning';
                    title = customTitle || 'Invalid Phone Number';
                } else if (lowerMsg.includes('cannot') || lowerMsg.includes('must be') || lowerMsg.includes('invalid') || lowerMsg.includes('required') || lowerMsg.includes('please fill') || lowerMsg.includes('please enter') || lowerMsg.includes('turn on online')) {
                    type = 'warning';
                    title = customTitle || 'Validation Notice';
                } else if (lowerMsg.includes('failed') || lowerMsg.includes('error')) {
                    type = 'error';
                    title = customTitle || 'Notice';
                }
            }

            setModal({
                isOpen: true,
                title,
                message: String(message),
                type,
                isConfirm: false,
                confirmText: 'OK',
                cancelText: 'Cancel',
                onConfirm: null,
                onCancel: null
            });
        };

        // Custom promise-based confirm dialog globally available
        window.confirmDialog = (message, confirmText = 'OK', cancelText = 'Cancel', customTitle = 'Confirmation') => {
            return new Promise((resolve) => {
                setModal({
                    isOpen: true,
                    title: customTitle,
                    message: String(message),
                    type: 'confirm',
                    isConfirm: true,
                    confirmText,
                    cancelText,
                    onConfirm: () => {
                        closeModal();
                        resolve(true);
                    },
                    onCancel: () => {
                        closeModal();
                        resolve(false);
                    }
                });
            });
        };
    }, []);

    // Keyboard navigation (Escape to close, Enter to confirm)
    useEffect(() => {
        if (!modal.isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (modal.isConfirm && modal.onCancel) {
                    modal.onCancel();
                } else {
                    closeModal();
                }
            } else if (e.key === 'Enter') {
                if (modal.isConfirm && modal.onConfirm) {
                    modal.onConfirm();
                } else {
                    closeModal();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modal.isOpen, modal.isConfirm, modal.onConfirm, modal.onCancel]);

    if (!modal.isOpen) return null;

    // Parse message to see if there's a title/description vs a path/filepath
    const newlineIndex = modal.message.indexOf('\n');
    let mainMessage = modal.message;
    let pathDetail = '';

    if (newlineIndex !== -1) {
        mainMessage = modal.message.substring(0, newlineIndex);
        pathDetail = modal.message.substring(newlineIndex + 1).trim();
    }

    // Determine icon and style based on modal type
    const getBadgeConfig = () => {
        if (modal.isConfirm) {
            return {
                icon: <HelpCircle size={18} strokeWidth={2.2} />,
                bg: '#f0f9ff',
                color: '#0284c7',
                border: '#e0f2fe'
            };
        }
        switch (modal.type) {
            case 'success':
                return {
                    icon: <CheckCircle2 size={18} strokeWidth={2.2} />,
                    bg: '#f0fdf4',
                    color: '#16a34a',
                    border: '#dcfce7'
                };
            case 'warning':
                return {
                    icon: <AlertCircle size={18} strokeWidth={2.2} />,
                    bg: '#fffbeb',
                    color: '#d97706',
                    border: '#fef3c7'
                };
            case 'error':
                return {
                    icon: <AlertCircle size={18} strokeWidth={2.2} />,
                    bg: '#fef2f2',
                    color: '#dc2626',
                    border: '#fee2e2'
                };
            default:
                return {
                    icon: <Info size={18} strokeWidth={2.2} />,
                    bg: '#eef2ff',
                    color: '#4f46e5',
                    border: '#e0e7ff'
                };
        }
    };

    const badge = getBadgeConfig();

    const handleBackdropClick = () => {
        if (modal.isConfirm && modal.onCancel) {
            modal.onCancel();
        } else {
            closeModal();
        }
    };

    return (
        <div 
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000,
                animation: 'modalFadeIn 0.15s ease-out'
            }}
        >
            <div 
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#ffffff',
                    padding: '24px',
                    borderRadius: '16px',
                    width: '92%',
                    maxWidth: '420px',
                    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                    border: '1px solid #f1f5f9',
                    animation: 'modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {badge.icon}
                        </div>
                        <h3 style={{ 
                            fontSize: '1.05rem', 
                            fontWeight: '600', 
                            color: '#0f172a', 
                            margin: 0,
                            letterSpacing: '-0.01em'
                        }}>
                            {modal.title}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={handleBackdropClick}
                        title="Close"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '6px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#334155';
                            e.currentTarget.style.background = '#f1f5f9';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{
                        color: '#475569',
                        fontSize: '0.925rem',
                        lineHeight: '1.55',
                        fontWeight: '400',
                        margin: 0,
                        whiteSpace: 'pre-wrap'
                    }}>
                        {mainMessage}
                    </p>

                    {pathDetail && (
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                            fontSize: '0.8rem',
                            color: '#475569',
                            wordBreak: 'break-all',
                            userSelect: 'all',
                            lineHeight: '1.4'
                        }}>
                            {pathDetail}
                        </div>
                    )}
                </div>

                {/* Divider & Actions */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9'
                }}>
                    {modal.isConfirm ? (
                        <>
                            <button
                                type="button"
                                onClick={modal.onCancel}
                                style={{
                                    background: '#ffffff',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0',
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    fontWeight: '500',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                            >
                                {modal.cancelText || 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={modal.onConfirm}
                                style={{
                                    background: '#4f46e5',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '8px 20px',
                                    borderRadius: '8px',
                                    fontWeight: '500',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
                            >
                                {modal.confirmText || 'OK'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={closeModal}
                            style={{
                                background: '#4f46e5',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 24px',
                                borderRadius: '8px',
                                fontWeight: '500',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
                        >
                            OK
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes modalFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: scale(0.96) translateY(6px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default GlobalModal;
