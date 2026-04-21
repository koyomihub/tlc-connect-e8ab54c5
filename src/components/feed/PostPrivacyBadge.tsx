import { Globe, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type PostPrivacy = 'public' | 'friends' | 'private' | null | undefined;

interface PostPrivacyBadgeProps {
  privacy: PostPrivacy;
}

export function PostPrivacyBadge({ privacy }: PostPrivacyBadgeProps) {
  const isFollowersOnly = privacy === 'friends';

  return (
    <Badge variant={isFollowersOnly ? 'secondary' : 'outline'} className="gap-1 rounded-md px-2 py-1 text-[11px] font-medium">
      {isFollowersOnly ? <Users className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
      {isFollowersOnly ? 'Followers' : 'Public'}
    </Badge>
  );
}
