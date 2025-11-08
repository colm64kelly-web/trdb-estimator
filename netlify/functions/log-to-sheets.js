// netlify/functions/log-to-sheets.js
// Automatically log every lead to Google Sheets

const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle OPTIONS
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
    const data = JSON.parse(event.body);
    console.log('📊 Logging lead to Google Sheets:', data);

    // Validate required fields
    if (!data.name || !data.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name and email required' })
      };
    }

    // Set up Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Calculate lead score
    const leadScore = calculateLeadScore(data);

    // Prepare row data
    const row = [
      new Date().toISOString(),                           // A: Timestamp
      data.name || '',                                     // B: Name
      data.email || '',                                    // C: Email
      data.company || '',                                  // D: Company
      // Phone - ensure it's always a string, never object/undefined
      String(data.phone || ''),                            // E: Phone
      data.estimate?.market || '',                         // F: Market
      data.estimate?.size || '',                           // G: Size
      data.estimate?.unit || 'sqft',                       // H: Unit
      data.estimate?.quality || '',                        // I: Quality
      // Handle both raw numbers and formatted strings for total
      // CRITICAL: Strip commas and convert to number
      (() => {
        let total = data.estimate?.total;
        if (typeof total === 'string') {
          // Remove commas, currency symbols, spaces
          total = parseFloat(total.replace(/[^0-9.-]/g, ''));
        }
        return isNaN(total) ? '' : Number(total);
      })(),                                                // J: Total Estimate (as pure number)
      data.estimate?.currency || 'AED',                    // K: Currency (NEW!)
      data.action || '',                                   // L: Action (pdf/email/whatsapp)
      leadScore,                                           // M: Lead Score
      data.notes || '',                                    // N: Notes
      data.source || 'Direct',                            // O: Traffic Source
      data.userId || 'Guest',                             // P: User ID
      data.timeOnSite || '',                              // Q: Time on Site
      data.pagesViewed || '',                             // R: Pages Viewed
    ];
    
    // Debug logging
    console.log('📊 Phone being sent to sheet:', {
      rawPhone: data.phone,
      phoneType: typeof data.phone,
      phoneInRow: row[4]
    });

    // Append to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Leads!A:R', // Columns A through R (added Currency column)
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [row],
      },
    });

    console.log('✅ Lead logged to Google Sheets successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Lead logged successfully',
      }),
    };

  } catch (error) {
    console.error('❌ Google Sheets logging error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};

// Calculate lead score based on actions and estimate value
function calculateLeadScore(data) {
  let score = 0;
  let tier = 'COLD';

  // Action-based scoring
  if (data.action === 'pdf') score += 20;           // Downloaded PDF
  if (data.action === 'email') score += 30;         // Requested email
  if (data.action === 'whatsapp') score += 25;      // Shared WhatsApp
  if (data.action === 'save') score += 15;          // Saved estimate
  if (data.userId && data.userId !== 'Guest') score += 20; // Signed up

  // Estimate value scoring
  const total = typeof data.estimate?.total === 'number' 
    ? data.estimate.total 
    : parseFloat(data.estimate?.total?.replace(/[^0-9]/g, '') || 0);
  
  if (total > 2000000) score += 40;       // > 2M AED
  else if (total > 1000000) score += 30;  // > 1M AED
  else if (total > 500000) score += 20;   // > 500k AED
  else if (total > 0) score += 10;        // Any estimate

  // Quality level scoring
  if (data.estimate?.quality === 'premium') score += 15;
  else if (data.estimate?.quality === 'standard') score += 10;
  else if (data.estimate?.quality === 'light') score += 5;

  // Notes indicate serious inquiry
  if (data.notes && data.notes.length > 50) score += 15;

  // Determine tier
  if (score >= 70) tier = '🔥 HOT';
  else if (score >= 40) tier = '⚡ WARM';
  else tier = '❄️ COLD';

  return `${tier} (${score})`;
}
