const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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
        body: JSON.stringify({ 
          error: 'No authorization header',
          details: 'Please log in to check your quota'
        })
      };
    }

    const token = authHeader.replace('Bearer ', '');

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
        body: JSON.stringify({ 
          error: 'Invalid token',
          details: 'Your session has expired. Please log in again.'
        })
      };
    }

    console.log(`Checking quota for user: ${user.id}`);

    const { data: canCreate, error: quotaError } = await supabase
      .rpc('can_create_estimate', { p_user_id: user.id });

    if (quotaError) {
      console.error('Quota check error:', quotaError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to check quota',
          details: quotaError.message
        })
      };
    }

    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('tier, status, expires_at, started_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('Subscription fetch error:', subError);
    }

    const weekStart = getWeekStart();
    const { data: tokens, error: tokensError } = await supabase
      .from('user_tokens')
      .select('estimates_used, estimates_limit, week_start, last_estimate_at')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (tokensError) {
      console.error('Tokens fetch error:', tokensError);
    }

    const { data: wallet, error: walletError } = await supabase
      .from('user_wallet')
      .select('balance, lifetime_earned, lifetime_spent')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletError) {
      console.error('Wallet fetch error:', walletError);
    }

    const estimatesUsed = tokens?.estimates_used || 0;
    const estimatesLimit = tokens?.estimates_limit || 3;
    const weeklyPercent = Math.round((estimatesUsed / estimatesLimit) * 100);

    const today = new Date();
    const daysUntilReset = (8 - (today.getDay() || 7)) % 7 || 7;

    const response = {
      can_create: canCreate || false,
      tier: subscription?.tier || 'free',
      status: subscription?.status || 'active',
      usage: {
        estimates_used: estimatesUsed,
        estimates_limit: estimatesLimit,
        weekly_percent: weeklyPercent,
        week_start: tokens?.week_start || weekStart,
        last_estimate_at: tokens?.last_estimate_at || null,
        days_until_reset: daysUntilReset
      },
      wallet: {
        balance: parseFloat(wallet?.balance || 0),
        lifetime_earned: parseFloat(wallet?.lifetime_earned || 0),
        lifetime_spent: parseFloat(wallet?.lifetime_spent || 0)
      },
      subscription: {
        started_at: subscription?.started_at || null,
        expires_at: subscription?.expires_at || null
      },
      user_email: user.email
    };

    console.log('Quota check response:', response);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Unexpected error in check-quota:', error);
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