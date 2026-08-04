import type { ReactNode } from 'react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const styles: Record<AlertVariant, string> = {
  success: 'bg-emerald-50 border-emerald-600 text-emerald-900',
  error: 'bg-red-50 border-red-600 text-red-900',
  warning: 'bg-amber-50 border-amber-600 text-amber-900',
  info: 'bg-blue-50 border-blue-600 text-blue-900',
};

interface FormAlertProps {
  variant: AlertVariant;
  title: string;
  children?: ReactNode;
  id?: string;
}

/** Banner accesible — WCAG 2.1 AA role=alert / aria-live */
export function FormAlert({ variant, title, children, id }: FormAlertProps) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className={`rounded-lg border-l-4 p-4 ${styles[variant]}`}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-2 text-sm">{children}</div> : null}
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ id, label, error, hint, required, children }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (obligatorio)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      <div aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}>
        {children}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-institucional-600 focus:outline-none focus:ring-2 focus:ring-institucional-600/30 disabled:bg-slate-100 disabled:cursor-not-allowed';

export function textInputClass(hasError?: boolean): string {
  return `${inputClass} ${hasError ? 'border-red-500' : ''}`;
}

export { inputClass };
