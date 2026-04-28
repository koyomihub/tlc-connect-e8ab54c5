import { useUserPresence, type PresenceStatus } from '@/contexts/PresenceContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PresenceIndicatorProps {
  userId?: string | null;
  /** Override status (skips context lookup). */
  status?: PresenceStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** When true, positioned absolutely as a dot on an avatar. */
  asDot?: boolean;
}

const STATUS_INFO: Record<PresenceStatus, { label: string; color: string; ring: string }> = {
  online: { label: 'Online', color: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  idle: { label: 'Idle', color: 'bg-amber-400', ring: 'ring-amber-400/30' },
  offline: { label: 'Offline', color: 'bg-transparent', ring: '' },
};

export function PresenceIndicator({
  userId,
  status: statusOverride,
  size = 'sm',
  className,
  asDot = true,
}: PresenceIndicatorProps) {
  const fetched = useUserPresence(userId);
  const status = statusOverride ?? fetched;
  if (status === 'offline') return null;

  const info = STATUS_INFO[status];
  const sizeClass =
    size === 'lg' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  const dot = (
    <span
      className={cn(
        'rounded-full ring-2 ring-background',
        info.color,
        sizeClass,
        asDot && 'absolute bottom-0 right-0 block',
        className,
      )}
      aria-label={info.label}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{dot}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {info.label}
      </TooltipContent>
    </Tooltip>
  );
}
