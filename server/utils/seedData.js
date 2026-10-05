const User = require('../models/User');

async function seedData() {
    try {
        // Safe startup seed - do not delete registered users
        console.log('Database initialized.');
    } catch (err) {
        console.error('Error in seedData:', err.message);
    }
}

module.exports = seedData;

