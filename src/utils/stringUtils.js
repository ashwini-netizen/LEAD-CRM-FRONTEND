export const stripEmojis = (text) => {
    if (typeof text !== 'string') return text;
    // Comprehensive regex for modern emojis and symbols
    return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
};
