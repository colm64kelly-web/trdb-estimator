const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { 
      name, 
      email, 
      company, 
      phone, 
      notes, 
      estimate, 
      action,
      estimateName 
    } = JSON.parse(event.body);

    // Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Determine email content based on action
    let subject, htmlContent, textContent;
    const deliveryMethod = action; // 'pdf', 'email', 'whatsapp', or 'save'

    switch (deliveryMethod) {
      case 'pdf':
        subject = `📄 New PDF Request from ${company || name}`;
        htmlContent = generatePDFEmailHTML(name, email, company, phone, notes, estimate);
        textContent = generatePDFEmailText(name, email, company, phone, notes, estimate);
        break;

      case 'email':
        subject = `📧 New Email Estimate Request from ${company || name}`;
        htmlContent = generateEmailEstimateHTML(name, email, company, phone, notes, estimate);
        textContent = generateEmailEstimateText(name, email, company, phone, notes, estimate);
        break;

      case 'whatsapp':
        subject = `📱 New WhatsApp Share Request from ${company || name}`;
        htmlContent = generateWhatsAppEmailHTML(name, email, company, phone, notes, estimate);
        textContent = generateWhatsAppEmailText(name, email, company, phone, notes, estimate);
        break;

      case 'save':
        subject = `💾 New Estimate Saved: ${estimateName}`;
        htmlContent = generateSaveEmailHTML(name, email, estimateName, estimate);
        textContent = generateSaveEmailText(name, email, estimateName, estimate);
        break;

      default:
        subject = `TRDB Fitout Estimate - New Lead from ${company || name}`;
        htmlContent = generateDefaultEmailHTML(name, email, company, phone, notes, estimate);
        textContent = generateDefaultEmailText(name, email, company, phone, notes, estimate);
    }

    // Email to company/admin
    const companyEmailMsg = {
      to: process.env.ADMIN_EMAIL || 'info@thetemplerock.com',
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME
      },
      replyTo: email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    await sgMail.send(companyEmailMsg);
    console.log('✅ Email sent to company:', companyEmailMsg.to);

    // Send confirmation email to user (optional)
    if (deliveryMethod === 'pdf' || deliveryMethod === 'email') {
      const userEmailMsg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL,
          name: process.env.SENDGRID_FROM_NAME
        },
        replyTo: process.env.ADMIN_EMAIL || 'info@thetemplerock.com',
        subject: 'Your TRDB Fitout Cost Estimate',
        html: generateUserConfirmationHTML(name, estimate),
        text: generateUserConfirmationText(name, estimate)
      };

      await sgMail.send(userEmailMsg);
      console.log('✅ Confirmation sent to user:', email);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Email sent successfully via SendGrid'
      })
    };

  } catch (error) {
    console.error('❌ SendGrid Error:', error);
    
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to send email',
        details: error.message
      })
    };
  }
};

// ============================================
// EMAIL TEMPLATE FUNCTIONS
// ============================================

