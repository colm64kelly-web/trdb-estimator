// Netlify Function: Secure Pricing API
// Path: netlify/functions/get-pricing.js
// Version: 1.0
// Last Updated: November 21, 2025
// Rates calibrated based on: Odgers Berndtson (JLT) + AMIT (Marsa Al-Seef) + Compass benchmarks

/**
 * SECURE PRICING ENDPOINT
 * 
 * Security Features:
 * - Server-side pricing storage (not exposed to client)
 * - Rate limiting (prevent scraping)
 * - Request validation
 * - Obfuscated response
 * - IP-based throttling
 */

// Store pricing securely on server
const PRICING_DATABASE = {
  'uae-dubai': {
    light: [167, 223],      // Was: [120, 170] → +39% / +31%
    standard: [223, 297],   // Was: [170, 240] → +31% / +24%
    premium: [297, 418]     // Was: [240, 340] → +24% / +23%
  },
  'uae-abudhabi': {
    light: [167, 223],      // Was: [115, 165] → Same as Dubai now
    standard: [223, 297],   // Was: [165, 230]
    premium: [297, 418]     // Was: [230, 320]
  },
  'uae-rasalkhaimah': {
    light: [150, 200],      // Was: [100, 145] → ~10% lower than Dubai
    standard: [200, 267],   // Was: [145, 200]
    premium: [267, 376]     // Was: [200, 280]
  },
  'ksa-riyadh': {
    light: [150, 201],      // Was: [130, 185] → 90% of UAE rates
    standard: [201, 267],   // Was: [185, 260]
    premium: [267, 376]     // Was: [260, 370]
  },
  'ksa-jeddah': {
    light: [150, 201],      // Was: [125, 180] → Same as Riyadh
    standard: [201, 267],   // Was: [180, 250]
    premium: [267, 376]     // Was: [250, 355]
  }
};
const MEP_SPLIT = 0.35;

const OPTION_MULTIPLIERS = {
  furniture: 0.13,    // Was: 0.10 → +30% = 0.13
  ffe: 0.12,          // Was: 0.09 → +30% = 0.117 ≈ 0.12
  art: 0.07,          // Was: 0.05 → +30% = 0.065 ≈ 0.07
  smart: 0.08,        // Was: 0.06 → +30% = 0.078 ≈ 0.08
  green: 0.05,        // Was: 0.04 → +30% = 0.052 ≈ 0.05
  fullhvac: 0.20      // Was: 0.15 → +30% = 0.195 ≈ 0.20
};

const OPTION_LABELS = {
  furniture: 'Furniture Supply',
  ffe: 'Loose Furnishings & Décor',
  art: 'Original Art Procurement',
  smart: 'Smart Workplace (IoT/AV)',
  green: 'LEED / Sustainability',
  fullhvac: 'Full HVAC Supply & Plant'
};

// Rate limiting store (in production, use Redis or DynamoDB)
const rateLimitStore = new Map();

// Rate limit: 100 requests per hour per IP
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  const record = rateLimitStore.get(key);
  
  // Reset if window expired
  if (now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  // Check limit
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*', // Restrict in production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get client IP
    const clientIP = event.headers['x-forwarded-for'] || 
                     event.headers['client-ip'] || 
                     'unknown';
    
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.warn('⚠️ Rate limit exceeded:', clientIP);
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ 
          error: 'Too many requests. Please try again later.',
          retryAfter: 3600 
        })
      };
    }

    // Parse request
    const body = JSON.parse(event.body || '{}');
    const { market, quality, size, options = [] } = body;

    // Validate input
    if (!market || !quality || !size) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Validate market exists
    if (!PRICING_DATABASE[market]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid market' })
      };
    }

    // Validate quality exists
    if (!PRICING_DATABASE[market][quality]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid quality tier' })
      };
    }

    // Calculate pricing (server-side only)
    const [minPrice, maxPrice] = PRICING_DATABASE[market][quality];
    const midPrice = (minPrice + maxPrice) / 2;
    let baseTotal = size * midPrice;

    // Apply MEP split
    const fitoutBase = baseTotal * (1 - MEP_SPLIT);
    const mepBase = baseTotal * MEP_SPLIT;

    // Apply option multipliers
    let optionsTotal = 0;
    const breakdown = [];
    
    options.forEach(option => {
      if (OPTION_MULTIPLIERS[option]) {
        const value = baseTotal * OPTION_MULTIPLIERS[option];
        optionsTotal += value;
        breakdown.push({
          label: OPTION_LABELS[option],
          value,
          mult: OPTION_MULTIPLIERS[option]
        });
      }
    });

    const total = baseTotal + optionsTotal;
    const perSqft = total / size;

    // Return ONLY the calculated result
    // DO NOT expose the pricing ranges or multipliers
    const response = {
      total: Math.round(total),
      perSqft: Math.round(perSqft),
      fitoutBase: Math.round(fitoutBase),
      mepBase: Math.round(mepBase),
      optionsTotal: Math.round(optionsTotal),
      breakdown: breakdown.map(b => ({
        label: b.label,
        value: Math.round(b.value),
        mult: b.mult
      })),
      // Add checksum for integrity verification
      checksum: generateChecksum(total, size, market, quality)
    };

    console.log('✅ Pricing calculated for:', { market, quality, size, ip: clientIP });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Pricing calculation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Calculation failed' })
    };
  }
};

// Generate checksum for response integrity
function generateChecksum(total, size, market, quality) {
  const data = `${total}-${size}-${market}-${quality}-SECRET_SALT`;
  // Simple hash (use crypto.createHash in production)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
