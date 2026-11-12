// Utilities for reliable, immediate, cross-component notification sync

const READ_STORAGE_KEY = 'crm_read_notification_ids';
const ALL_READ_TIMESTAMP_KEY = 'crm_all_notifications_read_at';

export const getLocalReadIds = () => {
    try {
        const raw = sessionStorage.getItem(READ_STORAGE_KEY) || localStorage.getItem(READ_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
};

const saveLocalReadIds = (set) => {
    try {
        const arr = Array.from(set);
        const json = JSON.stringify(arr);
        sessionStorage.setItem(READ_STORAGE_KEY, json);
        localStorage.setItem(READ_STORAGE_KEY, json);
    } catch (e) {
        console.error('Failed to save read IDs:', e);
    }
};

export const getAllReadTimestamp = () => {
    try {
        const val = sessionStorage.getItem(ALL_READ_TIMESTAMP_KEY) || localStorage.getItem(ALL_READ_TIMESTAMP_KEY);
        return val ? parseInt(val, 10) : 0;
    } catch {
        return 0;
    }
};

export const isNotificationUnread = (notif) => {
    if (!notif) return false;
    if (notif.IsRead) return false;

    const readIds = getLocalReadIds();
    if (readIds.has(notif.NotificationID)) return false;

    const allReadAt = getAllReadTimestamp();
    if (allReadAt && notif.CreatedAt) {
        const notifTime = new Date(notif.CreatedAt).getTime();
        if (notifTime <= allReadAt) return false;
    }

    return true;
};

export const markNotificationAsRead = async (id, apiUrl, token) => {
    const nid = parseInt(id, 10);
    // 1. Immediately store in local cache
    const readIds = getLocalReadIds();
    readIds.add(nid);
    saveLocalReadIds(readIds);

    // 2. Immediately notify all listening components
    window.dispatchEvent(new CustomEvent('refresh_notifications', { detail: { markedId: nid } }));

    // 3. Persist to backend server
    if (apiUrl && token) {
        try {
            await fetch(`${apiUrl}/api/notifications/${nid}/read`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to persist notification read to server:', err);
        }
    }
};

export const markAllNotificationsAsRead = async (apiUrl, token) => {
    // 1. Immediately record all-read timestamp
    const now = Date.now();
    sessionStorage.setItem(ALL_READ_TIMESTAMP_KEY, String(now));
    localStorage.setItem(ALL_READ_TIMESTAMP_KEY, String(now));

    // Clear individual IDs since timestamp covers them
    saveLocalReadIds(new Set());

    // 2. Immediately notify all components
    window.dispatchEvent(new CustomEvent('refresh_notifications', { detail: { allRead: true } }));

    // 3. Persist to backend server
    if (apiUrl && token) {
        try {
            await fetch(`${apiUrl}/api/notifications/read-all`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to persist read-all to server:', err);
        }
    }
};

export const syncWithServerList = (serverList) => {
    if (!Array.isArray(serverList)) return;
    const readIds = getLocalReadIds();
    let changed = false;

    serverList.forEach(n => {
        if (n.IsRead && readIds.has(n.NotificationID)) {
            readIds.delete(n.NotificationID);
            changed = true;
        }
    });

    if (changed) {
        saveLocalReadIds(readIds);
    }
};

/**
 * Clean & format follow-up reminder messages to strict format:
 * "Medical clinic (Scheduled: 12/11/2026 at 9:00 AM)"
 * Removes "Please complete the scheduled follow-up call with" or "Follow-up Reminder:"
 */
export const formatNotificationMessage = (msg, type) => {
    if (!msg || typeof msg !== 'string') return '';
    if (type === 'FollowupReminder' || msg.includes('Scheduled:')) {
        let cleaned = msg.replace(/^Follow-up Reminder:\s*/i, '');
        cleaned = cleaned.replace(/^Please complete the scheduled follow-up call with\s*/i, '');
        // Clean repeated meridians like "AM AM", "PM AM", "AM AM AM AM" -> "AM" or "PM"
        cleaned = cleaned.replace(/\b([AP]M)(?:\s+[AP]M)+\b/gi, '$1');
        cleaned = cleaned.replace(/at\s+(\d{1,2}:\d{2})\s+([AP]M)/gi, 'at $1 $2');
        cleaned = cleaned.replace(/\.\s*$/, '');
        return cleaned.trim();
    }
    return msg;
};

/**
 * Normalizes time strings to a clean 12-hour format: "9:00 AM", "12:15 PM".
 * Strips out duplicated or repeated meridians like "AM AM", "PM AM", "AM AM AM AM".
 * Supports both 12-hr and 24-hr inputs.
 */
export const formatCleanTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const trimmed = timeStr.trim();
    if (!trimmed) return '';

    // Match hours and minutes (e.g. "9:00", "09:18", "14:30")
    const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return trimmed.replace(/\b([AP]M)(?:\s+[AP]M)+\b/gi, '$1');

    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2];

    // Find the FIRST meridian (AM/PM) in the string if present
    const ampmMatch = trimmed.match(/\b(AM|PM)\b/i);
    let ampm = ampmMatch ? ampmMatch[1].toUpperCase() : null;

    if (!ampm) {
        // No AM/PM found, convert 24-hr time to 12-hr
        if (h >= 12) {
            ampm = 'PM';
            if (h > 12) h -= 12;
        } else {
            ampm = 'AM';
            if (h === 0) h = 12;
        }
    } else {
        // Normalize 12-hr hour range just in case (e.g. 0 -> 12)
        if (h > 12) {
            h = h % 12 || 12;
        } else if (h === 0) {
            h = 12;
        }
    }

    return `${h}:${m} ${ampm}`;
};

