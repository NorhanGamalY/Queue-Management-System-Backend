// utils/emailService.js
const nodemailer = require("nodemailer");

/**
 * Create and configure email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send OTP email for password reset
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email address
 * @param {string} options.otp - 6-digit OTP code
 * @param {string} options.name - Recipient name (optional)
 */
const sendOTPEmail = async ({ email, otp, name }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Queue Management System" <noreply@qms.com>',
      to: email,
      subject: "Password Reset OTP - Queue Management System",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #359487 0%, #2a8074 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🔐 Password Reset</h1>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #333333;">
                        ${name ? `Hi ${name},` : 'Hello,'}
                      </p>
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #333333;">
                        We received a request to reset your password. Use the OTP code below to reset your password:
                      </p>
                      
                      <!-- OTP Box -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                        <tr>
                          <td align="center" style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 2px dashed #359487;">
                            <p style="margin: 0 0 10px; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                            <p style="margin: 0; font-size: 36px; font-weight: bold; color: #359487; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                              ${otp}
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #333333;">
                        This OTP will expire in <strong style="color: #359487;">10 minutes</strong>.
                      </p>
                      
                      <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #666666;">
                        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                      <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                        Queue Management System
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #999999;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
        Password Reset OTP
        
        ${name ? `Hi ${name},` : 'Hello,'}
        
        We received a request to reset your password. Use the OTP code below to reset your password:
        
        Your OTP Code: ${otp}
        
        This OTP will expire in 10 minutes.
        
        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        
        Queue Management System
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    console.error("Error details:", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = {
  sendOTPEmail,
};
