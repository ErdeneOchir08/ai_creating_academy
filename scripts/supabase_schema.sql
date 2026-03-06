-- AI Creator Academy Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles (Extends Supabase Auth Users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  avatar_url text,
  role text default 'student' check (role in ('student', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security for profiles
alter table public.profiles enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 2. Courses Table
create table public.courses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  thumbnail_url text,
  price_display text default '$19.99',
  published boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.courses enable row level security;
create policy "Courses are viewable by everyone." on courses for select using (true);
create policy "Only admins can modify courses" on courses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 3. Lessons Table
create table public.lessons (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  video_url text,
  order_index integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lessons enable row level security;
-- Only enrolled students or admins can view lessons (Simplified for now - public view but UI will hide)
create policy "Lessons are viewable by everyone." on lessons for select using (true);
create policy "Only admins can modify lessons" on lessons for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 4. Enrollments Table (Grants Access)
create table public.enrollments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, course_id)
);

alter table public.enrollments enable row level security;
create policy "Users can view their own enrollments" on enrollments for select using (auth.uid() = user_id);
create policy "Admins can view all enrollments" on enrollments for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can create enrollments" on enrollments for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 5. Payment Requests Table
create table public.payment_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  proof_image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payment_requests enable row level security;
create policy "Users can view their own payment requests" on payment_requests for select using (auth.uid() = user_id);
create policy "Users can insert their own payment requests" on payment_requests for insert with check (auth.uid() = user_id);
create policy "Admins can view all payment requests" on payment_requests for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update payment requests" on payment_requests for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 6. User Progress Table
create table public.user_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  completed boolean default false,
  completed_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, lesson_id)
);

alter table public.user_progress enable row level security;
create policy "Users can view and update their own progress" on user_progress for select using (auth.uid() = user_id);
create policy "Users can insert their own progress" on user_progress for insert with check (auth.uid() = user_id);
create policy "Users can update their own progress" on user_progress for update using (auth.uid() = user_id);

-- 7. Supabase Storage Bucket for Receipts
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true);

create policy "Anyone can view receipts"
  on storage.objects for select
  using ( bucket_id = 'receipts' );

create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  with check ( bucket_id = 'receipts' and auth.role() = 'authenticated' );

-- Create trigger to automatically create profile on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
