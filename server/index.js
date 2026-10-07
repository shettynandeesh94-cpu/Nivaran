require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const startEscalationJob = require('./utils/escalationJob');

const seedData = require('./utils/seedData');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const fs = require('fs');

const clientDistPath = path.join(__dirname, '../client/dist');
const indexHtmlPath = path.join(clientDistPath, 'index.html');

// Serve static frontend files if built together
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/budget', budgetRoutes);

// Root route handler
app.get('/', (req, res) => {
    if (fs.existsSync(indexHtmlPath)) {
        return res.sendFile(indexHtmlPath);
    }
    res.json({
        name: 'Nivaran Smart Civic Redressal API',
        status: 'online',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'in-memory/offline',
        timestamp: new Date().toISOString()
    });
});

// SPA fallback route (serve index.html for non-api routes if frontend is present)
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    if (fs.existsSync(indexHtmlPath)) {
        return res.sendFile(indexHtmlPath);
    }
    res.status(404).json({ error: 'Endpoint not found on Nivaran API' });
});

async function startServer() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 4000 });
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.warn('MongoDB Atlas connection failed:', err.message);
        console.log('Falling back to local in-memory MongoDB server...');
        try {
            const fs = require('fs');
            const { MongoMemoryServer } = require('mongodb-memory-server');
            const dbPath = path.join(__dirname, '.mongo_temp');
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
            }
            const mongoServer = await MongoMemoryServer.create({
                instance: { dbPath }
            });
            const mongoUri = mongoServer.getUri();
            await mongoose.connect(mongoUri);
            console.log('Successfully connected to local in-memory MongoDB!');
        } catch (memErr) {
            console.error('Failed to start in-memory MongoDB:', memErr.message);
        }
    }

const { ensureTechniciansSeeded } = require('./utils/dispatchEngine');

    if (mongoose.connection.readyState === 1) {
        startEscalationJob();
        await seedData();
        await ensureTechniciansSeeded();
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();