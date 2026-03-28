import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DAILY_TOKEN_LIMIT = 100;

const ALLOWED_TYPES: Record<string, number> = {
  daily_login: 10,
  post_created: 5,
  thread_created: 5,
  comment_created: 3,
  group_joined: 5,
  post_like_received: 2,
  comment_received: 2,
};

const POST_DEDUP_TYPES = ['post_like_received', 'comment_received', 'post_created', 'thread_created', 'comment_created'];
const RECEIVED_TYPES = ['post_like_received', 'comment_received'];
const DAILY_DEDUP_TYPES = ['daily_login'];
const REQUIRES_POST_ID = ['post_created', 'thread_created', 'comment_created', 'post_like_received', 'comment_received'];

// Limit: max 3 post_created rewards per day
const DAILY_COUNT_LIMITS: Record<string, number> = {
  post_created: 3,
};

// Limit: max 1 group_joined reward per week
const WEEKLY_COUNT_LIMITS: Record<string, number> = {
  group_joined: 1,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use getUser() to validate the JWT — getClaims doesn't exist
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = authUser.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, description, postId, parentPostId } = await req.json();

    if (!type || !(type in ALLOWED_TYPES)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or unknown action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (REQUIRES_POST_ID.includes(type) && !postId) {
      return new Response(
        JSON.stringify({ error: 'postId is required for this action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amount = ALLOWED_TYPES[type];
    let targetUserId = callerUserId;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // --- Received types: award to content owner ---
    if (RECEIVED_TYPES.includes(type)) {
      const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
      if (!post) {
        const { data: thread } = await supabase.from('threads').select('user_id').eq('id', postId).single();
        if (!thread) {
          return new Response(JSON.stringify({ error: 'Content not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        targetUserId = thread.user_id;
      } else {
        targetUserId = post.user_id;
      }
      if (targetUserId === callerUserId) {
        return new Response(JSON.stringify({ success: true, awarded: 0, reason: 'self_interaction' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (type === 'post_created') {
      const { data: post } = await supabase.from('posts').select('id').eq('id', postId).eq('user_id', callerUserId).single();
      if (!post) return new Response(JSON.stringify({ error: 'Post not found or does not belong to you' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (type === 'thread_created') {
      const { data: thread } = await supabase.from('threads').select('id').eq('id', postId).eq('user_id', callerUserId).single();
      if (!thread) return new Response(JSON.stringify({ error: 'Thread not found or does not belong to you' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (type === 'comment_created') {
      const { data: comment } = await supabase.from('post_comments').select('id').eq('id', postId).eq('user_id', callerUserId).single();
      if (!comment) return new Response(JSON.stringify({ error: 'Comment not found or does not belong to you' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (type === 'group_joined') {
      const { data: membership } = await supabase.from('group_members').select('id').eq('user_id', callerUserId).limit(1);
      if (!membership || membership.length === 0) {
        return new Response(JSON.stringify({ error: 'You are not a member of any group' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- Post-based dedup ---
    if (POST_DEDUP_TYPES.includes(type)) {
      const { data: existing } = await supabase.from('token_transactions').select('id')
        .eq('user_id', targetUserId).eq('type', type).eq('post_id', postId).limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ success: true, awarded: 0, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- Daily dedup (daily_login) ---
    if (DAILY_DEDUP_TYPES.includes(type)) {
      const { data: existing } = await supabase.from('token_transactions').select('id')
        .eq('user_id', targetUserId).eq('type', type).gte('created_at', today.toISOString()).limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ success: true, awarded: 0, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- Daily count limits (e.g. 3 post_created per day) ---
    if (type in DAILY_COUNT_LIMITS) {
      const { data: todayCounts } = await supabase.from('token_transactions').select('id')
        .eq('user_id', targetUserId).eq('type', type).gte('created_at', today.toISOString());
      if (todayCounts && todayCounts.length >= DAILY_COUNT_LIMITS[type]) {
        return new Response(JSON.stringify({ success: true, awarded: 0, reason: 'daily_type_limit_reached' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- Weekly count limits (e.g. 1 group_joined per week) ---
    if (type in WEEKLY_COUNT_LIMITS) {
      const weekAgo = new Date();
      weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
      weekAgo.setUTCHours(0, 0, 0, 0);
      const { data: weekCounts } = await supabase.from('token_transactions').select('id')
        .eq('user_id', targetUserId).eq('type', type).gte('created_at', weekAgo.toISOString());
      if (weekCounts && weekCounts.length >= WEEKLY_COUNT_LIMITS[type]) {
        return new Response(JSON.stringify({ success: true, awarded: 0, reason: 'weekly_type_limit_reached' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- Daily global token limit ---
    const { data: todayTransactions, error: todayError } = await supabase.from('token_transactions')
      .select('amount').eq('user_id', targetUserId).gt('amount', 0).gte('created_at', today.toISOString());
    if (todayError) throw todayError;

    const earnedToday = todayTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    if (earnedToday >= DAILY_TOKEN_LIMIT) {
      return new Response(JSON.stringify({ error: 'Daily token limit reached', earnedToday, limit: DAILY_TOKEN_LIMIT }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allowedAmount = Math.min(amount, DAILY_TOKEN_LIMIT - earnedToday);

    // --- Update balance ---
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('token_balance').eq('id', targetUserId).single();
    if (profileError) throw profileError;

    const newBalance = (profile.token_balance || 0) + allowedAmount;
    const { error: updateError } = await supabase.from('profiles').update({ token_balance: newBalance }).eq('id', targetUserId);
    if (updateError) throw updateError;

    // --- Record transaction ---
    const insertData: Record<string, unknown> = {
      user_id: targetUserId, amount: allowedAmount, type, description: description || type,
    };
    // For comment_created, store the parent post_id (valid FK) instead of the comment id
    const storablePostId = type === 'comment_created' && parentPostId ? parentPostId : postId;
    if (storablePostId) insertData.post_id = storablePostId;

    const { error: transactionError } = await supabase.from('token_transactions').insert(insertData);
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
