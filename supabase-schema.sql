-- Edustream: схема + RLS для Supabase SQL Editor
-- Выполните целиком в Supabase -> SQL Editor

create extension if not exists "pgcrypto";

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student', 'teacher')),
  group_number text,
  created_at timestamptz not null default now()
);

-- grades (id может быть timestamptz, если таблица уже создана ранее)
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  score integer not null check (score between 1 and 5),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  reason text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(),
  group_number text not null,
  day_of_week text not null,
  time text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_group_number on public.profiles (group_number);
create index if not exists idx_grades_student_id on public.grades (student_id);
create index if not exists idx_grades_subject on public.grades (subject);
create index if not exists idx_attendance_student_id on public.attendance (student_id);
create index if not exists idx_schedule_group_number on public.schedule (group_number);

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, group_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'group_number'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.grades enable row level security;
alter table public.attendance enable row level security;
alter table public.schedule enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_select_group_students" on public.profiles;
create policy "profiles_select_group_students"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as teacher
      where teacher.id = auth.uid()
        and teacher.role = 'teacher'
        and teacher.group_number = profiles.group_number
        and profiles.role = 'student'
    )
  );

-- grades
drop policy if exists "grades_select_own" on public.grades;
create policy "grades_select_own"
  on public.grades for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "grades_insert_teacher" on public.grades;
create policy "grades_insert_teacher"
  on public.grades for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles as teacher
      join public.profiles as student on student.id = grades.student_id
      where teacher.id = auth.uid()
        and teacher.role = 'teacher'
        and teacher.group_number = student.group_number
    )
  );

-- attendance
drop policy if exists "attendance_select_own" on public.attendance;
create policy "attendance_select_own"
  on public.attendance for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "attendance_insert_teacher" on public.attendance;
create policy "attendance_insert_teacher"
  on public.attendance for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles as teacher
      join public.profiles as student on student.id = attendance.student_id
      where teacher.id = auth.uid()
        and teacher.role = 'teacher'
        and teacher.group_number = student.group_number
    )
  );

-- schedule
drop policy if exists "schedule_select_group" on public.schedule;
create policy "schedule_select_group"
  on public.schedule for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.group_number = schedule.group_number
    )
  );

-- Пример: добавить профиль для существующего пользователя
-- insert into public.profiles (id, full_name, role, group_number)
-- values ('<uuid из Authentication>', 'Иван Иванов', 'student', '14-02-24');

-- Пример: тестовое расписание
-- insert into public.schedule (group_number, day_of_week, time, subject) values
-- ('14-02-24', 'Понедельник', '09:00', 'Информатика'),
-- ('14-02-24', 'Вторник', '10:30', 'Алгебра');
