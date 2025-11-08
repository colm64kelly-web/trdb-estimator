// Netlify Function: Send Email Notifications
// Path: netlify/functions/email-lead.js

// Try different ways to load nodemailer
let nodemailer;
try {
  nodemailer = require('nodemailer');
  console.log('✅ Nodemailer loaded successfully');
} catch (e) {
  console.error('❌ Failed to load nodemailer:', e);
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Check if nodemailer loaded
    if (!nodemailer) {
      throw new Error('Nodemailer module not loaded');
    }

    // Check if createTransporter exists
    if (typeof nodemailer.createTransport !== 'function') {
      console.error('❌ nodemailer object:', Object.keys(nodemailer));
      throw new Error('nodemailer.createTransport is not a function');
    }

    const data = JSON.parse(event.body);
    const { action, name, email, company, phone, notes, estimate, estimateName } = data;

    console.log('📧 Email request received:', { action, email, company });

    // Validate required fields
    if (!name || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name and email are required' })
      };
    }

    // Validate environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('❌ Missing environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Email configuration missing. Please set EMAIL_USER and EMAIL_PASSWORD.' 
        })
      };
    }

    console.log('📧 Creating SMTP transporter...');
    console.log('SMTP Config:', {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || '587',
      user: process.env.EMAIL_USER ? '***' : 'NOT SET'
    });

    // Configure SMTP transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('✅ Transporter created');

    // Verify SMTP configuration
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified');
    } catch (verifyError) {
      console.error('❌ SMTP verification failed:', verifyError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'SMTP connection failed: ' + verifyError.message 
        })
      };
    }

    const FROM = process.env.EMAIL_USER;
    const ADMIN = process.env.ADMIN_EMAIL || 'info@thetemplerock.com';

    // Prepare email content based on action
    let subject, htmlContent;

    switch (action) {
      case 'pdf':
        subject = `TRDB Fitout Estimate - PDF Request from ${company || name}`;
        htmlContent = generatePDFEmailHTML(name, email, company, phone, notes, estimate);
        break;

      case 'email':
        subject = `TRDB Fitout Estimate - Email Request from ${company || name}`;
        htmlContent = generateEmailEstimateHTML(name, email, company, phone, notes, estimate);
        break;

      case 'whatsapp':
        subject = `TRDB Fitout Estimate - WhatsApp Share from ${company || name}`;
        htmlContent = generateWhatsAppEmailHTML(name, email, company, phone, notes, estimate);
        break;

      case 'save':
        subject = `TRDB - New Estimate Saved: ${estimateName}`;
        htmlContent = generateSaveEmailHTML(name, email, estimateName, estimate);
        break;

      default:
        subject = `TRDB - New Lead from ${company || name}`;
        htmlContent = generateGenericEmailHTML(name, email, company, phone, notes, estimate);
    }

    console.log('📧 Sending email to admin:', ADMIN);

    // Send email to admin
    const adminEmailResult = await transporter.sendMail({
      from: FROM,
      to: ADMIN,
      replyTo: email,
      subject: subject,
      html: htmlContent
    });

    console.log('✅ Admin email sent:', adminEmailResult.messageId);

    // Send confirmation to user (except for save action)
    if (action !== 'save') {
      console.log('📧 Sending confirmation to user:', email);
      
      const userEmailResult = await transporter.sendMail({
        from: FROM,
        to: email,
        replyTo: ADMIN,
        subject: 'Thank you for your TRDB Estimate Request',
        html: generateUserConfirmationHTML(name, estimate)
      });

      console.log('✅ User confirmation sent:', userEmailResult.messageId);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        messageId: adminEmailResult.messageId
      })
    };

  } catch (error) {
    console.error('❌ Email send error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// Email template functions
function generatePDFEmailHTML(name, email, company, phone, notes, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🏢 TRDB New Lead</h1>
                  <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">PDF Request</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 30px;">
                  <h2 style="color: #e67e22; margin-top: 0; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Contact Information</h2>
                  <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
                  <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #e67e22;">${email}</a></p>
                  <p style="margin: 10px 0;"><strong>Company:</strong> ${company || 'N/A'}</p>
                  <p style="margin: 10px 0;"><strong>Phone:</strong> ${phone || 'N/A'}</p>
                  
                  <h2 style="color: #e67e22; margin-top: 30px; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Estimate Details</h2>
                  <p style="margin: 10px 0;"><strong>Market:</strong> ${estimate?.market || 'N/A'}</p>
                  <p style="margin: 10px 0;"><strong>Size:</strong> ${estimate?.size || 'N/A'} ${estimate?.unit || 'sqft'}</p>
                  <p style="margin: 10px 0;"><strong>Quality:</strong> ${estimate?.quality || 'N/A'}</p>
                  <p style="margin: 10px 0; font-size: 18px;"><strong>Total:</strong> <span style="color: #e67e22; font-size: 24px;">${estimate?.totalFormatted || estimate?.total || 'N/A'}</span></p>
                  
                  ${notes ? `
                  <h2 style="color: #e67e22; margin-top: 30px; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Project Notes</h2>
                  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #e67e22; white-space: pre-wrap;">${notes}</div>
                  ` : ''}
                  
                  <div style="margin-top: 30px; padding: 15px; background: #fff6ea; border-radius: 5px; border-left: 4px solid #ffd9a3;">
                    <p style="margin: 0; color: #d35400;"><strong>⚡ Action Required:</strong> Follow up within 24 hours for best conversion rate</p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
                  <p style="margin: 5px 0;">Temple Rock Design Build | Cost Estimator</p>
                  <p style="margin: 5px 0;">Received: ${new Date().toLocaleString('en-US', {timeZone: 'Asia/Dubai'})}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateEmailEstimateHTML(name, email, company, phone, notes, estimate) {
  return generatePDFEmailHTML(name, email, company, phone, notes, estimate).replace('PDF Request', 'Email Request');
}

function generateWhatsAppEmailHTML(name, email, company, phone, notes, estimate) {
  return generatePDFEmailHTML(name, email, company, phone, notes, estimate).replace('PDF Request', 'WhatsApp Share');
}

function generateSaveEmailHTML(name, email, estimateName, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff;">💾 Estimate Saved</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <p><strong>User:</strong> ${name}</p>
                  <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #e67e22;">${email}</a></p>
                  <p><strong>Estimate Name:</strong> ${estimateName}</p>
                  <p><strong>Total:</strong> <span style="color: #e67e22; font-size: 20px;">${estimate?.totalFormatted || estimate?.total || 'N/A'}</span></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateGenericEmailHTML(name, email, company, phone, notes, estimate) {
  return generatePDFEmailHTML(name, email, company, phone, notes, estimate).replace('PDF Request', 'New Lead');
}

function generateUserConfirmationHTML(name, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff;">Thank You!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <p>Dear ${name},</p>
                  <p>Thank you for using the TRDB Fitout Cost Estimator. We've received your request and will contact you shortly.</p>
                  <p style="font-size: 18px;"><strong>Your Estimate:</strong> <span style="color: #e67e22; font-size: 22px;">${estimate?.totalFormatted || estimate?.total || 'N/A'}</span></p>
                  <p>We'll be in touch within 24 hours to discuss your project in detail.</p>
                  <p style="margin-top: 30px;">Best regards,<br><strong>Temple Rock Design Build</strong></p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
                  <p style="margin: 0;">Temple Rock Design Build</p>
                  <p style="margin: 5px 0;"><a href="https://www.thetemplerock.com" style="color: #e67e22;">www.thetemplerock.com</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
