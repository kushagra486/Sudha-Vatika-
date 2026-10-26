import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        blue: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
        amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        violet: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
        green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
