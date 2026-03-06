-- Create the simple key-value settings table
create table app_settings (
  id text primary key,
  value text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table app_settings enable row level security;

-- Only admins (users in the admin_roles table) can view and edit settings
create policy "Admins can view settings"
  on app_settings for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert settings"
  on app_settings for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update settings"
  on app_settings for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Initialize default entries
insert into app_settings (id, value) values ('telegram_bot_token', '');
insert into app_settings (id, value) values ('telegram_chat_id', '');

-- Create a secure function to fetch these settings bypassing RLS
-- This allows the server action to get the tokens when a student pays
create or replace function get_app_settings_secure()
returns table (id text, value text)
language sql
security definer
set search_path = public
as $$
  select id, value from app_settings;
$$;
