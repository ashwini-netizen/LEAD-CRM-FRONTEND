import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, Loader, Minus, Trash2, AlertTriangle } from 'lucide-react';
import io from 'socket.io-client';
import { stripEmojis } from '../utils/stringUtils';

const API_URL = import.meta.env.VITE_API_URL || 'https://monogamy-reforest-boaster.ngrok-free.dev';

/**
 * Formats a chat timestamp into a consistent, accurate time string.
 * Always ensures the timestamp is parsed as UTC by appending 'Z' if missing.
 * This prevents the browser from misinterpreting SQL Server UTC timestamps
 * as local time, which causes a timezone shift (e.g. 5.5 hrs for IST).
 */
const formatChatTime = (rawTimestamp) => {
    if (!rawTimestamp) return '';
    // Normalize: if the ISO string has no Z or +offset, it came from SQL Server
    // CONVERT(VARCHAR, Timestamp, 126) which omits the Z — force UTC
    let ts = String(rawTimestamp);
    if (!ts.endsWith('Z') && !ts.includes('+') && /^\d{4}-\d{2}-\d{2}T/.test(ts)) {
        ts += 'Z';
    }
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday ${timeStr}`;
    return `${date.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${timeStr}`;
};

const ChatBox = ({ user, partner, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const socketRef = useRef(null);
    const scrollRef = useRef(null);
    const [activePartner, setActivePartner] = useState(partner);
    const minimizedRef = useRef(minimized);
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    useEffect(() => {
        minimizedRef.current = minimized;
    }, [minimized]);

    useEffect(() => {
        if (!partner) return;

        const initChat = async () => {
            let currentPartner = partner;

            // If we only have ID (from a notification), fetch full details
            if (!partner.EmployeeName || partner.EmployeeName === 'Chat Partner') {
                try {
                    const res = await fetch(`${API_URL}/api/auth/${partner.UserID}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                    });
                    if (res.ok) {
                        currentPartner = await res.json();
                        setActivePartner(currentPartner);
                    }
                } catch (e) { console.error('Failed to fetch partner info', e); }
            } else {
                setActivePartner(partner);
            }

            // Initialize Socket
            socketRef.current = io(API_URL, {
                transports: ['websocket', 'polling']
            });
            socketRef.current.emit('join', { userId: user.id || user.UserID, role: user.role });
            socketRef.current.on('connect_error', (err) => {
                console.error('[CHATBOX] Socket error:', err);
            });

            // Fetch History
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/chat/history/${currentPartner.UserID || currentPartner.id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                });
                if (res.ok) setMessages(await res.json());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }

            // Mark as read function
            const markAsRead = async () => {
                const targetId = currentPartner.UserID || currentPartner.id;
                try {
                    // Instantly force clear badge on UI
                    window.dispatchEvent(new CustomEvent('force_clear_chat_badge', { detail: targetId }));

                    await fetch(`${API_URL}/api/notifications/read-chat/${targetId}`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
                    });
                    window.dispatchEvent(new CustomEvent('refresh_notifications'));
                } catch (e) {
                    console.error(e);
                }
            };
            
            // Mark on init
            markAsRead();

            // Listen for messages from other users
            socketRef.current.off('receiveMessage');
            socketRef.current.on('receiveMessage', (msg) => {
                if (String(msg.SenderID) === String(currentPartner.UserID || currentPartner.id)) {
                    setMessages(prev => [...prev, msg]);
                    if (!minimizedRef.current) {
                        setTimeout(markAsRead, 500);
                    }
                }
            });

            // Replace the optimistic local message with the server-confirmed message
            // (which has the real DB timestamp with correct UTC 'Z' suffix)
            socketRef.current.off('messageSent');
            socketRef.current.on('messageSent', (confirmedMsg) => {
                setMessages(prev => {
                    // Replace the last optimistic message (Date.now() ID) with confirmed
                    const lastOptIdx = [...prev].reverse().findIndex(
                        m => typeof m.MessageID === 'number' && m.MessageID > 1700000000000
                    );
                    if (lastOptIdx === -1) return [...prev, confirmedMsg];
                    const realIdx = prev.length - 1 - lastOptIdx;
                    const updated = [...prev];
                    updated[realIdx] = confirmedMsg;
                    return updated;
                });
            });

            // Listen for typing
            socketRef.current.off('userTyping');
            socketRef.current.on('userTyping', (data) => {
                if (String(data.userId) === String(currentPartner.UserID || currentPartner.id)) {
                    setIsTyping(data.isTyping);
                }
            });
        };

        initChat();

        return () => {
            if (socketRef.current) {
                socketRef.current.off('receiveMessage');
                socketRef.current.off('messageSent');
                socketRef.current.off('userTyping');
                socketRef.current.disconnect();
            }
        };
    }, [partner, user]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);



    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const targetId = activePartner.UserID || activePartner.id;

        const msgData = {
            receiverId: targetId,
            message: inputText
        };

        socketRef.current.emit('sendMessage', msgData);

        const localMsg = {
            MessageID: Date.now(),
            SenderID: user.id || user.UserID,
            ReceiverID: targetId,
            Message: inputText,
            Timestamp: new Date().toISOString(),
            Status: 'Sent'
        };

        setMessages(prev => [...prev, localMsg]);
        setInputText('');
        socketRef.current.emit('typing', { receiverId: targetId, isTyping: false });
    };

    const handleTextChange = (e) => {
        const cleaned = stripEmojis(e.target.value);
        setInputText(cleaned);
        const targetId = activePartner.UserID || activePartner.id;
        if (socketRef.current) socketRef.current.emit('typing', { receiverId: targetId, isTyping: cleaned.length > 0 });
    };

    const requestClearHistory = () => {
        setConfirmConfig({
            isOpen: true,
            title: 'Clear Chat History',
            message: 'Are you sure you want to clear the entire chat history? This action cannot be undone.',
            onConfirm: () => executeClearHistory()
        });
    };

    const executeClearHistory = async () => {
        const targetId = activePartner.UserID || activePartner.id;
        try {
            const res = await fetch(`${API_URL}/api/chat/clear/${targetId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('crm_token')}` }
            });
            if (res.ok) setMessages([]);
        } catch (err) { console.error(err); }
    };

    if (!partner) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '350px',
            maxWidth: 'calc(100% - 40px)',
            height: minimized ? '60px' : '450px',
            maxHeight: 'calc(100vh - 100px)',
            background: 'white',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            transition: 'height 0.3s ease',
            overflow: confirmConfig.isOpen ? 'visible' : 'hidden',
            border: '1px solid #e2e8f0'
        }}>
            {/* Header */}
            <div style={{
                padding: '15px 20px',
                background: '#6366f1',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
            }} onClick={() => setMinimized(!minimized)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {activePartner.EmployeeName?.charAt(0) || '?'}
                        </div>
                        {activePartner.IsOnline && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', border: '2px solid #6366f1' }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{activePartner.EmployeeName}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{activePartner.Role}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); requestClearHistory(); }}
                        title="Clear History"
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <Trash2 size={16} />
                    </button>
                    <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Minus size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={18} /></button>
                </div>
            </div>

            {!minimized && (
                <>
                    {/* Messages Area */}
                    <div ref={scrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loading ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader className="spin" size={20} color="#6366f1" /></div>
                        ) : messages.length === 0 ? (
                            <div style={{ textAlign: 'center', marginTop: '50px', color: '#94a3b8', fontSize: '0.85rem' }}>No messages yet. Say hello!</div>
                        ) : (
                            messages.map((msg, i) => {
                                const isMine = String(msg.SenderID) === String(user.id || user.UserID);
                                return (
                                    <div key={i} className="message-container" style={{
                                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                                        maxWidth: '80%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMine ? 'flex-end' : 'flex-start',
                                        position: 'relative'
                                    }}>
                                        <div style={{
                                            padding: '10px 14px',
                                            borderRadius: isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                            background: isMine ? '#6366f1' : 'white',
                                            color: isMine ? 'white' : '#1e293b',
                                            fontSize: '0.9rem',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                            border: isMine ? 'none' : '1px solid #e2e8f0',
                                            position: 'relative',
                                            group: 'true'
                                        }}>
                                            {msg.Message}
                                        </div>
                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                                            {formatChatTime(msg.Timestamp)}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                        {isTyping && <div style={{ fontSize: '0.75rem', color: '#6366f1', fontStyle: 'italic' }}>{activePartner.EmployeeName} is typing...</div>}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} style={{ padding: '15px', background: 'white', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={inputText}
                            onChange={handleTextChange}
                            placeholder="Type a message..."
                            style={{
                                flex: 1,
                                padding: '10px 15px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                outline: 'none',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button type="submit" style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: '#6366f1',
                            color: 'white',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}>
                            <Send size={18} />
                        </button>
                    </form>
                </>
            )}

            {/* Custom Confirm Modal for ChatBox */}
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
                                onClick={(e) => { e.stopPropagation(); setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null }); }}
                                style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}
                                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.target.style.background = '#f1f5f9'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
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

export default ChatBox;
