export type Task = { id: string; list_id: string; text: string; completed: boolean; position: number }
export type TodoList = { id: string; user_id: string; title: string; position: number; tasks: Task[] }
