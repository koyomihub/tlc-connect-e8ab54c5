import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface AvatarWithPresenceProps {
  userId?: string | null;
  src?: string | null;
  fallback?: ReactNode;
  className?: string;
  /** Indicator size */
  indicatorSize?: 'sm' | 'md' | 'lg';
  /** Whether to show presence dot. */
  showPresence?: boolean;
}

/**
 * Avatar wrapper that overlays a small presence dot in the bottom-right.
 * Wraps avatar in a relative container so the indicator can absolutely position.
 */
export function AvatarWithPresence({
  userId,
  src,
  fallback,
  className,
  indicatorSize = 'sm',
  showPresence = true,
}: AvatarWithPresenceProps) {
  return (
    <div className="relative inline-block shrink-0">
      <Avatar className={className}>
        {src ? <AvatarImage src={src} /> : null}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      {showPresence && userId && (
        <PresenceIndicator userId={userId} size={indicatorSize} asDot />
      )}
    </div>
  );
}
