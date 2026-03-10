import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { nftItemId } = await req.json();

    if (!nftItemId || typeof nftItemId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid nftItemId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch NFT item
    const { data: nftItem, error: nftError } = await supabase
      .from('nft_items')
      .select('*')
      .eq('id', nftItemId)
      .single();

    if (nftError || !nftItem) {
      return new Response(
        JSON.stringify({ error: 'NFT item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (nftItem.available_supply <= 0) {
      return new Response(
        JSON.stringify({ error: 'NFT is sold out' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentBalance = profile.token_balance || 0;
    if (currentBalance < nftItem.price) {
      return new Response(
        JSON.stringify({ error: 'Insufficient token balance', required: nftItem.price, current: currentBalance }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atomically: deduct tokens, insert user_nfts, decrement supply, record transaction
    const newBalance = currentBalance - nftItem.price;

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', userId);

    if (balanceError) throw balanceError;

    const { error: nftInsertError } = await supabase
      .from('user_nfts')
      .insert({ user_id: userId, nft_item_id: nftItemId });

    if (nftInsertError) throw nftInsertError;

    const { error: supplyError } = await supabase
      .from('nft_items')
      .update({ available_supply: nftItem.available_supply - 1 })
      .eq('id', nftItemId);

    if (supplyError) throw supplyError;

    const { error: txError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        amount: -nftItem.price,
        type: 'nft_purchase',
        description: `Purchased ${nftItem.name}`,
      });

    if (txError) throw txError;

    return new Response(
      JSON.stringify({ success: true, newBalance, nftName: nftItem.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error purchasing NFT:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your purchase' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
