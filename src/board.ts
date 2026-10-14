import { arrayMove } from '@dnd-kit/sortable'
import type { Task, TodoList } from './types'

export function reorderLists(lists: TodoList[], activeId: string, overId: string): TodoList[] {
  const from = lists.findIndex((list) => list.id === activeId)
  const to = lists.findIndex((list) => list.id === overId)
  return from < 0 || to < 0 ? lists : arrayMove(lists, from, to)
}

export function moveTask(
  lists: TodoList[],
  taskId: string,
  targetId: string,
  insertAfter = false,
): TodoList[] {
  const from = lists.findIndex((list) => list.tasks.some((task) => task.id === taskId))
  const to = lists.findIndex(
    (list) => list.id === targetId || list.tasks.some((task) => task.id === targetId),
  )
  if (from < 0 || to < 0) return lists

  const fromIndex = lists[from].tasks.findIndex((task) => task.id === taskId)
  const targetIndex = lists[to].tasks.findIndex((task) => task.id === targetId)
  if (from === to && targetIndex >= 0) {
    return lists.map((list, index) =>
      index === from
        ? {
            ...list,
            tasks: arrayMove(list.tasks, fromIndex, targetIndex).map((task, position) => ({
              ...task,
              position,
            })),
          }
        : list,
    )
  }

  const source = [...lists[from].tasks]
  const [task] = source.splice(fromIndex, 1)
  const destination = from === to ? source : [...lists[to].tasks]
  const overIndex = destination.findIndex((item) => item.id === targetId)
  const insertAt = overIndex < 0 ? destination.length : overIndex + (insertAfter ? 1 : 0)
  destination.splice(insertAt, 0, { ...task, list_id: lists[to].id })

  return lists.map((list, index) =>
    index === from
      ? { ...list, tasks: source.map((item, position) => ({ ...item, position })) }
      : index === to
        ? { ...list, tasks: destination.map((item, position) => ({ ...item, position })) }
        : list,
  )
}

export function taskWrites(
  lists: TodoList[],
  next: TodoList[],
  taskId: string,
): Array<{ task: Task; listId: string; position: number }> {
  const changed = next.find((list) => list.tasks.some((task) => task.id === taskId))
  if (!changed) return []
  const previous = lists.find((list) => list.tasks.some((task) => task.id === taskId))
  const writes = changed.tasks.map((task, position) => ({ task, listId: changed.id, position }))
  if (previous && previous.id !== changed.id) {
    writes.push(
      ...(next.find((list) => list.id === previous.id)?.tasks ?? []).map((task, position) => ({
        task,
        listId: previous.id,
        position,
      })),
    )
  }
  return writes
}
