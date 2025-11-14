// Netlify Function: Send Email Notifications
// Path: netlify/functions/email-lead.js

const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { action, name, email, company, phone, notes, estimate, estimateName } = data;

    console.log('📧 Email request received:', { action, email, company });

    // Validate required fields
    if (!name || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name and email are required' })
      };
    }
    // Configure SMTP transporter for GoDaddy (TLS instead of SSL)
    const transporter = nodemailer.createTransport({
      host: 'smtpout.secureserver.net',  // GoDaddy SMTP server
      port: 587,                          // TLS port (instead of 465)
      secure: false,                      // Use STARTTLS
      auth: {
        user: process.env.EMAIL_USER,     // info@thetemplerock.com
        pass: process.env.EMAIL_PASSWORD  // Your GoDaddy email password
      },
      tls: {
        rejectUnauthorized: false         // Accept self-signed certs
      }
    });

    // Verify SMTP configuration
    await transporter.verify();
    console.log('✅ SMTP connection verified');

    // Prepare email content based on action
    let subject, htmlContent, textContent;

    switch (action) {
      case 'pdf':
        subject = `TRDB Fitout Estimate - PDF Request from ${company || name}`;
        htmlContent = generatePDFEmailHTML(name, email, company, phone, notes, estimate);
        textContent = generatePDFEmailText(name, email, company, phone, notes, estimate);
        break;

      case 'email':
        subject = `TRDB Fitout Estimate - Email Request from ${company || name}`;
        htmlContent = generateEmailEstimateHTML(name, email, company, phone, notes, estimate);
        textContent = generateEmailEstimateText(name, email, company, phone, notes, estimate);
        break;

      case 'whatsapp':
        subject = `TRDB Fitout Estimate - WhatsApp Share from ${company || name}`;
        htmlContent = generateWhatsAppEmailHTML(name, email, company, phone, notes, estimate);
        textContent = generateWhatsAppEmailText(name, email, company, phone, notes, estimate);
        break;

      case 'save':
        subject = `TRDB - New Estimate Saved: ${estimateName}`;
        htmlContent = generateSaveEmailHTML(name, email, estimateName, estimate);
        textContent = generateSaveEmailText(name, email, estimateName, estimate);
        break;

      default:
        subject = `TRDB Fitout Estimate - New Lead from ${company || name}`;
        htmlContent = generateDefaultEmailHTML(name, email, company, phone, notes, estimate);
        textContent = generateDefaultEmailText(name, email, company, phone, notes, estimate);
    }

    // Send email to company
    const companyEmail = await transporter.sendMail({
      from: `"TRDB Estimator" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || 'info@thetemplerock.com',
      replyTo: email,
      subject: subject,
      text: textContent,
      html: htmlContent
    });

    console.log('✅ Email sent to company:', companyEmail.messageId);

    // Send confirmation email to user (optional)
    if (action === 'pdf' || action === 'email') {
      const userEmail = await transporter.sendMail({
        from: `"TRDB - Temple Rock Design Build" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your TRDB Fitout Cost Estimate',
        html: generateUserConfirmationHTML(name, estimate),
        text: generateUserConfirmationText(name, estimate)
      });

      console.log('✅ Confirmation sent to user:', userEmail.messageId);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        messageId: companyEmail.messageId
      })
    };

  } catch (error) {
    console.error('❌ Email error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// ============================================
// EMAIL TEMPLATES
// ============================================

function generatePDFEmailHTML(name, email, company, phone, notes, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e67e22; color: white; padding: 20px; text-align: center; }
        .content { background: #f4f4f4; padding: 20px; margin: 20px 0; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #e67e22; }
        .estimate { background: white; padding: 15px; border-left: 4px solid #e67e22; }
        .footer { text-align: center; color: #777; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 New PDF Request</h1>
          <p>TRDB Fitout Cost Estimator</p>
        </div>
        
        <div class="content">
          <h2>Contact Information</h2>
          <div class="field"><span class="label">Name:</span> ${name}</div>
          <div class="field"><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></div>
          ${company ? `<div class="field"><span class="label">Company:</span> ${company}</div>` : ''}
          ${phone ? `<div class="field"><span class="label">Phone:</span> ${phone}</div>` : ''}
          ${notes ? `<div class="field"><span class="label">Notes:</span><br>${notes}</div>` : ''}
        </div>

        <div class="estimate">
          <h2>Estimate Details</h2>
          <div class="field"><span class="label">Market:</span> ${estimate.market}</div>
          <div class="field"><span class="label">Size:</span> ${estimate.size} ${estimate.unit}</div>
          <div class="field"><span class="label">Quality:</span> ${estimate.quality}</div>
          <div class="field"><span class="label">Total:</span> <strong style="color: #e67e22; font-size: 1.5em;">${estimate.total}</strong></div>
        </div>

        <div class="footer">
          <p>© 2025 Temple Rock Design Build | <a href="https://thetemplerock.com">thetemplerock.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePDFEmailText(name, email, company, phone, notes, estimate) {
  return `
NEW PDF REQUEST - TRDB Fitout Estimator

Contact Information:
- Name: ${name}
- Email: ${email}
${company ? `- Company: ${company}` : ''}
${phone ? `- Phone: ${phone}` : ''}
${notes ? `- Notes: ${notes}` : ''}

Estimate Details:
- Market: ${estimate.market}
- Size: ${estimate.size} ${estimate.unit}
- Quality: ${estimate.quality}
- Total: ${estimate.total}

---
Temple Rock Design Build
https://thetemplerock.com
  `;
}

function generateEmailEstimateHTML(name, email, company, phone, notes, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e67e22; color: white; padding: 20px; text-align: center; }
        .content { background: #f4f4f4; padding: 20px; margin: 20px 0; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #e67e22; }
        .estimate { background: white; padding: 15px; border-left: 4px solid #e67e22; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 New Email Estimate Request</h1>
          <p>TRDB Fitout Cost Estimator</p>
        </div>
        
        <div class="content">
          <h2>Contact Information</h2>
          <div class="field"><span class="label">Name:</span> ${name}</div>
          <div class="field"><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></div>
          ${company ? `<div class="field"><span class="label">Company:</span> ${company}</div>` : ''}
          ${phone ? `<div class="field"><span class="label">Phone:</span> ${phone}</div>` : ''}
          ${notes ? `<div class="field"><span class="label">Notes:</span><br>${notes}</div>` : ''}
        </div>

        <div class="estimate">
          <h2>Estimate Details</h2>
          <div class="field"><span class="label">Market:</span> ${estimate.market}</div>
          <div class="field"><span class="label">Size:</span> ${estimate.size} ${estimate.unit}</div>
          <div class="field"><span class="label">Quality:</span> ${estimate.quality}</div>
          <div class="field"><span class="label">Total:</span> <strong style="color: #e67e22; font-size: 1.5em;">${estimate.total}</strong></div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateEmailEstimateText(name, email, company, phone, notes, estimate) {
  return generatePDFEmailText(name, email, company, phone, notes, estimate).replace('PDF REQUEST', 'EMAIL ESTIMATE REQUEST');
}

function generateWhatsAppEmailHTML(name, email, company, phone, notes, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #25D366; color: white; padding: 20px; text-align: center; }
        .content { background: #f4f4f4; padding: 20px; margin: 20px 0; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #25D366; }
        .estimate { background: white; padding: 15px; border-left: 4px solid #25D366; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📱 New WhatsApp Share</h1>
          <p>TRDB Fitout Cost Estimator</p>
        </div>
        
        <div class="content">
          <h2>Contact Information</h2>
          <div class="field"><span class="label">Name:</span> ${name}</div>
          <div class="field"><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></div>
          ${company ? `<div class="field"><span class="label">Company:</span> ${company}</div>` : ''}
          ${phone ? `<div class="field"><span class="label">Phone:</span> ${phone}</div>` : ''}
          ${notes ? `<div class="field"><span class="label">Notes:</span><br>${notes}</div>` : ''}
        </div>

        <div class="estimate">
          <h2>Estimate Details</h2>
          <div class="field"><span class="label">Market:</span> ${estimate.market}</div>
          <div class="field"><span class="label">Size:</span> ${estimate.size} ${estimate.unit}</div>
          <div class="field"><span class="label">Quality:</span> ${estimate.quality}</div>
          <div class="field"><span class="label">Total:</span> <strong style="color: #25D366; font-size: 1.5em;">${estimate.total}</strong></div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateWhatsAppEmailText(name, email, company, phone, notes, estimate) {
  return `
NEW WHATSAPP SHARE - TRDB Fitout Estimator

Contact Information:
- Name: ${name}
- Email: ${email}
${company ? `- Company: ${company}` : ''}
${phone ? `- Phone: ${phone}` : ''}
${notes ? `- Notes: ${notes}` : ''}

Estimate Details:
- Market: ${estimate.market}
- Size: ${estimate.size} ${estimate.unit}
- Quality: ${estimate.quality}
- Total: ${estimate.total}

---
Temple Rock Design Build
https://thetemplerock.com
  `;
}

function generateSaveEmailHTML(name, email, estimateName, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { background: #f4f4f4; padding: 20px; margin: 20px 0; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #10b981; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💾 Estimate Saved</h1>
          <p>TRDB Fitout Cost Estimator</p>
        </div>
        
        <div class="content">
          <h2>User Activity</h2>
          <div class="field"><span class="label">User:</span> ${name}</div>
          <div class="field"><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></div>
          <div class="field"><span class="label">Estimate Name:</span> ${estimateName}</div>
          <div class="field"><span class="label">Total:</span> <strong>${estimate.total}</strong></div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateSaveEmailText(name, email, estimateName, estimate) {
  return `
ESTIMATE SAVED - TRDB Fitout Estimator

User: ${name}
Email: ${email}
Estimate Name: ${estimateName}
Total: ${estimate.total}

---
Temple Rock Design Build
  `;
}

function generateDefaultEmailHTML(name, email, company, phone, notes, estimate) {
  return generatePDFEmailHTML(name, email, company, phone, notes, estimate).replace('PDF Request', 'New Lead');
}

function generateDefaultEmailText(name, email, company, phone, notes, estimate) {
  return generatePDFEmailText(name, email, company, phone, notes, estimate).replace('PDF REQUEST', 'NEW LEAD');
}

function generateUserConfirmationHTML(name, estimate) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e67e22; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .estimate-box { background: #f4f4f4; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .total { font-size: 2em; color: #e67e22; font-weight: bold; }
        .footer { text-align: center; color: #777; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Thank You!</h1>
          <p>Your Fitout Cost Estimate</p>
        </div>
        
        <div class="content">
          <p>Hi ${name},</p>
          <p>Thank you for using the TRDB Fitout Cost Estimator. We've received your request and our team will be in touch with you shortly.</p>
          
          <div class="estimate-box">
            <h2>Your Estimate</h2>
            <p class="total">${estimate.total}</p>
            <p><strong>Market:</strong> ${estimate.market}</p>
            <p><strong>Size:</strong> ${estimate.size} ${estimate.unit}</p>
            <p><strong>Quality Level:</strong> ${estimate.quality}</p>
          </div>

          <p>Our design and construction experts will review your requirements and provide you with a detailed proposal tailored to your project needs.</p>
          
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our team will review your estimate within 24 hours</li>
            <li>We'll contact you to discuss your project in detail</li>
            <li>You'll receive a comprehensive proposal with timeline and specifications</li>
          </ul>

          <p>If you have any immediate questions, feel free to reply to this email or call us.</p>
          
          <p>Best regards,<br>
          <strong>Temple Rock Design Build Team</strong></p>
        </div>

        <div class="footer">
          <p><strong>Temple Rock Design Build</strong></p>
          <p>📧 info@thetemplerock.com | 🌐 <a href="https://thetemplerock.com">thetemplerock.com</a></p>
          <p>© 2025 Temple Rock Design Build. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateUserConfirmationText(name, estimate) {
  return `
Hi ${name},

Thank you for using the TRDB Fitout Cost Estimator. We've received your request and our team will be in touch with you shortly.

YOUR ESTIMATE
${estimate.total}

Market: ${estimate.market}
Size: ${estimate.size} ${estimate.unit}
Quality Level: ${estimate.quality}

Our design and construction experts will review your requirements and provide you with a detailed proposal tailored to your project needs.

What happens next?
- Our team will review your estimate within 24 hours
- We'll contact you to discuss your project in detail
- You'll receive a comprehensive proposal with timeline and specifications

If you have any immediate questions, feel free to reply to this email or call us.

Best regards,
Temple Rock Design Build Team

---
Temple Rock Design Build
info@thetemplerock.com
https://thetemplerock.com
  `;
}
