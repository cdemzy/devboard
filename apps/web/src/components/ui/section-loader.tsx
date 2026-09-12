import type { LucideIcon } from "lucide-react";

export function SectionLoader({
  icon: Icon,
  label,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex min-h-[65vh] flex-col items-center justify-center gap-4 text-muted-foreground ${className}`}
    >
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <Icon size={29} className="text-primary" aria-hidden="true" />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}
