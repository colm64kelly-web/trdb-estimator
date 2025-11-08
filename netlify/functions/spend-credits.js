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
        body: JSON.stringify({ error: 'Invalid JSON' })
      };
    }

    const { amount, description, feature_name } = requestBody;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    if (!description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Description required' })
      };
    }

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

    console.log(`Spending ${amount} credits for user: ${user.id}`);

    const { data: success, error: spendError } = await supabase
      .rpc('spend_wallet_credits', {
        p_user_id: user.id,
        p_amount: amount,
        p_description: description,
        p_reference_id: feature_name || null
      });

    if (spendError || !success) {
      console.error('Spend error:', spendError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Insufficient funds or transaction failed',
          details: spendError?.message || 'Not enough credits in wallet'
        })
      };
    }

    if (feature_name) {
      const { error: unlockError } = await supabase
        .from('feature_unlocks')
        .insert({
          user_id: user.id,
          feature_name: feature_name,
          unlocked_via: 'wallet_purchase',
          cost: amount
        });

      if (unlockError) {
        console.error('Feature unlock error:', unlockError);
      }
    }

    const { data: wallet } = await supabase
      .from('user_wallet')
      .select('balance, lifetime_spent')
      .eq('user_id', user.id)
      .single();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        spent: amount,
        description: description,
        feature_unlocked: feature_name || null,
        wallet: {
          balance: parseFloat(wallet?.balance || 0),
          lifetime_spent: parseFloat(wallet?.lifetime_spent || 0)
        }
      })
    };

  } catch (error) {
    console.error('Unexpected error in spend-credits:', error);
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