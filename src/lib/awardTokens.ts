import { supabase } from '@/integrations/supabase/client';

interface AwardTokensParams {
  type: string;
  description: string;
  postId?: string;
}

export async function awardTokens({ type, description, postId }: AwardTokensParams) {
  try {
    const body: Record<string, string> = { type, description };
    if (postId) body.postId = postId;

    const { data, error } = await supabase.functions.invoke('award-tokens', {
      body,
    });

    if (error) {
      // Try to parse the error context for expected responses (duplicates, limits)
      try {
        const ctx = error.context;
        if (ctx instanceof Response) {
          const errorBody = await ctx.json();
          // These are expected non-error cases
          if (errorBody?.success || errorBody?.duplicate || errorBody?.reason) {
            return errorBody;
          }
          // 429 daily limit is expected
          if (ctx.status === 429) {
            console.info('Daily token limit reached');
            return errorBody;
          }
        }
      } catch {
        // ignore parse errors
      }
      console.error('Token award error:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Token award failed:', err);
    return null;
  }
}
