// controllers/settingsController.js
const Settings = require('../models/settings');
const { addTenantId } = require('../middleware/authMiddleware');


exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne(req.tenantFilter);
    res.json(settings ?? {});
  } catch (err) {
    res.status(500).json({ message: 'Error fetching settings', error: err.message });
  }
};


exports.updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne(req.tenantFilter);
    
    if (!settings) {
      // Create new settings with clientId
      const settingsData = addTenantId(req, req.body);
      settings = new Settings(settingsData);
    } else {
      // Update existing settings (don't overwrite clientId)
      Object.assign(settings, req.body);
    }
    
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Error updating settings', error: err.message });
  }
};
