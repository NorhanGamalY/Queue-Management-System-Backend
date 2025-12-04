// Quick test to diagnose Gmail SMTP issue
const nodemailer = require('nodemailer');

console.log('='.repeat(60));
console.log('Gmail SMTP Diagnostic Test');
console.log('='.repeat(60));
console.log('');

let mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'yousifadel29@gmail.com',
        pass: "zheglnpnnkmkjeaz"
    },
    // Fix for self-signed certificate error
    tls: {
        rejectUnauthorized: false
    }
});

console.log('Step 1: Testing SMTP connection...');
mailTransporter.verify(function(error, success) {
    if (error) {
        console.log('❌ SMTP Connection Failed!');
        console.log('');
        console.log('Error Code:', error.code);
        console.log('Error Message:', error.message);
        console.log('');
        console.log('Full Error:', error);
        console.log('');
        
        // Provide specific guidance based on error
        if (error.code === 'EAUTH') {
            console.log('🔐 AUTHENTICATION ERROR');
            console.log('');
            console.log('This means Gmail rejected your email/password.');
            console.log('');
            console.log('Solutions:');
            console.log('1. Generate a NEW App Password:');
            console.log('   - Go to: https://myaccount.google.com/apppasswords');
            console.log('   - Select "Mail" and "Other (Custom name)"');
            console.log('   - Copy the 16-character password (no spaces)');
            console.log('   - Update your .env file with the new password');
            console.log('');
            console.log('2. Verify 2-Factor Authentication is enabled:');
            console.log('   - Go to: https://myaccount.google.com/security');
            console.log('   - Ensure "2-Step Verification" is ON');
            console.log('');
            console.log('3. Check for Gmail security alerts:');
            console.log('   - Go to: https://myaccount.google.com/notifications');
            console.log('   - Look for blocked sign-in attempts');
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
            console.log('🌐 CONNECTION ERROR');
            console.log('');
            console.log('Solutions:');
            console.log('1. Check your internet connection');
            console.log('2. Check if firewall is blocking port 587');
            console.log('3. Try from a different network');
        }
        
        process.exit(1);
    } else {
        console.log('✅ SMTP Connection Successful!');
        console.log('');
        console.log('Step 2: Sending test email...');
        
        let mailDetails = {
            from: 'yousifadel29@gmail.com',
            to: 'yousifadel232@gmail.com',
            subject: 'Test Mail - Queue Management System',
            text: 'This is a test email from your Queue Management System. If you received this, email is working correctly!'
        };

        mailTransporter.sendMail(mailDetails, function (err, data) {
            if (err) {
                console.log('❌ Email Sending Failed!');
                console.log('');
                console.log('Error:', err);
                process.exit(1);
            } else {
                console.log('✅ Email Sent Successfully!');
                console.log('');
                console.log('Message ID:', data.messageId);
                console.log('Response:', data.response);
                console.log('');
                console.log('📬 Check your inbox at: yousifadel232@gmail.com');
                console.log('');
                console.log('='.repeat(60));
                console.log('Test completed successfully!');
                console.log('='.repeat(60));
                process.exit(0);
            }
        });
    }
});
