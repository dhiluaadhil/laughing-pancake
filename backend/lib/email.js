/**
 * Email service using Resend REST API via standard fetch (compatible with Cloudflare Workers)
 */

export async function sendEmail({ to, subject, html, env }) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const FROM_EMAIL = env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not found in environment. Email will NOT be sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error('Email send exception:', err);
    return { success: false, error: err.message };
  }
}

export function generateOTP(length = 6) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

export function getOTPEmailTemplate(otpCode, purpose) {
  let actionText = purpose === 'register' 
    ? 'verifying your email address for CampusLink' 
    : 'resetting your CampusLink password';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaec; border-radius: 8px;">
      <h2 style="color: #000; margin-bottom: 16px;">CampusLink OTP Verification</h2>
      <p style="color: #333; font-size: 16px;">You are currently ${actionText}.</p>
      <p style="color: #333; font-size: 16px;">Please use the following 6-digit code. It is valid for 10 minutes.</p>
      
      <div style="background-color: #f4f4f5; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #000;">${otpCode}</span>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you did not request this code, you can safely ignore this email.</p>
    </div>
  `;
}
