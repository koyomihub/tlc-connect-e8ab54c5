import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DAILY_TOKEN_LIMIT = 100;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, amount, type, description, postId } = await req.json();

    if (!userId || !amount || !type) {
      throw new Error('Missing required fields: userId, amount, type');
    }

    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    console.log('Awarding tokens:', { userId, amount, type, description });

    // Check daily earned amount
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data: todayTransactions, error: todayError } = await supabase
      .from('token_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0)
      .gte('created_at', today.toISOString());

    if (todayError) throw todayError;

    const earnedToday = todayTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

    if (earnedToday >= DAILY_TOKEN_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Daily token limit reached (100 tokens/day)', earnedToday, limit: DAILY_TOKEN_LIMIT }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cap the award to not exceed daily limit
    const allowedAmount = Math.min(amount, DAILY_TOKEN_LIMIT - earnedToday);

    // Duplicate check for post-related actions
    if (postId && (type === 'post_like_received' || type === 'comment_received')) {
      const { data: existing } = await supabase
        .from('token_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('post_id', postId)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Tokens already awarded for this action', duplicate: true }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update user's token balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const newBalance = (profile.token_balance || 0) + allowedAmount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Create transaction record
    const insertData: any = {
      user_id: userId,
      amount: allowedAmount,
      type,
      description,
    };
    if (postId) insertData.post_id = postId;

    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert(insertData);

    if (transactionError) throw transactionError;

    console.log('Tokens awarded successfully:', { allowedAmount, newBalance, earnedToday: earnedToday + allowedAmount });

    return new Response(
      JSON.stringify({ success: true, newBalance, awarded: allowedAmount, earnedToday: earnedToday + allowedAmount, limit: DAILY_TOKEN_LIMIT }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error awarding tokens:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
