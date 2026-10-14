import { useEffect, useState, type FormEvent } from 'react'
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { DndContext, PointerSensor, TouchSensor, closestCenter, pointerWithin, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronLeft, CircleUserRound, GripVertical, LogOut, Plus, Settings2, Trash2 } from 'lucide-react'
import type { AuthSession as Session, AuthUser as User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Task, TodoList } from './types'
import { moveTask, reorderLists, taskWrites } from './board'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => setSession(current))
    return () => subscription.unsubscribe()
  }, [])
  const tell = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3600) }
  if (checking) return <main className="screen-center"><span className="loader" /> <span>Getting things ready…</span></main>
  return <>
    {!isSupabaseConfigured && <div className="setup-banner">Add your Supabase URL and anon key to <code>.env</code> to enable accounts and saved boards.</div>}
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <AuthPage mode="login" tell={tell} />} />
      <Route path="/register" element={session ? <Navigate to="/" replace /> : <AuthPage mode="register" tell={tell} />} />
      <Route path="/" element={session ? <Board user={session.user} tell={tell} /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={session ? <Profile user={session.user} tell={tell} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
    </Routes>
    {notice && <div className="toast" role="status">{notice}</div>}
  </>
}

function AuthPage({ mode, tell }: { mode: 'login' | 'register'; tell: (s: string) => void }) {
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase) return tell('Configure Supabase to create an account or sign in.')
    const form = new FormData(e.currentTarget); const email = String(form.get('email')).trim(); const password = String(form.get('password'))
    if (!email || password.length < 8) return tell('Enter an email and a password with at least 8 characters.')
    setBusy(true)
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name: String(form.get('name')).trim() } } })
    setBusy(false)
    if (result.error) return tell(mode === 'login' ? 'We couldn’t sign you in. Check your details and try again.' : 'We couldn’t create your account. Check your details and try again.')
    if (mode === 'register' && !result.data.session) return tell('Check your inbox to confirm your email, then sign in.')
    navigate('/')
  }
  return <main className="auth-page"><Link to="/login" className="brand"><span className="brand-mark"><Check size={19} strokeWidth={3} /></span> simpletodo<span className="brand-period">.</span></Link>
    <section className="auth-card"><div className="eyebrow">A LITTLE MORE ORGANIZED</div><h1>{mode === 'login' ? 'Welcome back.' : 'A fresh start.'}</h1><p className="muted">{mode === 'login' ? 'Your lists are right where you left them.' : 'Make a little space for what matters.'}</p>
      <form onSubmit={submit} className="stack-form">{mode === 'register' && <label>Your name<input name="name" autoComplete="name" maxLength={80} required placeholder="What should we call you?" /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters" /></label><button className="primary wide" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form>
      <p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Link></p>
    </section><p className="auth-foot">A quieter way to get things done.</p>
  </main>
}

function Header({ user }: { user: User }) {
  return <header className="topbar"><Link to="/" className="brand"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span> simpletodo<span className="brand-period">.</span></Link><nav><Link to="/profile" className="profile-link"><CircleUserRound size={17} /><span>{user.user_metadata.name || 'Account'}</span><span className="avatar">{String(user.user_metadata.name || user.email || 'A').slice(0, 1).toUpperCase()}</span></Link></nav></header>
}

