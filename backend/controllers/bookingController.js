const Booking = require('../models/booking');
const { sendAdvancePaidSMS, sendDiscountSMS } = require('../models/smsService');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');
const { addTenantId } = require('../middleware/authMiddleware');

/**
 * GET /bookings - Fetch bookings with filtering and proper sorting
 */
const getAllBookings = async (req, res) => {
  try {
    const { filter = 'recent', status, search, includeDeleted = 'false' } = req.query;
    
    // Start with tenant filter
    let query = { ...req.tenantFilter };
    let sortOrder = {};
    const now = new Date();
    
    // Exclude soft-deleted bookings by default
    if (includeDeleted !== 'true') {
      query.deleted = { $ne: true };
    }
    
    // Date-based filtering with appropriate sorting
    switch (filter) {
      case 'upcoming':
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query.checkin_date = { $gte: startOfToday };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'recent':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: sevenDaysAgo };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        query.checkin_date = { $gte: todayStart, $lte: todayEnd };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        query.createdAt = { $gte: startOfWeek };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
        sortOrder = { checkin_date: 1 };
        break;
        
      case 'past':
        query.checkout_date = { $lt: new Date() };
        sortOrder = { checkout_date: -1 };
        break;
        
      case 'all':
      default:
        sortOrder = { checkin_date: -1 };
        break;
    }
    
    // Status filtering
    if (status && ['pending', 'paid', 'cancelled', 'advance_paid'].includes(status.toLowerCase())) {
      query.status = status.toLowerCase();
    } else if (!status || status === 'null' || status === '') {
      query.status = { $ne: 'cancelled' };
    }
    
    // Search filtering
    if (search) {
      query.$or = [
        { guest_name: { $regex: search, $options: 'i' } },
        { booked_room_no: { $regex: search, $options: 'i' } },
        { phone_no: { $regex: search, $options: 'i' } },
        { guest_nic: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('📊 Fetching bookings with query:', JSON.stringify(query));
    console.log('📊 Sort order:', JSON.stringify(sortOrder));
    
    const bookings = await Booking.find(query).sort(sortOrder);
    
    console.log(`✅ Found ${bookings.length} bookings`);
    res.json(bookings);
  } catch (err) {
    console.error('❌ Error fetching bookings:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /bookings - Create a new booking
 */
const createBooking = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = [
      'guest_name',
      'booked_room_no',
      'checkin_date',
      'checkout_date',
      'phone_no',
      'adult_count'
    ];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    // Validate status
    const validStatuses = ['pending', 'paid', 'cancelled', 'advance_paid'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, cancelled, or advance_paid.' });
    }

    // Create booking with tenant ID
    const bookingData = addTenantId(req, {
      guest_nic: req.body.guest_nic || null,
      guest_name: req.body.guest_name,
      booked_room_no: req.body.booked_room_no,
      checkin_date: req.body.checkin_date,
      checkout_date: req.body.checkout_date,
      phone_no: req.body.phone_no,
      adult_count: req.body.adult_count,
      child_count: req.body.child_count || 0,
      guest_address: req.body.guest_address || '',
      total_price: req.body.total_price || 0,
      special_notes: req.body.special_notes || '',
      advance_amount: req.body.advance_amount || 0,
      birthday: req.body.birthday || null,
      food: req.body.food || 0,
      status: req.body.status ? req.body.status.toLowerCase() : 'pending',
      deleted: false
    });

    const booking = new Booking(bookingData);

    await booking.save();
    console.log('✅ Booking saved:', booking._id);

    // Send SMS if status is advance_paid
    if (booking.status === 'advance_paid') {
      console.log('📨 Triggering advance paid SMS for new booking');
      
      const baseUrl = process.env.BASE_URL || 'https://zonova-mist.onrender.com';
      const invoiceLink = `${baseUrl}/invoice/${booking._id}`;
      
      try {
        await sendAdvancePaidSMS(
          booking.phone_no,
          booking.guest_name,
          booking.booked_room_no,
          booking.advance_amount,
          invoiceLink
        );
        console.log('✅ Advance paid SMS sent for new booking');
      } catch (smsErr) {
        console.error('⚠️ Failed to send SMS, but booking created:', smsErr.message);
      }
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('❌ Booking creation error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

/**
 * PATCH /bookings/:id - Update booking
 */
const updateBooking = async (req, res) => {
  try {
    // Find booking with tenant filter
    const booking = await Booking.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.deleted) {
      return res.status(400).json({ message: 'Cannot update a deleted booking' });
    }

    const validStatuses = ['pending', 'paid', 'cancelled', 'advance_paid'];
    if (req.body.status && !validStatuses.includes(req.body.status.toLowerCase())) {
      console.error('Invalid status:', req.body.status);
      return res.status(400).json({ message: 'Invalid status. Must be pending, paid, cancelled, or advance_paid.' });
    }

    const previousStatus = booking.status;
    
    // Prevent clientId modification
    delete req.body.clientId;
    
    Object.assign(booking, {
      ...req.body,
      status: req.body.status ? req.body.status.toLowerCase() : booking.status,
    });

    await booking.save();
    console.log('✅ Booking updated:', booking._id);

    if (booking.status === 'advance_paid' && previousStatus !== 'advance_paid') {
      console.log('📨 Status changed to advance_paid, sending invoice SMS');
      
      const baseUrl = process.env.BASE_URL || 
                      process.env.BACKEND_URL || 
                      `http://localhost:${process.env.PORT || 3000}`;
      
      const invoiceLink = `${baseUrl}/invoice/${booking._id}`;
      
      try {
        await sendAdvancePaidSMS(
          booking.phone_no,
          booking.guest_name,
          booking.booked_room_no,
          booking.advance_amount,
          invoiceLink
        );
        console.log('✅ Advance paid invoice SMS sent successfully');
      } catch (smsErr) {
        console.error('⚠️ Failed to send SMS:', smsErr.message);
      }
    }

    res.json(booking);
  } catch (err) {
    console.error('❌ Booking update error:', err.message);
    res.status(400).json({ message: err.message });
  }
};

/**
 * DELETE /bookings/:id - Soft delete a booking
 */
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.deleted) {
      return res.status(400).json({ message: 'Booking is already deleted' });
    }

    booking.deleted = true;
    booking.deletedAt = new Date();

    await booking.save();
    console.log('✅ Booking soft deleted:', booking._id);
    
    res.json({ 
      message: 'Booking deleted successfully',
      booking: booking 
    });
  } catch (err) {
    console.error('❌ Booking deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /bookings/:id/restore - Restore a soft-deleted booking
 */
const restoreBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (!booking.deleted) {
      return res.status(400).json({ message: 'Booking is not deleted' });
    }

    booking.deleted = false;
    booking.deletedAt = null;
    booking.deletedBy = null;

    await booking.save();
    console.log('✅ Booking restored:', booking._id);
    
    res.json({ 
      message: 'Booking restored successfully',
      booking: booking 
    });
  } catch (err) {
    console.error('❌ Booking restoration error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /bookings/:id/permanent - Permanently delete a booking
 */
const permanentDeleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findOneAndDelete({ 
      _id: req.params.id, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      console.error('Booking not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Booking not found' });
    }
    console.log('✅ Booking permanently deleted:', booking._id);
    res.json({ message: 'Booking permanently deleted' });
  } catch (err) {
    console.error('❌ Booking permanent deletion error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /bookings/send-discount-sms-test - Test endpoint to manually trigger discount SMS
 */
const sendDiscountSmsTest = async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Booking ID is required' 
      });
    }
    
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }
    
    if (booking.discount_sms_sent) {
      console.log('⚠️ Discount SMS already sent to this booking');
      return res.status(400).json({ 
        success: false, 
        error: 'Discount SMS already sent to this booking',
        sentAt: booking.discountSmsSentAt
      });
    }
    
    console.log(`📨 Test: Sending discount SMS to ${booking.guest_name} (${booking.phone_no})`);
    
    await sendDiscountSMS(booking.phone_no, booking.guest_name);
    
    booking.discount_sms_sent = true;
    booking.discountSmsSentAt = new Date();
    await booking.save();
    
    console.log('✅ Test discount SMS sent successfully');
    
    res.json({ 
      success: true, 
      message: 'Discount SMS sent successfully',
      booking: {
        id: booking._id,
        guest_name: booking.guest_name,
        phone_no: booking.phone_no,
        discount_sms_sent: booking.discount_sms_sent,
        discountSmsSentAt: booking.discountSmsSentAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error sending test discount SMS:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * GET /bookings/eligible-for-discount - Get list of bookings eligible for discount SMS
 */
const getEligibleForDiscount = async (req, res) => {
  try {
    const Setting = require('../models/settings');
    const settings = await Setting.findOne(req.tenantFilter);
    const daysAfterCheckout = settings?.discountSmsDaysAfterCheckout || 10;
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAfterCheckout);
    
    const startOfTargetDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfTargetDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    const eligibleBookings = await Booking.find({
      ...req.tenantFilter,
      checkout_date: {
        $gte: startOfTargetDay,
        $lte: endOfTargetDay
      },
      status: 'paid',
      deleted: { $ne: true },
      discount_sms_sent: { $ne: true }
    }).select('guest_name phone_no checkout_date status discount_sms_sent');
    
    res.json({
      success: true,
      daysAfterCheckout,
      targetDate: startOfTargetDay,
      count: eligibleBookings.length,
      bookings: eligibleBookings
    });
    
  } catch (error) {
    console.error('❌ Error fetching eligible bookings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * POST /bookings/:id/recordings - Upload audio recording
 */
const uploadRecording = async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      });
    }

    const booking = await Booking.findOne({ 
      _id: bookingId, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    if (booking.recordings && booking.recordings.length >= 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 10 recordings per booking allowed' 
      });
    }

    console.log(`📤 Uploading recording for booking ${bookingId}`);
    console.log(`📁 File: ${req.file.originalname}, Size: ${req.file.size} bytes`);

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'zonova_mist/recordings',
          resource_type: 'auto',
          format: req.file.originalname.split('.').pop(),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      const bufferStream = Readable.from(req.file.buffer);
      bufferStream.pipe(uploadStream);
    });

    console.log(`✅ Uploaded to Cloudinary: ${uploadResult.secure_url}`);

    const newRecording = {
      filename: req.file.originalname,
      url: uploadResult.secure_url,
      cloudinary_id: uploadResult.public_id,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date()
    };

    if (!booking.recordings) {
      booking.recordings = [];
    }
    booking.recordings.push(newRecording);
    
    await booking.save();

    console.log(`✅ Recording saved to booking ${bookingId}`);

    res.json({
      success: true,
      message: 'Recording uploaded successfully',
      recording: newRecording
    });

  } catch (error) {
    console.error('❌ Error uploading recording:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * DELETE /bookings/:id/recordings/:recordingId - Delete audio recording
 */
const deleteRecording = async (req, res) => {
  try {
    const { id: bookingId, recordingId } = req.params;

    const booking = await Booking.findOne({ 
      _id: bookingId, 
      ...req.tenantFilter 
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    const recording = booking.recordings.id(recordingId);
    if (!recording) {
      return res.status(404).json({ 
        success: false, 
        error: 'Recording not found' 
      });
    }

    console.log(`🗑️ Deleting recording ${recordingId} from booking ${bookingId}`);
    console.log(`☁️ Cloudinary ID: ${recording.cloudinary_id}`);

    try {
      await cloudinary.uploader.destroy(recording.cloudinary_id, {
        resource_type: 'video'
      });
      console.log(`✅ Deleted from Cloudinary: ${recording.cloudinary_id}`);
    } catch (cloudinaryError) {
      console.error('⚠️ Error deleting from Cloudinary:', cloudinaryError.message);
    }

    booking.recordings.pull(recordingId);
    await booking.save();

    console.log(`✅ Recording removed from booking ${bookingId}`);

    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting recording:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * GET /bookings/:id/recordings - Get all recordings for a booking
 */
const getRecordings = async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findOne({ 
      _id: bookingId, 
      ...req.tenantFilter 
    }).select('recordings');
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    res.json({
      success: true,
      recordings: booking.recordings || []
    });

  } catch (error) {
    console.error('❌ Error fetching recordings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = {
  getAllBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  restoreBooking,
  permanentDeleteBooking,
  sendDiscountSmsTest,
  getEligibleForDiscount,
  uploadRecording,
  deleteRecording,
  getRecordings
};