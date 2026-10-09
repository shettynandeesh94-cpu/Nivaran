const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
            { id: user._id, role: user.role, ward: user.ward, district: user.district, taluk: user.taluk, panchayat: user.panchayat },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
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