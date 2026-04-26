import React from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export const Button = ({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed';
  const sizes =
    size === 'sm'
      ? 'h-9 rounded-xl px-3 text-xs'
      : size === 'lg'
        ? 'h-12 rounded-2xl px-5 text-sm'
        : 'h-11 rounded-2xl px-4 text-sm';

  const variants =
    variant === 'primary'
      ? 'bg-white text-slate-950 hover:bg-white/90'
      : variant === 'danger'
        ? 'bg-rose-500 text-white hover:bg-rose-400'
        : variant === 'ghost'
          ? 'bg-transparent text-white/80 hover:text-white'
          : 'bg-white/10 text-white hover:bg-white/15';

  return <button className={clsx(base, sizes, variants, className)} {...props} />;
};

