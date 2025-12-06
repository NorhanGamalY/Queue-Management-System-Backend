// scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/userSchema');

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Admin user details
    const adminData = {
      name: 'Admin User',
      email: 'admin@admin.com',
      password: 'Admin@123456', // Change this to a secure password
      phone: '01000000000', // Change this to a valid phone number
      role: 'admin',
      isEmailVerified: true,
      status: 'active'
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists with email:', adminData.email);
      console.log('Admin ID:', existingAdmin._id);
      console.log('Admin Role:', existingAdmin.role);
      
      // Update to admin role if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      }
    } else {
      // Create new admin user
      const admin = await User.create(adminData);
      console.log('✅ Admin user created successfully!');
      console.log('Admin ID:', admin._id);
      console.log('Email:', admin.email);
    }

    console.log('\n📝 Login Credentials:');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);
    console.log('\n🔐 Use these credentials to login via POST /api/v1/auth/login');
    console.log('The response will contain your admin access token.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

createAdminUser();