function Board({ user, tell }: { user: User; tell: (s: string) => void }) {
  const [lists, setLists] = useState<TodoList[]>([]); const [loading, setLoading] = useState(true); const [addingList, setAddingList] = useState(false); const [newTitle, setNewTitle] = useState('')
  const [dropPreview, setDropPreview] = useState<{ sourceListId: string; targetListId: string | null; targetTaskId: string | null; after: boolean } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }))
  useEffect(() => { void load() }, [user.id])
  async function load() {
    if (!supabase) return setLoading(false)
    setLoading(true)
    const { data: rows, error } = await supabase.from('lists').select('id,user_id,title,position,tasks(id,list_id,text,completed,position)').order('position').order('position', { referencedTable: 'tasks' })
    if (error) tell('Your board couldn’t be loaded. Please refresh and try again.')
    else setLists((rows ?? []).map((row: TodoList) => ({ ...row, tasks: row.tasks ?? [] })))
    setLoading(false)
  }
  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      const next = lists.filter((list) => list.id !== id).map((list, position) => ({ ...list, position }))
      setLists(next)
      if (supabase) void Promise.all(next.map((list) => supabase!.from('lists').update({ position: list.position }).eq('id', list.id)))
    }
    window.addEventListener('simpletodo:list-deleted', listener)
    return () => window.removeEventListener('simpletodo:list-deleted', listener)
  }, [lists])
  async function persistLists(next: TodoList[]) {
    setLists(next)
    if (!supabase) return
    const results = await Promise.all(next.map((list, position) => supabase!.from('lists').update({ position }).eq('id', list.id)))
    if (results.some((result: { error: unknown }) => Boolean(result.error))) { tell('The list order couldn’t be saved. Restoring your board.'); void load() }
  }
  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDropPreview(null)
    if (!over || active.id === over.id) return
    const activeId = String(active.id); const overId = String(over.id)
    if (active.data.current?.kind === 'list') {
      void persistLists(reorderLists(lists, activeId, overId)); return
    }
    const overIsTask = lists.some((list) => list.tasks.some((task) => task.id === overId))
    const activeRect = active.rect.current.translated
    const insertAfter = overIsTask && activeRect !== null
      && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
    const next = moveTask(lists, activeId, overId, insertAfter)
    setLists(next)
    if (!supabase) return
    const writes = taskWrites(lists, next, activeId).map(({ task, listId, position }) => supabase!.from('tasks').update({ list_id: listId, position }).eq('id', task.id))
    const result = await Promise.all(writes)
    if (result.some((r: { error: unknown }) => Boolean(r.error))) { tell('That move couldn’t be saved. Restoring your board.'); void load() }
  }
  function onDragStart(event: DragEndEvent) {
    const { active } = event
    if (active.data.current?.kind !== 'task') { setDropPreview(null); return }
    const source = lists.find((list) => list.tasks.some((task) => task.id === String(active.id)))
    setDropPreview(source ? { sourceListId: source.id, targetListId: null, targetTaskId: null, after: false } : null)
  }
  function onDragOver(event: DragEndEvent) {
    const { active, over } = event
    if (active.data.current?.kind !== 'task' || !over || !dropPreview) return
    const overId = String(over.id)
    const target = lists.find((list) => list.id === overId || list.tasks.some((task) => task.id === overId))
    if (!target || target.id === dropPreview.sourceListId) {
      setDropPreview({ ...dropPreview, targetListId: null, targetTaskId: null, after: false })
      return
    }
    const isTaskTarget = target.tasks.some((task) => task.id === overId)
    const activeRect = active.rect.current.translated
    const after = isTaskTarget && activeRect !== null
      && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
    setDropPreview({ ...dropPreview, targetListId: target.id, targetTaskId: isTaskTarget ? overId : null, after })
  }
  async function createList(e: FormEvent) {
    e.preventDefault(); const title = newTitle.trim(); if (!title || !supabase) return
    const { data, error } = await supabase.from('lists').insert({ user_id: user.id, title, position: lists.length }).select('id,user_id,title,position').single()
    if (error) return tell('That list couldn’t be created. Try again.')
    setLists([...lists, { ...data, tasks: [] }]); setNewTitle(''); setAddingList(false)
  }
  if (loading) return <><Header user={user} /><main className="screen-center"><span className="loader" /><span>Loading your lists…</span></main></>
  return <div className="app-shell"><Header user={user} /><main className="board-main">
    <div className="board-heading"><div><div className="eyebrow">YOUR SPACE</div><h1>A little more organized<span className="heading-period">.</span></h1><p>One thing at a time is plenty.</p></div>{lists.length > 0 && <button className="primary add-list-top" onClick={() => setAddingList(true)}><Plus size={17} /> Add a list</button>}</div>
    {lists.length === 0 ? <section className="empty-state"><div className="empty-art"><span /><span /><span /></div><div className="eyebrow">A CLEAR START</div><h2>Nothing on your mind yet.</h2><p>Make your first list, and take it from there.</p><button className="primary" onClick={() => setAddingList(true)}><Plus size={17} /> Create your first list</button></section> :
      <DndContext sensors={sensors} collisionDetection={(args) => {
        if (args.active.data.current?.kind === 'list') {
          return closestCenter(args).filter((collision) => lists.some((list) => list.id === collision.id))
        }
        const underPointer = pointerWithin(args)
        const taskCollision = underPointer.find((collision) => lists.some((list) => list.tasks.some((task) => task.id === collision.id)))
        if (taskCollision) return [taskCollision]
        const listCollision = underPointer.find((collision) => lists.some((list) => list.id === collision.id))
        if (listCollision) return [listCollision]
        return closestCenter(args)
      }} onDragStart={onDragStart} onDragOver={onDragOver} onDragCancel={() => setDropPreview(null)} onDragEnd={(event) => void onDragEnd(event)}><SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}><div className="board-scroll"><div className="list-row">{lists.map((list) => <SortableList key={list.id} list={list} onChange={(updated) => setLists(lists.map((l) => l.id === updated.id ? updated : l))} tell={tell} isDropTarget={dropPreview?.targetListId === list.id} dropTargetTaskId={dropPreview?.targetListId === list.id ? dropPreview.targetTaskId : null} dropAfter={dropPreview?.targetListId === list.id && dropPreview.after} />)}<button className="add-list-card" onClick={() => setAddingList(true)}><span className="add-list-icon"><Plus size={19} /></span><span>Add another list</span></button></div></div></SortableContext></DndContext>}
    </main>
    {addingList && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAddingList(false) }}><form className="modal" onSubmit={(e) => void createList(e)}><div className="eyebrow">NEW LIST</div><h2>What’s on your mind?</h2><label className="sr-only" htmlFor="list-title">List title</label><input id="list-title" autoFocus maxLength={80} required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Give your list a name" /><div className="modal-actions"><button type="button" className="quiet-button" onClick={() => setAddingList(false)}>Cancel</button><button className="primary">Create list <span aria-hidden>→</span></button></div></form></div>}
  </div>
}

