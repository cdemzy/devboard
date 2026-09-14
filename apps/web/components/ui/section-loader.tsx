import type { LucideIcon } from 'lucide-react'

export function SectionLoader({
	icon: Icon,
	label,
	className = '',
}: {
	icon: LucideIcon
	label: string
	className?: string
}) {
	return (
		<div role="status" className={`ui-section-loader ${className}`}>
			<div className="ui-section-loader-icon">
				<span className="ui-section-loader-spinner" />
				<Icon size={29} className="text-primary" aria-hidden="true" />
			</div>
			<span className="ui-section-loader-label">{label}</span>
		</div>
	)
}
