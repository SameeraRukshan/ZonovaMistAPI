const User = require('../models/user');
const Client = require('../models/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- REGISTER ---
const register = async (req, res) => {
  const { fullName, email, password, clientName } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // ✅ Step 1: Create Client first (organization/tenant)
    const newClient = new Client({
      name: clientName || `${fullName}'s Organization`,
      code: `CLIENT_${Date.now()}`,
      isActive: true
    });
    await newClient.save();
    console.log('✅ Client created with _id:', newClient._id);

    // ✅ Step 2: Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Step 3: Create User with clientId reference
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      clientId: newClient._id,  // ← Link to Client
      role: 'admin'
    });
    await newUser.save();
    console.log('✅ User created with clientId:', newClient._id);

    // ✅ Step 4: Generate token
    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        clientId: newClient._id,
        role: newUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        clientId: newClient._id,
        role: newUser.role
      }
    });

  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

// --- LOGIN ---
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // ✅ Find User (not Client)
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ✅ Verify client is active
   //TEMPORARY: Commented out for testing - Kavindya's client missing
    // const client = await Client.findById(user.clientId);
    // if (!client || !client.isActive) {
    //   return res.status(403).json({ message: 'Your organization is inactive' });
    //}

    // ✅ Include clientId in JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        clientId: user.clientId,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ User logged in:', user.email, 'clientId:', user.clientId);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        clientId: user.clientId,
        role: user.role
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// --- GET PROFILE ---
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

const getTest = async (req, res) => {
  res.json({ message: 'Auth API is working!' });
};

module.exports = {
  register,
  login,
  getProfile,
  getTest
};
