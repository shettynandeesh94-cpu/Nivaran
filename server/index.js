const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const startEscalationJob = require('./utils/escalationJob');

const seedData = require('./utils/seedData');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Ensure database connection is ready before processing API requests
app.use('/api', (req, res, next) => {
    // Allow health check to pass even if DB is reconnecting
    if (req.path === '/health') {
        return next();
    }
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: 'Database service is connecting. Please retry in a few moments.',
            status: 'database_unavailable'
        });
    }
    next();
});

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
app.use('/api/technicians', technicianRoutes);

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
    mongoose.connection.on('error', (err) => {
        console.error('MongoDB Atlas connection warning:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB Atlas connection lost. Attempting reconnection...');
    });
    mongoose.connection.on('reconnected', () => {
        console.log('MongoDB Atlas reconnected successfully.');
    });

    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ Successfully connected to MongoDB Atlas (Permanent Cloud Storage)');
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