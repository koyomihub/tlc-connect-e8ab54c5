import { supabase } from '@/integrations/supabase/client';

interface AwardTokensParams {
  userId: string;
  amount: number;
  type: string;
  description: string;
  postId?: string;
}

export async function awardTokens({ userId, amount, type, description, postId }: AwardTokensParams) {
  try {
    const body: Record<string, any> = { userId, amount, type, description };
    if (postId) body.postId = postId;

    const { data, error } = await supabase.functions.invoke('award-tokens', {
      body,
    });

    if (error) {
      console.error('Token award error:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Token award failed:', err);
    return null;
  }
}
