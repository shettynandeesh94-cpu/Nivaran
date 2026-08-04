const keywordMap = [
    { keywords: ['water', 'pipeline', 'borewell', 'tap', 'supply'], category: 'Water Supply' },
    { keywords: ['pothole', 'road', 'street damage', 'broken road'], category: 'Roads' },
    { keywords: ['garbage', 'waste', 'drainage', 'sewage', 'dump'], category: 'Sanitation' },
    { keywords: ['streetlight', 'light not working', 'dark street'], category: 'Streetlights' },
    { keywords: ['hospital', 'phc', 'asha', 'health'], category: 'Health' },
    { keywords: ['nrega', 'mgnrega', 'wage', 'job card'], category: 'NREGA/MGNREGA' },
    { keywords: ['irrigation', 'canal', 'crop', 'farm'], category: 'Agriculture' },
];

const urgencyKeywords = {
    HIGH: ['burst', 'accident', 'no water since', 'overflow', 'collapsed', 'fire', 'injury', 'urgent'],
    MEDIUM: ['delay', 'not working', 'broken', 'blocked'],
};

function detectCategory(text) {
    const lowerText = text.toLowerCase();
    for (const entry of keywordMap) {
        if (entry.keywords.some((kw) => lowerText.includes(kw))) {
            return entry.category;
        }
    }
    return 'General';
}

function detectPriority(text) {
    const lowerText = text.toLowerCase();
    if (urgencyKeywords.HIGH.some((kw) => lowerText.includes(kw))) return 'HIGH';
    if (urgencyKeywords.MEDIUM.some((kw) => lowerText.includes(kw))) return 'MEDIUM';
    return 'LOW';
}

function calculateDeadline(priority) {
    const now = new Date();
    const hoursMap = { HIGH: 48, MEDIUM: 120, LOW: 360 };
    const hours = hoursMap[priority] || 360;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

module.exports = { detectCategory, detectPriority, calculateDeadline };