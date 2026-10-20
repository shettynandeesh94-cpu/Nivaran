const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/emailService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

// Signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password, role, ward, district, taluk, panchayat } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Standardize ward identifier from panchayat / ward
        const effectiveWard = panchayat || ward || (taluk ? `${taluk} Rural` : 'General Ward');

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'citizen',
            district: district || '',
            taluk: taluk || '',
            panchayat: panchayat || '',
            ward: effectiveWard,
        });

        await newUser.save();

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const searchStr = email ? email.trim() : '';
        const user = await User.findOne({
            $or: [
                { email: new RegExp('^' + searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
                { email: searchStr },
                { name: new RegExp('^' + searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
                { name: searchStr }
            ]
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { 
                id: user._id, 
                name: user.name,
                email: user.email,
                role: user.role, 
                ward: user.ward, 
                district: user.district, 
                taluk: user.taluk, 
                panchayat: user.panchayat 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                ward: user.ward,
                district: user.district,
                taluk: user.taluk,
                panchayat: user.panchayat
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Google OAuth Sign-In / Sign-Up
exports.googleLogin = async (req, res) => {
    try {
        const { credential, idToken } = req.body || {};
        const tokenToVerify = credential || idToken;

        if (!tokenToVerify) {
            return res.status(400).json({ message: 'Google authentication credential is required.' });
        }

        let payload;
        const clientId = process.env.GOOGLE_CLIENT_ID;

        try {
            if (clientId) {
                const client = new OAuth2Client(clientId);
                const ticket = await client.verifyIdToken({
                    idToken: tokenToVerify,
                    audience: clientId,
                });
                payload = ticket.getPayload();
            } else {
                // Verify directly via Google TokenInfo API if client id not explicitly set
                const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
                if (!resp.ok) {
                    return res.status(401).json({ message: 'Failed to verify Google identity credential.' });
                }
                payload = await resp.json();
            }
        } catch (verifyErr) {
            console.error('Google token verification error:', verifyErr.message);
            try {
                const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
                if (resp.ok) {
                    payload = await resp.json();
                } else {
                    return res.status(401).json({ message: 'Google verification failed: ' + verifyErr.message });
                }
            } catch (fallbackErr) {
                return res.status(401).json({ message: 'Invalid or expired Google credential.' });
            }
        }

        if (!payload || !payload.email) {
            return res.status(400).json({ message: 'Could not extract verified email from Google credential.' });
        }

        const email = String(payload.email).trim().toLowerCase();
        const name = payload.name || email.split('@')[0];
        const googleId = payload.sub;
        const picture = payload.picture || '';

        // Find existing user by email
        let user = await User.findOne({
            email: { $regex: new RegExp(`^${email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });

        if (user) {
            let updated = false;
            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (!user.avatar && picture) {
                user.avatar = picture;
                updated = true;
            }
            if (updated) {
                await user.save();
            }
        } else {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = new User({
                name,
                email,
                password: hashedPassword,
                role: 'citizen',
                ward: 'General Ward',
                googleId,
                avatar: picture,
                authProvider: 'google',
            });

            await user.save();
            console.log(`[GoogleAuth] 👤 Created new user via Google Sign-In: ${user.name} (${user.email})`);
        }

        const token = jwt.sign(
            { 
                id: user._id, 
                name: user.name,
                email: user.email,
                role: user.role, 
                ward: user.ward, 
                district: user.district, 
                taluk: user.taluk, 
                panchayat: user.panchayat 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                ward: user.ward,
                district: user.district,
                taluk: user.taluk,
                panchayat: user.panchayat,
                avatar: user.avatar || picture
            },
        });
    } catch (err) {
        console.error('Error in googleLogin:', err);
        res.status(500).json({ message: 'Server error during Google authentication', error: err.message });
    }
};

// Send OTP to Email (Gmail)
exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body || {};
        const cleanEmail = String(email || '').trim().toLowerCase();

        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            return res.status(400).json({ message: 'A valid email address is required.' });
        }

        // Generate 6-digit numeric OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Remove any previous OTPs for this email
        await Otp.deleteMany({ email: cleanEmail });

        // Save new OTP
        await Otp.create({
            email: cleanEmail,
            otp,
        });

        // Find user if already registered to personalize email
        const existingUser = await User.findOne({
            email: { $regex: new RegExp(`^${cleanEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });

        const userName = existingUser ? existingUser.name : 'Citizen';
        const mailResult = await sendOtpEmail(cleanEmail, otp, userName);

        res.json({
            success: true,
            message: mailResult.sent 
                ? `Verification code sent to ${cleanEmail}. Please check your inbox.`
                : `Login code generated: ${otp} (Enter this code to log in).`,
            simulated: mailResult.simulated,
            email: cleanEmail,
            // Include demo OTP in development/demo mode if real mail transport not yet configured
            demoOtp: mailResult.simulated ? otp : undefined
        });
    } catch (err) {
        console.error('Error in sendOtp:', err);
        res.status(500).json({ message: 'Failed to send OTP code. Please try again.', error: err.message });
    }
};

// Verify OTP and Log In / Register
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body || {};
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanOtp = String(otp || '').trim();

        if (!cleanEmail || !cleanOtp) {
            return res.status(400).json({ message: 'Email and 6-digit OTP code are required.' });
        }

        // Find OTP record
        const otpRecord = await Otp.findOne({ email: cleanEmail });
        if (!otpRecord) {
            return res.status(400).json({ message: 'OTP has expired or does not exist. Please request a new code.' });
        }

        if (otpRecord.attempts >= 5) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP code.' });
        }

        if (otpRecord.otp !== cleanOtp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({ message: 'Incorrect OTP code. Please check and try again.' });
        }

        // OTP is valid - delete it so it cannot be reused
        await Otp.deleteOne({ _id: otpRecord._id });

        // Find or create user
        let user = await User.findOne({
            email: { $regex: new RegExp(`^${cleanEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = new User({
                name: cleanEmail.split('@')[0],
                email: cleanEmail,
                password: hashedPassword,
                role: 'citizen',
                ward: 'General Ward',
                authProvider: 'email_otp'
            });

            await user.save();
            console.log(`[OtpAuth] 👤 Registered new user via Email OTP: ${user.name} (${user.email})`);
        }

        const token = jwt.sign(
            { 
                id: user._id, 
                name: user.name,
                email: user.email,
                role: user.role, 
                ward: user.ward, 
                district: user.district, 
                taluk: user.taluk, 
                panchayat: user.panchayat 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                ward: user.ward,
                district: user.district,
                taluk: user.taluk,
                panchayat: user.panchayat,
                avatar: user.avatar
            },
        });
    } catch (err) {
        console.error('Error in verifyOtp:', err);
        res.status(500).json({ message: 'Server error during OTP verification', error: err.message });
    }
};