import { describe, expect, it } from 'vitest'
import { moveTask, reorderLists, taskWrites } from './board'
import type { TodoList } from './types'

const board: TodoList[] = [
  {
    id: 'one',
    user_id: 'user',
    title: 'One',
    position: 0,
    tasks: [
      { id: 'a', list_id: 'one', text: 'A', completed: false, position: 0 },
      { id: 'b', list_id: 'one', text: 'B', completed: false, position: 1 },
    ],
  },
  {
    id: 'two',
    user_id: 'user',
    title: 'Two',
    position: 1,
    tasks: [{ id: 'c', list_id: 'two', text: 'C', completed: false, position: 0 }],
  },
]

describe('board ordering', () => {
  it('reorders lists and preserves task contents', () => {
    const result = reorderLists(board, 'two', 'one')
    expect(result.map((list) => list.id)).toEqual(['two', 'one'])
    expect(result[0].tasks[0].id).toBe('c')
  })

  it('reorders tasks in the same list', () => {
    const result = moveTask(board, 'b', 'a')
    expect(result[0].tasks.map((task) => task.id)).toEqual(['b', 'a'])
    expect(result[1].tasks.map((task) => task.id)).toEqual(['c'])
  })

  it('moves a task down when dropped on the following task', () => {
    const result = moveTask(board, 'a', 'b')
    expect(result[0].tasks.map((task) => task.id)).toEqual(['b', 'a'])
  })

  it('moves a task to another list and returns writes for both lists', () => {
    const result = moveTask(board, 'a', 'c')
    expect(result[0].tasks.map((task) => task.id)).toEqual(['b'])
    expect(result[1].tasks.map((task) => task.id)).toEqual(['a', 'c'])
    expect(result[1].tasks[0].list_id).toBe('two')
    expect(
      taskWrites(board, result, 'a').map((write) => [write.task.id, write.listId, write.position]),
    ).toEqual([
      ['a', 'two', 0],
      ['c', 'two', 1],
      ['b', 'one', 0],
    ])
  })

  it('inserts a cross-list task after the row it is dropped below', () => {
    const result = moveTask(board, 'a', 'c', true)
    expect(result[1].tasks.map((task) => task.id)).toEqual(['c', 'a'])
  })
})
