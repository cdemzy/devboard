import type { ReactNode } from "react";

export function Tooltip({ label, children, className = '', side = 'bottom' }: { label: string; children: ReactNode; className?: string; side?: 'bottom' | 'right' }) {
  return (
    <span className={`ui-tooltip ${side === 'right' ? 'ui-tooltip-right' : ''} ${className}`}>
      {children}
      <span
        role="tooltip"
        className="ui-tooltip-content"
      >
        {label}
      </span>
    </span>
  );
}
