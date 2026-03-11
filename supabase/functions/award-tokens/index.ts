import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DAILY_TOKEN_LIMIT = 100;

// Server-side allowlist: type → fixed amount
const ALLOWED_TYPES: Record<string, number> = {
  daily_login: 10,
  post_created: 5,
  thread_created: 5,
  comment_created: 3,
  group_joined: 5,
  post_like_received: 2,
  comment_received: 2,
};

// Types that require a postId for dedup
const POST_DEDUP_TYPES = ['post_like_received', 'comment_received', 'post_created', 'thread_created', 'comment_created'];

// Types that are received by content owner (not the caller)
const RECEIVED_TYPES = ['post_like_received', 'comment_received'];

// Types with once-per-day dedup (no postId needed)
const DAILY_DEDUP_TYPES = ['daily_login', 'group_joined'];

// Types that require a postId (all post-based types)
const REQUIRES_POST_ID = ['post_created', 'thread_created', 'comment_created', 'post_like_received', 'comment_received'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate JWT
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

    const { type, description, postId } = await req.json();

    // Validate type against allowlist
    if (!type || !(type in ALLOWED_TYPES)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or unknown action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require postId for all post-based types
    if (REQUIRES_POST_ID.includes(type) && !postId) {
      return new Response(
        JSON.stringify({ error: 'postId is required for this action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use server-defined amount, ignore any client-supplied amount
    const amount = ALLOWED_TYPES[type];

    // Determine target user
    let targetUserId = callerUserId;

    if (RECEIVED_TYPES.includes(type)) {
      // Look up the actual owner of the post/thread
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        const { data: thread, error: threadError } = await supabase
          .from('threads')
          .select('user_id')
          .eq('id', postId)
          .single();

        if (threadError || !thread) {
          return new Response(
            JSON.stringify({ error: 'Content not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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
    } else if (type === 'post_created') {
      // Verify post exists and belongs to caller
      const { data: post } = await supabase
        .from('posts')
        .select('id')
        .eq('id', postId)
        .eq('user_id', callerUserId)
        .single();

      if (!post) {
        return new Response(
          JSON.stringify({ error: 'Post not found or does not belong to you' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (type === 'thread_created') {
      // Verify thread exists and belongs to caller
      const { data: thread } = await supabase
        .from('threads')
        .select('id')
        .eq('id', postId)
        .eq('user_id', callerUserId)
        .single();

      if (!thread) {
        return new Response(
          JSON.stringify({ error: 'Thread not found or does not belong to you' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (type === 'comment_created') {
      // Verify comment exists and belongs to caller
      const { data: comment } = await supabase
        .from('post_comments')
        .select('id')
        .eq('id', postId)
        .eq('user_id', callerUserId)
        .single();

      if (!comment) {
        return new Response(
          JSON.stringify({ error: 'Comment not found or does not belong to you' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (type === 'group_joined') {
      // Verify the user is actually a member of a group
      const { data: membership } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', callerUserId)
        .limit(1);

      if (!membership || membership.length === 0) {
        return new Response(
          JSON.stringify({ error: 'You are not a member of any group' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Deduplication checks
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Post-based dedup: one award per (user, type, postId)
    if (POST_DEDUP_TYPES.includes(type)) {
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

    // Daily dedup: one award per (user, type) per UTC day
    if (DAILY_DEDUP_TYPES.includes(type)) {
      const { data: existing } = await supabase
        .from('token_transactions')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('type', type)
        .gte('created_at', today.toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ success: true, awarded: 0, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check daily earned amount
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
    const insertData: Record<string, unknown> = {
      user_id: targetUserId,
      amount: allowedAmount,
      type,
      description: description || type,
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
