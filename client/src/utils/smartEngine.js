// Nivaran Smart Engine - Client Side Emulation for Real-time Previews

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

const detectCategory = (text) => {
    const lowerText = text.toLowerCase();
    for (const entry of keywordMap) {
        if (entry.keywords.some((kw) => lowerText.includes(kw))) {
            return entry.category;
        }
    }
    return 'General';
};

const detectPriority = (text) => {
    const lowerText = text.toLowerCase();
    if (urgencyKeywords.HIGH.some((kw) => lowerText.includes(kw))) return 'HIGH';
    if (urgencyKeywords.MEDIUM.some((kw) => lowerText.includes(kw))) return 'MEDIUM';
    return 'LOW';
};

const getSLADurationText = (priority) => {
    const hoursMap = { HIGH: 48, MEDIUM: 120, LOW: 360 };
    const hours = hoursMap[priority] || 360;
    
    if (hours === 48) return '2 Days (48 hrs)';
    if (hours === 120) return '5 Days (120 hrs)';
    return '15 Days (360 hrs)';
};

export const SmartEngine = {
    analyzeText: (text) => {
        if (!text || text.trim() === '') {
            return {
                category: 'General',
                priority: 'LOW',
                slaText: '15 Days (360 hrs)',
            };
        }

        const category = detectCategory(text);
        const priority = detectPriority(text);
        const slaText = getSLADurationText(priority);

        return {
            category,
            priority,
            slaText,
        };
    }
};
