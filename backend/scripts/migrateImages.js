const mongoose = require('mongoose');
require('dotenv').config();
const Image = require('../models/image');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Starting migration...');

    const images = await Image.find();
    for (const img of images) {
      let moduleId = null;
      let moduleType = null;

      if (img.roomId) {
        moduleId = img.roomId;
        moduleType = 'Room';
      } else if (img.hotelId) {
        moduleId = img.hotelId;
        moduleType = 'Hotel';
      } else if (img.bookingId) {
        moduleId = img.bookingId;
        moduleType = 'Booking';
      }

      if (moduleId && moduleType) {
        img.moduleId = moduleId;
        img.moduleType = moduleType;
        img.roomId = undefined;
        img.hotelId = undefined;
        img.bookingId = undefined;
        await img.save();
        console.log(`Migrated image ${img._id} (${moduleType})`);
      }
    }

    console.log('Migration complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
  });
