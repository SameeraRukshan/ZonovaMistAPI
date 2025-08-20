const Profile = require('../models/profile');

// Create or update profile
const createOrUpdateProfile = async (req, res) => {
  try {
    const { bio, location, phone } = req.body;

    let profile = await Profile.findOne({ user: req.user.id });

    if (profile) {
      // Update existing profile
      profile.bio = bio || profile.bio;
      profile.location = location || profile.location;
      profile.phone = phone || profile.phone;

      await profile.save();
      return res.json(profile);
    }

    // Create new profile
    profile = new Profile({
      user: req.user.id,
      bio,
      location,
      phone
    });

    await profile.save();
    res.json(profile);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// Get profile by user
const getMyProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id }).populate('user', ['fullName', 'email']);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

module.exports = {
  createOrUpdateProfile,
  getMyProfile
};