function SortableList({ list, onChange, tell, isDropTarget, dropTargetTaskId, dropAfter }: { list: TodoList; onChange: (list: TodoList) => void; tell: (s: string) => void; isDropTarget: boolean; dropTargetTaskId: string | null | undefined; dropAfter: boolean | undefined }) {
  const sortable = useSortable({ id: list.id, data: { kind: 'list' } }); const [editing, setEditing] = useState(false); const [title, setTitle] = useState(list.title); const [taskText, setTaskText] = useState(''); const [addingTask, setAddingTask] = useState(false)
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.45 : 1 }
  async function saveTitle(e: FormEvent) {
    e.preventDefault(); const value = title.trim(); if (!value || !supabase) return
    const { error } = await supabase.from('lists').update({ title: value }).eq('id', list.id)
    if (error) { tell('The list name couldn’t be changed.'); setTitle(list.title) } else onChange({ ...list, title: value }); setEditing(false)
  }
  async function addTask(e: FormEvent) {
    e.preventDefault(); const value = taskText.trim(); if (!value || !supabase) return
    const { data, error } = await supabase.from('tasks').insert({ list_id: list.id, text: value, position: list.tasks.length }).select().single()
    if (error) return tell('That task couldn’t be added. Try again.')
    onChange({ ...list, tasks: [...list.tasks, data as Task] }); setTaskText(''); setAddingTask(false)
  }
  async function updateTask(task: Task, patch: Partial<Task>) {
    if (!supabase) return
    const next = list.tasks.map((item) => item.id === task.id ? { ...item, ...patch } : item); onChange({ ...list, tasks: next })
    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)
    if (error) { tell('That task change couldn’t be saved.'); onChange({ ...list, tasks: list.tasks }) }
  }
  async function removeTask(task: Task) {
    if (!supabase) return; const previous = list.tasks; onChange({ ...list, tasks: previous.filter((t) => t.id !== task.id) })
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { tell('That task couldn’t be deleted.'); onChange({ ...list, tasks: previous }) }
  }
  async function removeList() {
    if (!window.confirm(`Delete “${list.title}”?\n\nAll tasks inside it will also be deleted.`) || !supabase) return
    const { error } = await supabase.from('lists').delete().eq('id', list.id)
    if (error) return tell('This list couldn’t be deleted. Try again.')
    window.dispatchEvent(new CustomEvent('simpletodo:list-deleted', { detail: list.id }))
  }
  return <article ref={sortable.setNodeRef} style={style} className={`list-card${isDropTarget ? ' list-card-drop-target' : ''}`} {...sortable.attributes}>
    <div className="list-topline"><button className="drag-handle" aria-label={`Drag ${list.title} list`} {...sortable.listeners}><GripVertical size={16} /></button>{editing ? <form className="rename-form" onSubmit={(e) => void saveTitle(e)}><input autoFocus maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="List title" /><button className="icon-button" aria-label="Save list name"><Check size={16} /></button></form> : <><button className="list-title" onClick={() => { setTitle(list.title); setEditing(true) }}>{list.title}</button><button className="icon-button list-menu" aria-label={`Rename ${list.title}`} onClick={() => { setTitle(list.title); setEditing(true) }}><Settings2 size={16} /></button></>}</div>
    <div className="task-count">{list.tasks.length === 0 ? 'A fresh page' : `${list.tasks.length} ${list.tasks.length === 1 ? 'thing' : 'things'}`}</div>
    <SortableContext items={list.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}><div className="task-list">{list.tasks.map((task) => <SortableTask key={task.id} task={task} toggle={() => void updateTask(task, { completed: !task.completed })} remove={() => void removeTask(task)} dropMarker={task.id === dropTargetTaskId ? (dropAfter ? 'after' : 'before') : null} />)}</div></SortableContext>
    {isDropTarget && !dropTargetTaskId && <div className="drop-hint"><Plus size={14} /> Drop to move here</div>}
    {addingTask ? <form className="add-task-form" onSubmit={(e) => void addTask(e)}><input autoFocus maxLength={240} placeholder="What needs doing?" value={taskText} onChange={(e) => setTaskText(e.target.value)} aria-label="Task text" /><div><button className="primary small">Add task</button><button type="button" className="quiet-button" onClick={() => setAddingTask(false)}>Cancel</button></div></form> : <button className="add-task" onClick={() => setAddingTask(true)}><Plus size={16} /> Add a task</button>}
    <div className="list-footer"><span>TAKE IT ONE THING AT A TIME</span><button className="icon-button delete-list" aria-label={`Delete ${list.title}`} onClick={() => void removeList()}><Trash2 size={14} /></button></div>
  </article>
}

