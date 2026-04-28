import { GraduationCap, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { classifyRoles, useUserRoles, type AppRole } from '@/hooks/useUserRoles';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  userId?: string | null;
  /** Pass explicit roles to skip fetching */
  roles?: AppRole[];
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Renders an "Officer" or "Instructor" badge next to a user's name
 * based on their assigned roles. Returns null for students/admins-only.
 */
export function RoleBadge({ userId, roles, size = 'sm', className }: RoleBadgeProps) {
  const fetched = useUserRoles(roles ? null : userId);
  const effective = roles ?? fetched;
  const kind = classifyRoles(effective);
  if (!kind) return null;

  const isInstructor = kind === 'instructor';
  const Icon = isInstructor ? GraduationCap : Shield;
  const label = isInstructor ? 'Instructor' : 'Officer';
  const description = isInstructor
    ? 'Faculty member or instructor at The Lewis College.'
    : 'Recognized officer of a TLC student organization.';

  const sizeClass =
    size === 'md'
      ? 'text-[11px] px-2 py-0.5 gap-1'
      : 'text-[10px] px-1.5 py-0 gap-0.5';
  const iconSize = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  const variantClass = isInstructor
    ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20'
    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'inline-flex items-center font-medium cursor-default align-middle shrink-0',
            sizeClass,
            variantClass,
            className,
          )}
        >
          <Icon className={iconSize} />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
