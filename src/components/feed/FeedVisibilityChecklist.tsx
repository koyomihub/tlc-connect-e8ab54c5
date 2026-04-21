import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STORAGE_KEY = 'feed-visibility-checklist-v1';

const checklistSteps = [
  {
    id: 'create-public',
    label: 'Create one Public post',
    helper: 'It should be visible to everyone.',
  },
  {
    id: 'create-followers',
    label: 'Create one Followers post',
    helper: 'It should be visible only to followers and you.',
  },
  {
    id: 'verify-own-feed',
    label: 'Confirm both posts appear on your Feed',
    helper: 'You should always see your own posts.',
  },
  {
    id: 'open-second-user',
    label: 'Open a second account that does not follow you',
    helper: 'Use People to open your profile or return to Feed.',
  },
  {
    id: 'verify-public-non-follower',
    label: 'Confirm the second account sees only your Public post',
    helper: 'Your Followers post should stay hidden here.',
  },
  {
    id: 'verify-followers-after-follow',
    label: 'After following you, confirm the Followers post appears',
    helper: 'This verifies follower-only visibility.',
  },
] as const;

type ChecklistState = Record<string, boolean>;

export function FeedVisibilityChecklist() {
  const [checkedSteps, setCheckedSteps] = useState<ChecklistState>(() => {
    if (typeof window === 'undefined') return {};

    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedSteps));
  }, [checkedSteps]);

  const completedCount = useMemo(
    () => checklistSteps.filter((step) => checkedSteps[step.id]).length,
    [checkedSteps]
  );

  const toggleStep = (stepId: string, isChecked: boolean) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [stepId]: isChecked,
    }));
  };

  const resetChecklist = () => {
    setCheckedSteps({});
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Visibility checklist</h2>
            <Badge variant={completedCount === checklistSteps.length ? 'default' : 'secondary'}>
              {completedCount}/{checklistSteps.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Run this once with your account, then with a second account that does not follow you yet.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={resetChecklist}>
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {checklistSteps.map((step) => {
          const checkboxId = `feed-checklist-${step.id}`;

          return (
            <label
              key={step.id}
              htmlFor={checkboxId}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
            >
              <Checkbox
                id={checkboxId}
                checked={Boolean(checkedSteps[step.id])}
                onCheckedChange={(value) => toggleStep(step.id, value === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.helper}</p>
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