function SortableTask({ task, toggle, remove, dropMarker }: { task: Task; toggle: () => void; remove: () => void; dropMarker: 'before' | 'after' | null }) {
  const sortable = useSortable({ id: task.id, data: { kind: 'task' } }); const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.4 : 1 }
  return <div ref={sortable.setNodeRef} style={style} className={`task-row${dropMarker ? ` task-drop-${dropMarker}` : ''}`} {...sortable.attributes}><button className="task-drag-handle" aria-label={`Drag ${task.text}`} {...sortable.listeners}><GripVertical size={14} /></button><button className={`check-button ${task.completed ? 'checked' : ''}`} onClick={toggle} aria-label={task.completed ? `Mark ${task.text} incomplete` : `Mark ${task.text} complete`}>{task.completed && <Check size={13} strokeWidth={3} />}</button><span className={task.completed ? 'task-text completed' : 'task-text'}>{task.text}</span><button className="task-delete" onClick={remove} aria-label={`Delete ${task.text}`}><Trash2 size={14} /></button></div>
}

function Profile({ user, tell }: { user: User; tell: (s: string) => void }) {
  const [name, setName] = useState(String(user.user_metadata.name ?? '')); const [email, setEmail] = useState(user.email ?? ''); const [busy, setBusy] = useState(false); const navigate = useNavigate()
  async function updateName(e: FormEvent) { e.preventDefault(); if (!supabase) return; const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } }); if (error) tell('Your name couldn’t be changed. Try again.'); else tell('Your name has been updated.') }
  async function updateEmail(e: FormEvent) { e.preventDefault(); if (!supabase || !email.trim()) return; setBusy(true); const { error } = await supabase.auth.updateUser({ email: email.trim() }); setBusy(false); if (error) tell('Your email couldn’t be changed. Try again.'); else tell('Check your inbox to confirm the email change.') }
  async function updatePassword(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!supabase) return; const form = new FormData(e.currentTarget); const password = String(form.get('password')); if (password.length < 8) return tell('Use at least 8 characters for your new password.'); setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setBusy(false); if (error) tell('Your password couldn’t be changed. Try again.'); else { e.currentTarget.reset(); tell('Your password has been changed.') } }
  async function logout() { if (supabase) { await supabase.auth.signOut(); navigate('/login') } }
  return <div className="app-shell"><Header user={user} /><main className="profile-main"><Link to="/" className="back-link"><ChevronLeft size={16} /> Back to your lists</Link><div className="eyebrow">YOUR ACCOUNT</div><h1>A few details<span className="heading-period">.</span></h1><p className="profile-lede">Keep your account up to date.</p>
    <section className="settings-card"><form onSubmit={(e) => void updateName(e)}><div className="settings-heading"><div><h2>Your name</h2><p>What you’d like us to call you.</p></div><CircleUserRound size={20} /></div><div className="settings-control"><input aria-label="Your name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /><button className="outline-button">Save</button></div></form></section>
    <section className="settings-card"><form onSubmit={(e) => void updateEmail(e)}><div className="settings-heading"><div><h2>Email address</h2><p>We’ll send a confirmation link to your new address.</p></div><span className="eyebrow">SIGN IN</span></div><div className="settings-control"><input aria-label="Email address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><button className="outline-button" disabled={busy}>Update</button></div></form></section>
    <section className="settings-card"><form onSubmit={(e) => void updatePassword(e)}><div className="settings-heading"><div><h2>Password</h2><p>Choose at least 8 characters.</p></div><span className="eyebrow">SECURITY</span></div><div className="settings-control"><input aria-label="New password" type="password" name="password" minLength={8} required placeholder="Enter a new password" /><button className="outline-button" disabled={busy}>Change</button></div></form></section>
    <button className="logout-button" onClick={() => void logout()}><LogOut size={16} /> Sign out</button><p className="account-note">Signed in as {user.email}</p>
  </main></div>
}

export default App
