import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter, HashRouter } from 'react-router-dom'

// Determine router type dynamically (HashRouter for Electron/Capacitor file:// protocols, BrowserRouter for standard Web)
const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
const isCapacitor = !!window.Capacitor;
const Router = (isElectron || isCapacitor) ? HashRouter : BrowserRouter;

// Global interceptors to bypass ngrok warning pages and avoid CORS errors
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    let targetUrl = '';
    if (typeof input === 'string') {
        targetUrl = input;
    } else if (input && typeof input === 'object' && typeof input.url === 'string') {
        targetUrl = input.url;
    }

    if (targetUrl.includes('ngrok-free.dev')) {
        if (input && typeof input === 'object' && input.headers && typeof input.headers.set === 'function') {
            try {
                input.headers.set('ngrok-skip-browser-warning', 'true');
            } catch (e) {}
        }
        init = init || {};
        init.headers = init.headers || {};
        if (init.headers instanceof Headers) {
            init.headers.set('ngrok-skip-browser-warning', 'true');
        } else if (Array.isArray(init.headers)) {
            init.headers.push(['ngrok-skip-browser-warning', 'true']);
        } else {
            init.headers['ngrok-skip-browser-warning'] = 'true';
        }
    }

    const res = await originalFetch(input, init);

    // Global 401 interceptor: if an authenticated call fails with 401, handle session expiration
    if (res && res.status === 401 && !targetUrl.includes('/api/auth/login') && !targetUrl.includes('/api/auth/admin/forgot-password') && !targetUrl.includes('/api/auth/admin/reset-password')) {
        const hasToken = !!localStorage.getItem('crm_token');
        if (hasToken) {
            localStorage.removeItem('crm_token');
            localStorage.removeItem('crm_user');
            window.dispatchEvent(new CustomEvent('auth_expired', {
                detail: { message: 'Your session has expired. Please log in again.' }
            }));
        }
    }

    return res;
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
};

const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function () {
    if (typeof this._url === 'string' && this._url.includes('ngrok-free.dev')) {
        this.setRequestHeader('ngrok-skip-browser-warning', 'true');
    }
    return originalSend.apply(this, arguments);
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Router>
            <App />
        </Router>
    </React.StrictMode>,
)
