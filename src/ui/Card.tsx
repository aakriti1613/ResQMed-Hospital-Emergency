import React from 'react';
import { clsx } from 'clsx';

export const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return <div className={clsx('rounded-3xl border border-white/10 bg-white/5 p-6', className)}>{children}</div>;
};

