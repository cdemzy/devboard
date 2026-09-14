import { describe, expect, it } from 'vitest'
import { columnTasks, moveTask } from './board'
import type { Task } from './types'
const task = (id: string, status: Task['status'], position: number): Task => ({
	id,
	status,
	position,
	title: id,
	ticket_number: position + 1,
	ticket_id: `DE-${position + 1}`,
	project_id: 'project',
	description: '',
	priority: 'medium',
	complexity: 'standard',
	archived: false,
	created_at: '',
	updated_at: '',
})
describe('optimistic board movement', () => {
	it('moves into an empty column without mutating the rollback snapshot', () => {
		const original = [task('a', 'todo', 0), task('b', 'todo', 1)]
		const next = moveTask(original, 'a', 'done', 0)
		expect(columnTasks(next, 'done').map((t) => t.id)).toEqual(['a'])
		expect(columnTasks(next, 'todo')[0].position).toBe(0)
		expect(original[0].status).toBe('todo')
		expect(original[1].position).toBe(1)
	})
	it('reorders in both directions and keeps contiguous positions', () => {
		const original = ['a', 'b', 'c'].map((id, i) => task(id, 'todo', i))
		const moved = moveTask(original, 'a', 'todo', 2)
		expect(columnTasks(moved, 'todo').map((t) => t.id)).toEqual(['b', 'c', 'a'])
		expect(columnTasks(moveTask(moved, 'a', 'todo', 0), 'todo').map((t) => t.id)).toEqual(
			['a', 'b', 'c'],
		)
		expect(moved.map((t) => t.position)).toEqual([0, 1, 2])
	})
	it('clamps a stale target position', () => {
		expect(moveTask([task('a', 'todo', 0)], 'a', 'done', 20)[0].position).toBe(0)
	})
})
