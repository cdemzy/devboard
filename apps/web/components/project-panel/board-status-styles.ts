import type { Status } from '@/lib/types'

export const statusStyles: Record<
	Status,
	{
		accent: string
		state: string
		ticket: string
		active: string
		drop: string
		emptyDrop: string
		emptyHover: string
	}
> = {
	todo: {
		accent: 'text-[#6C5082]',
		state: 'border-[#6C5082]/35 bg-[#221D25]',
		ticket: 'border-[#6C5082]/45 bg-[#36293F]',
		active: 'ring-1 ring-inset ring-[#6C5082]/70',
		drop: 'bg-[#6C5082]',
		emptyDrop: 'border-[#6C5082] text-[#a371c8]',
		emptyHover:
			'hover:border-[#6C5082] hover:bg-[#6C5082]/15 hover:text-[#a371c8] focus-visible:border-[#6C5082] focus-visible:bg-[#6C5082]/15 focus-visible:text-[#a371c8]',
	},
	in_progress: {
		accent: 'text-[#886826]',
		state: 'border-[#886826]/35 bg-[#23221A]',
		ticket: 'border-[#886826]/45 bg-[#373325]',
		active: 'ring-1 ring-inset ring-[#886826]/70',
		drop: 'bg-[#886826]',
		emptyDrop: 'border-[#886826] text-[#d29922]',
		emptyHover:
			'hover:border-[#886826] hover:bg-[#886826]/15 hover:text-[#d29922] focus-visible:border-[#886826] focus-visible:bg-[#886826]/15 focus-visible:text-[#d29922]',
	},
	done: {
		accent: 'text-[#386C4E]',
		state: 'border-[#386C4E]/35 bg-[#1B211D]',
		ticket: 'border-[#386C4E]/45 bg-[#24342B]',
		active: 'ring-1 ring-inset ring-[#386C4E]/70',
		drop: 'bg-[#386C4E]',
		emptyDrop: 'border-[#386C4E] text-[#56a874]',
		emptyHover:
			'hover:border-[#386C4E] hover:bg-[#386C4E]/15 hover:text-[#56a874] focus-visible:border-[#386C4E] focus-visible:bg-[#386C4E]/15 focus-visible:text-[#56a874]',
	},
}
