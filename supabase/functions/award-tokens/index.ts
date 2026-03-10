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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate JWT and extract real user ID
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { amount, type, description, postId } = await req.json();

    if (!amount || !type) {
      throw new Error('Missing required fields: amount, type');
    }
    if (amount <= 0 || amount > 50) {
      throw new Error('Invalid amount');
    }

    // Determine the target user: for "received" types, look up the content owner server-side
    let targetUserId = callerUserId;

    const receivedTypes = ['post_like_received', 'comment_received'];
    if (receivedTypes.includes(type)) {
      if (!postId) {
        throw new Error('postId required for received-type awards');
      }
      // Look up the actual owner of the post/thread
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        // Try threads table
        const { data: thread, error: threadError } = await supabase
          .from('threads')
          .select('user_id')
          .eq('id', postId)
          .single();

        if (threadError || !thread) {
          throw new Error('Content not found');
        }
        targetUserId = thread.user_id;
      } else {
        targetUserId = post.user_id;
      }

      // Don't award tokens to yourself
      if (targetUserId === callerUserId) {
        return new Response(
          JSON.stringify({ success: true, awarded: 0, reason: 'self_interaction' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Awarding tokens:', { targetUserId, amount, type, description });

    // Check daily earned amount for target user
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data: todayTransactions, error: todayError } = await supabase
      .from('token_transactions')
      .select('amount')
      .eq('user_id', targetUserId)
      .gt('amount', 0)
      .gte('created_at', today.toISOString());

    if (todayError) throw todayError;

    const earnedToday = todayTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

    if (earnedToday >= DAILY_TOKEN_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Daily token limit reached', earnedToday, limit: DAILY_TOKEN_LIMIT }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedAmount = Math.min(amount, DAILY_TOKEN_LIMIT - earnedToday);

    // Duplicate check for post-related actions
    if (postId && receivedTypes.includes(type)) {
      const { data: existing } = await supabase
        .from('token_transactions')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('type', type)
        .eq('post_id', postId)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: true, awarded: 0, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update token balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', targetUserId)
      .single();

    if (profileError) throw profileError;

    const newBalance = (profile.token_balance || 0) + allowedAmount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', targetUserId);

    if (updateError) throw updateError;

    // Create transaction record
    const insertData: any = {
      user_id: targetUserId,
      amount: allowedAmount,
      type,
      description,
    };
    if (postId) insertData.post_id = postId;

    const { error: transactionError } = await supabase
      .from('token_transactions')
      .insert(insertData);

    if (transactionError) throw transactionError;

    return new Response(
      JSON.stringify({ success: true, newBalance, awarded: allowedAmount, earnedToday: earnedToday + allowedAmount, limit: DAILY_TOKEN_LIMIT }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error awarding tokens:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
