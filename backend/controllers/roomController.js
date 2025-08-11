const Room = require('../models/room');

// Get all rooms
const getRooms = async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;

    const rooms = await Room.find(query).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch rooms', error: err.message });
  }
};

module.exports = { getRooms };