// Generate HTML email content for PDF notification
function generatePDFEmailHTML(name, email, company, phone, notes, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .estimate-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6b35; }
        .label { font-weight: bold; color: #1a1a2e; }
        .highlight { color: #ff6b35; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 New PDF Request</h1>
          <p>Someone requested a PDF estimate</p>
        </div>
        <div class="content">
          <h2>Contact Details</h2>
          <p><span class="label">Name:</span> ${name}</p>
          <p><span class="label">Email:</span> ${email}</p>
          <p><span class="label">Company:</span> ${company || 'Not provided'}</p>
          <p><span class="label">Phone:</span> ${phone || 'Not provided'}</p>
          ${notes ? `<p><span class="label">Notes:</span> ${notes}</p>` : ''}
          
          <div class="estimate-box">
            <h3>Estimate Summary</h3>
            <p><span class="label">Project Size:</span> ${estimate.area} sqm</p>
            <p><span class="label">Quality Level:</span> ${estimate.quality}</p>
            <p><span class="label">Finish Quality:</span> ${estimate.finishQuality}</p>
            <p><span class="label">Total Estimate:</span> <span class="highlight">${formattedTotal}</span></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate plain text email content for PDF notification
function generatePDFEmailText(name, email, company, phone, notes, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
📄 NEW PDF REQUEST

CONTACT DETAILS:
Name: ${name}
Email: ${email}
Company: ${company || 'Not provided'}
Phone: ${phone || 'Not provided'}
${notes ? `Notes: ${notes}` : ''}

ESTIMATE SUMMARY:
Project Size: ${estimate.area} sqm
Quality Level: ${estimate.quality}
Finish Quality: ${estimate.finishQuality}
Total Estimate: ${formattedTotal}
  `.trim();
}

// Generate HTML email content for Email Estimate notification
function generateEmailEstimateHTML(name, email, company, phone, notes, estimate) {
  return generatePDFEmailHTML(name, email, company, phone, notes, estimate)
    .replace('📄 New PDF Request', '📧 New Email Estimate Request')
    .replace('requested a PDF estimate', 'requested an email estimate');
}

// Generate plain text email content for Email Estimate notification
function generateEmailEstimateText(name, email, company, phone, notes, estimate) {
  return generatePDFEmailText(name, email, company, phone, notes, estimate)
    .replace('📄 NEW PDF REQUEST', '📧 NEW EMAIL ESTIMATE REQUEST');
}

// Generate HTML email content for WhatsApp notification
function generateWhatsAppEmailHTML(name, email, company, phone, notes, estimate) {
  return generatePDFEmailHTML(name, email, company, phone, notes, estimate)
    .replace('📄 New PDF Request', '📱 New WhatsApp Share Request')
    .replace('requested a PDF estimate', 'requested to share estimate via WhatsApp');
}

// Generate plain text email content for WhatsApp notification
function generateWhatsAppEmailText(name, email, company, phone, notes, estimate) {
  return generatePDFEmailText(name, email, company, phone, notes, estimate)
    .replace('📄 NEW PDF REQUEST', '📱 NEW WHATSAPP SHARE REQUEST');
}

// Generate HTML email content for Save notification
function generateSaveEmailHTML(name, email, estimateName, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .estimate-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6b35; }
        .label { font-weight: bold; color: #1a1a2e; }
        .highlight { color: #ff6b35; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💾 New Estimate Saved</h1>
          <p>A user saved an estimate</p>
        </div>
        <div class="content">
          <h2>User Details</h2>
          <p><span class="label">Name:</span> ${name}</p>
          <p><span class="label">Email:</span> ${email}</p>
          <p><span class="label">Estimate Name:</span> ${estimateName}</p>
          
          <div class="estimate-box">
            <h3>Estimate Summary</h3>
            <p><span class="label">Project Size:</span> ${estimate.area} sqm</p>
            <p><span class="label">Quality Level:</span> ${estimate.quality}</p>
            <p><span class="label">Finish Quality:</span> ${estimate.finishQuality}</p>
            <p><span class="label">Total Estimate:</span> <span class="highlight">${formattedTotal}</span></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate plain text email content for Save notification
function generateSaveEmailText(name, email, estimateName, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
💾 NEW ESTIMATE SAVED

USER DETAILS:
Name: ${name}
Email: ${email}
Estimate Name: ${estimateName}

ESTIMATE SUMMARY:
Project Size: ${estimate.area} sqm
Quality Level: ${estimate.quality}
Finish Quality: ${estimate.finishQuality}
Total Estimate: ${formattedTotal}
  `.trim();
}

// Generate HTML email content for default notification
function generateDefaultEmailHTML(name, email, company, phone, notes, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .estimate-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6b35; }
        .label { font-weight: bold; color: #1a1a2e; }
        .highlight { color: #ff6b35; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TRDB Fitout Estimate - New Lead</h1>
        </div>
        <div class="content">
          <h2>Contact Details</h2>
          <p><span class="label">Name:</span> ${name}</p>
          <p><span class="label">Email:</span> ${email}</p>
          <p><span class="label">Company:</span> ${company || 'Not provided'}</p>
          <p><span class="label">Phone:</span> ${phone || 'Not provided'}</p>
          ${notes ? `<p><span class="label">Notes:</span> ${notes}</p>` : ''}
          
          <div class="estimate-box">
            <h3>Estimate Summary</h3>
            <p><span class="label">Project Size:</span> ${estimate.area} sqm</p>
            <p><span class="label">Quality Level:</span> ${estimate.quality}</p>
            <p><span class="label">Finish Quality:</span> ${estimate.finishQuality}</p>
            <p><span class="label">Total Estimate:</span> <span class="highlight">${formattedTotal}</span></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate plain text email content for default notification
function generateDefaultEmailText(name, email, company, phone, notes, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
TRDB FITOUT ESTIMATE - NEW LEAD

CONTACT DETAILS:
Name: ${name}
Email: ${email}
Company: ${company || 'Not provided'}
Phone: ${phone || 'Not provided'}
${notes ? `Notes: ${notes}` : ''}

ESTIMATE SUMMARY:
Project Size: ${estimate.area} sqm
Quality Level: ${estimate.quality}
Finish Quality: ${estimate.finishQuality}
Total Estimate: ${formattedTotal}
  `.trim();
}

// Generate user confirmation HTML
function generateUserConfirmationHTML(name, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .estimate-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6b35; }
        .label { font-weight: bold; color: #1a1a2e; }
        .highlight { color: #ff6b35; font-weight: bold; font-size: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your TRDB Fitout Cost Estimate</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Thank you for using the TRDB Cost Estimator! Here's your estimate summary:</p>
          
          <div class="estimate-box">
            <h3>Your Estimate</h3>
            <p><span class="label">Project Size:</span> ${estimate.area} sqm</p>
            <p><span class="label">Quality Level:</span> ${estimate.quality}</p>
            <p><span class="label">Finish Quality:</span> ${estimate.finishQuality}</p>
            <p><span class="label">Estimated Total:</span><br><span class="highlight">${formattedTotal}</span></p>
          </div>
          
          <p>Our team will review your project and get back to you shortly.</p>
          <p>Best regards,<br><strong>Temple Rock Design Build</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate user confirmation text
function generateUserConfirmationText(name, estimate) {
  const formattedTotal = formatCurrency(getEstimateTotal(estimate));
  
  return `
Hi ${name},

Thank you for using the TRDB Cost Estimator! Here's your estimate summary:

YOUR ESTIMATE:
Project Size: ${estimate.area} sqm
Quality Level: ${estimate.quality}
Finish Quality: ${estimate.finishQuality}
Estimated Total: ${formattedTotal}

Our team will review your project and get back to you shortly.

Best regards,
Temple Rock Design Build
  `.trim();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Extract total cost from estimate object (handles different field names)
function getEstimateTotal(estimate) {
  // Try different possible field names
  return estimate.totalCost || estimate.total || estimate.grandTotal || estimate.estimatedTotal || 0;
}

// Format currency
function formatCurrency(amount) {
  // Handle undefined or null values
  if (!amount && amount !== 0) {
    return 'AED 0';
  }
  
  // Convert to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  
  if (numAmount >= 1000000) {
    return `AED ${(numAmount / 1000000).toFixed(2)}M`;
  } else if (numAmount >= 1000) {
    return `AED ${(numAmount / 1000).toFixed(0)}K`;
  } else {
    return `AED ${numAmount.toLocaleString()}`;
  }
}
