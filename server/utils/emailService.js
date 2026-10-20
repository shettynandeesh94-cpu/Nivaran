const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
    const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;

    if (!user || !pass) {
        return null;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass
            }
        });
    }
    return transporter;
}

/**
 * Sends a 6-digit OTP verification email to user
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {string} userName 
 */
async function sendOtpEmail(toEmail, otp, userName = 'Citizen') {
    const mailClient = getTransporter();

    if (!mailClient) {
        console.warn(`[OTP Service] ⚠️ EMAIL_USER or EMAIL_PASS not configured in .env.`);
        console.log(`[OTP Service] 🔑 Login OTP for ${toEmail}: [ ${otp} ] (Valid for 10 minutes)`);
        return { 
            sent: false, 
            simulated: true, 
            message: 'Email credentials not configured in backend .env. OTP logged to server console.' 
        };
    }

    const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0b0f19; color: #f3f4f6; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #6366f1); font-size: 24px; color: white;">
                🏛️
            </div>
            <h2 style="margin: 12px 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 700;">Nivaran Civic Portal</h2>
            <p style="margin: 0; color: #9ca3af; font-size: 13px;">Autonomous AI Grievance Redressal</p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 24px; text-align: center;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #e5e7eb;">Hello ${userName},</p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #9ca3af;">Use this one-time verification code to sign in to your Nivaran account:</p>
            
            <div style="display: inline-block; padding: 14px 28px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 10px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; font-family: monospace;">
                ${otp}
            </div>

            <p style="margin: 20px 0 0 0; font-size: 12px; color: #9ca3af;">
                ⏱️ This code will expire in <strong>10 minutes</strong>. Do not share this code with anyone.
            </p>
        </div>

        <p style="margin: 24px 0 0 0; font-size: 11px; color: #6b7280; text-align: center;">
            If you did not request this verification code, you can safely ignore this email.
        </p>
    </div>
    `;

    const mailOptions = {
        from: `"Nivaran Civic Redressal" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: `🔐 ${otp} is your Nivaran login verification code`,
        text: `Your Nivaran login code is: ${otp}. It expires in 10 minutes.`,
        html: htmlContent,
    };

    const info = await mailClient.sendMail(mailOptions);
    console.log(`[OTP Service] ✉️ OTP email sent to ${toEmail} (MessageId: ${info.messageId})`);
    return { sent: true, simulated: false };
}

module.exports = { sendOtpEmail };
