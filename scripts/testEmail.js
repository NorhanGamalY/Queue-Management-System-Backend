// Test script for email service
require('dotenv').config();
const { testConnection, sendOTPEmail } = require('../src/utils/emailService');

async function runTests() {
  console.log('='.repeat(60));
  console.log('📧 Email Service Test Suite');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: SMTP Connection
  console.log('Test 1: SMTP Connection');
  console.log('-'.repeat(60));
  const connectionSuccess = await testConnection();
  console.log('');

  if (!connectionSuccess) {
    console.log('❌ SMTP connection failed. Please fix the connection issues first.');
    console.log('📖 See EMAIL_SETUP.md for troubleshooting steps.');
    process.exit(1);
  }

  // Test 2: Send Test OTP Email
  console.log('Test 2: Send Test OTP Email');
  console.log('-'.repeat(60));
  
  const testEmail = process.env.EMAIL_USER; // Send to yourself for testing
  const testOTP = '123456';
  const testName = 'Test User';

  try {
    console.log(`Sending test OTP to: ${testEmail}`);
    const result = await sendOTPEmail({
      email: testEmail,
      otp: testOTP,
      name: testName,
    });

    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log(`📬 Check your inbox at ${testEmail}`);
      console.log(`🔢 Test OTP: ${testOTP}`);
      console.log(`📨 Message ID: ${result.messageId}`);
    }
  } catch (error) {
    console.log('❌ Failed to send test email');
    console.error('Error:', error.message);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Test suite completed');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
