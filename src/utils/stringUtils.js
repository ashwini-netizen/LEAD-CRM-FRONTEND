export const stripEmojis = (text) => {
    if (typeof text !== 'string') return text;
    // Comprehensive regex for modern emojis and symbols
    return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
};

export const cleanPhoneNumber = (val) => {
    if (!val) return '';
    let cleaned = String(val).replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
        cleaned = cleaned.slice(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = cleaned.slice(1);
    }
    return cleaned;
};

export const validatePhoneNumber = (phone, fieldName = 'Phone number') => {
    if (!phone) {
        return { isValid: false, message: `${fieldName} is required.` };
    }

    const cleaned = cleanPhoneNumber(phone);

    // Must be exactly 10 digits and start with 6, 7, 8, or 9
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
        return { 
            isValid: false, 
            message: `${fieldName} must be exactly 10 digits and start with 6, 7, 8, or 9.` 
        };
    }

    // Check for repetitive or invalid dummy patterns:
    // 1. All same digits (e.g., 9999999999, 8888888888, 7777777777, 6666666666)
    const isAllSame = /^(\d)\1{9}$/.test(cleaned);

    // 2. Same digit repeated consecutively 5 or more times (e.g., 9999222222 has 222222, 9999988888, 9876222222)
    const hasConsecutiveRepeats = /(\d)\1{4,}/.test(cleaned);

    // 3. Repeated blocks like 9999222222, 9998888888, 9999922222
    const hasBlockRepeats = /^(\d)\1{3,}(\d)\2{3,}$/.test(cleaned);

    // 4. Any single digit appearing 6 or more times in total
    const counts = {};
    let maxFreq = 0;
    for (const d of cleaned) {
        counts[d] = (counts[d] || 0) + 1;
        if (counts[d] > maxFreq) maxFreq = counts[d];
    }
    const hasExcessiveDigitCount = maxFreq >= 6;

    // 5. Must have at least 4 distinct digits (rejects dummy numbers like 9898989898, 9999888822, 9998887777)
    const uniqueDigits = new Set(cleaned);
    const hasFewUniqueDigits = uniqueDigits.size < 4;

    // 6. Repeated pattern sequences (e.g., 9898989898, 9876598765)
    const hasRepeatingPattern = /^(\d{2})\1{4}$/.test(cleaned) || /^(\d{5})\1$/.test(cleaned);

    if (isAllSame || hasConsecutiveRepeats || hasBlockRepeats || hasExcessiveDigitCount || hasFewUniqueDigits || hasRepeatingPattern) {
        return {
            isValid: false,
            message: `${fieldName} cannot contain repeated digits (such as 9999222222). Please enter a valid 10-digit phone number.`
        };
    }

    return { isValid: true, cleaned };
};
