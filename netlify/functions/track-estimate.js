const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No authorization header' })
      };
    }

    const token = authHeader.replace('Bearer ', '');

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError.message
        })
      };
    }

    const { estimate_id, estimate_data } = requestBody;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    console.log(`Tracking estimate for user: ${user.id}, estimate: ${estimate_id}`);

    const { error: incrementError } = await supabase
      .rpc('increment_estimate_usage', { p_user_id: user.id });

    if (incrementError) {
      console.error('Increment error:', incrementError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to track estimate',
          details: incrementError.message
        })
      };
    }

    const weekStart = getWeekStart();
    const { data: tokens, error: tokensError } = await supabase
      .from('user_tokens')
      .select('estimates_used, estimates_limit, last_estimate_at')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (tokensError) {
      console.error('Tokens fetch error:', tokensError);
    }

    const estimatesUsed = tokens?.estimates_used || 1;
    const estimatesLimit = tokens?.estimates_limit || 3;
    const weeklyPercent = Math.round((estimatesUsed / estimatesLimit) * 100);

    let milestone = null;
    if (weeklyPercent === 33 || estimatesUsed === 1) {
      milestone = 'first_estimate';
    } else if (weeklyPercent === 66 || estimatesUsed === 2) {
      milestone = 'second_estimate';
    } else if (weeklyPercent === 100 || estimatesUsed === estimatesLimit) {
      milestone = 'limit_reached';
    }

    const response = {
      success: true,
      tracked: true,
      usage: {
        estimates_used: estimatesUsed,
        estimates_limit: estimatesLimit,
        weekly_percent: weeklyPercent,
        last_estimate_at: tokens?.last_estimate_at || new Date().toISOString()
      },
      milestone: milestone,
      estimate_id: estimate_id
    };

    console.log('Track estimate response:', response);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Unexpected error in track-estimate:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

function getWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}