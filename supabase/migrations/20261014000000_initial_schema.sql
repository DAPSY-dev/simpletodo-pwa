create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_user_position_idx on public.lists(user_id, position);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 240),
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_list_position_idx on public.tasks(list_id, position);

create function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_for_user();

alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.tasks enable row level security;

create policy "Users can read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Users can read own lists" on public.lists for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can insert own lists" on public.lists for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users can update own lists" on public.lists for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can delete own lists" on public.lists for delete to authenticated using (user_id = (select auth.uid()));

create policy "Users can read tasks in own lists" on public.tasks for select to authenticated
using (exists (select 1 from public.lists where lists.id = tasks.list_id and lists.user_id = (select auth.uid())));
create policy "Users can insert tasks in own lists" on public.tasks for insert to authenticated
with check (exists (select 1 from public.lists where lists.id = tasks.list_id and lists.user_id = (select auth.uid())));
create policy "Users can update tasks in own lists" on public.tasks for update to authenticated
using (exists (select 1 from public.lists where lists.id = tasks.list_id and lists.user_id = (select auth.uid())))
with check (exists (select 1 from public.lists where lists.id = tasks.list_id and lists.user_id = (select auth.uid())));
create policy "Users can delete tasks in own lists" on public.tasks for delete to authenticated
using (exists (select 1 from public.lists where lists.id = tasks.list_id and lists.user_id = (select auth.uid())));
