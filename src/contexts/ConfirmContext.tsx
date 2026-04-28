import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ConfirmCtx = createContext<((opts?: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Provides an imperative confirm() function. Useful in dropdown menus or
 * handlers where wrapping a component in AlertDialog is awkward.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete?', destructive: true })) { ... }
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const handleClose = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(o) => !o && handleClose(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title ?? 'Are you sure?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {state?.description ?? 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {state?.cancelText ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClose(true)}
              className={state?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {state?.confirmText ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
