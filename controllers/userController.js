const User = require('../Models/User');
const generateToken = require('../utils/generateToken');

    // Register User
const registerUser = async (req, res) => {
    const { name, email, password, isAdmin = false } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            isAdmin,  // This allows you to create an admin user
        });

        if (user) {
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user.id, user.isAdmin),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};


// Login User
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log('Login request received:', { email, password }); // Debug log

        const user = await User.findOne({ email });
        console.log('Fetched user:', user); // Debug log

        if (user && (await user.matchPassword(password))) {
            console.log('Password matched, generating token');
            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user.id, user.isAdmin),
            });
        } else {
            console.error('Invalid email or password');
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login server error:', error); // Debug log
        res.status(500).json({ message: 'Server Error', error });
    }
};

module.exports = { registerUser, loginUser };
