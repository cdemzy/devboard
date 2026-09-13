import type { ReactNode } from "react";

export function Tooltip({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={`ui-tooltip ${className}`}>
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
