# Gmail SMTP Setup Guide

## Quick Fix - Most Common Issue

Your `.env` file has the correct format, but the `EMAIL_FROM` line might be causing issues. Try this format instead:

```env
EMAIL_FROM=Queue Management System <yousifadel29@gmail.com>
```

**Remove the quotes around "Queue Management System"** - they can cause parsing issues with some email servers.

## Prerequisites

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password** (you already have one: `rmzdvmvqxhfcrpkz`)
3. **Enable IMAP** in Gmail settings

## Step-by-Step Gmail Configuration

### 1. Verify 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Ensure "2-Step Verification" is **ON**
3. If not enabled, enable it first

### 2. Generate App Password (If Needed)

You already have an App Password (`rmzdvmvqxhfcrpkz`), but if you need a new one:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on "2-Step Verification"
3. Scroll down to "App passwords"
4. Click "App passwords"
5. Select "Mail" and "Other (Custom name)"
6. Enter "Queue Management System"
7. Click "Generate"
8. Copy the 16-character password (no spaces)
9. Update `EMAIL_PASSWORD` in your `.env` file

### 3. Enable IMAP/SMTP Access

1. Go to [Gmail Settings](https://mail.google.com/mail/u/0/#settings/fwdandpop)
2. Click the "Forwarding and POP/IMAP" tab
3. Ensure "IMAP access" is **Enabled**
4. Click "Save Changes"

### 4. Check Gmail Security Settings

1. Go to [Less secure app access](https://myaccount.google.com/lesssecureapps)
2. **Note:** This setting may not be available if 2FA is enabled (which is correct)
3. If you're using App Passwords, you don't need "Less secure app access"

## Environment Variables

Your `.env` should look like this:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=yousifadel29@gmail.com
EMAIL_PASSWORD=rmzdvmvqxhfcrpkz
EMAIL_FROM=Queue Management System <yousifadel29@gmail.com>
```

**Important:** Remove quotes around the name in `EMAIL_FROM`

## Testing SMTP Connection

### Method 1: Using the Test Script

```bash
cd d:\Yousif\ITI\GP\Queue-Management-System-Backend
node scripts/testEmail.js
```

### Method 2: Using Node REPL

```bash
cd d:\Yousif\ITI\GP\Queue-Management-System-Backend
node
```

Then in the Node REPL:
```javascript
require('dotenv').config();
const { testConnection } = require('./src/utils/emailService');
testConnection();
```

## Common Errors and Solutions

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Causes:**
- Incorrect email or password
- Not using App Password when 2FA is enabled
- App Password has been revoked

**Solutions:**
1. Verify `EMAIL_USER` matches your Gmail address exactly
2. Generate a new App Password
3. Ensure no extra spaces in the password
4. Update `.env` and restart the server

### Error: "Connection timeout" or "ETIMEDOUT"

**Causes:**
- Firewall blocking port 587
- Network connectivity issues
- Incorrect SMTP host

**Solutions:**
1. Check your firewall settings
2. Try port 465 with `secure: true` (requires code change)
3. Verify internet connection
4. Try from a different network

### Error: "self signed certificate in certificate chain"

**Causes:**
- Corporate proxy or firewall intercepting SSL

**Solutions:**
1. Add to your `.env`:
   ```env
   NODE_TLS_REJECT_UNAUTHORIZED=0
   ```
   **Warning:** Only use this for development, not production!

### Email Not Received (No Error)

**Causes:**
- Email in spam folder
- Gmail blocking the email
- Incorrect recipient address

**Solutions:**
1. Check spam/junk folder
2. Check [Gmail Activity](https://myaccount.google.com/notifications) for security alerts
3. Try sending to a different email address
4. Check server logs for "✅ Email sent successfully"

## Alternative: Using a Different Email Provider

If Gmail continues to cause issues, consider these alternatives:

### SendGrid (Recommended for Production)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Get API key
3. Update `.env`:
   ```env
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_USER=apikey
   EMAIL_PASSWORD=your_sendgrid_api_key
   EMAIL_FROM=your_verified_sender@yourdomain.com
   ```

### Mailgun

1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Get SMTP credentials
3. Update `.env` with Mailgun settings

### AWS SES

1. Set up [AWS SES](https://aws.amazon.com/ses/)
2. Verify your domain
3. Get SMTP credentials
4. Update `.env` with SES settings

## Debugging Checklist

- [ ] 2FA is enabled on Gmail account
- [ ] App Password is generated and copied correctly
- [ ] IMAP is enabled in Gmail settings
- [ ] No quotes around the name in `EMAIL_FROM`
- [ ] `.env` file is in the root directory
- [ ] Server has been restarted after `.env` changes
- [ ] `testConnection()` returns success
- [ ] No firewall blocking port 587
- [ ] No Gmail security alerts

## Still Having Issues?

1. **Check server logs** - Look for detailed error messages
2. **Run the test script** - `node scripts/testEmail.js`
3. **Try a different email** - Test with a non-Gmail address
4. **Check Gmail activity** - Look for security blocks
5. **Generate new App Password** - The old one might be revoked
6. **Contact support** - Provide the error code from logs
