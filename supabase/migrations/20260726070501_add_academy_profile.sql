create table public.academy_profile (
  id boolean primary key default true check (id),
  display_name text not null default 'Mind Academy' check (char_length(trim(display_name)) between 1 and 120),
  short_description text not null default '' check (char_length(short_description) <= 600),
  public_email text not null default '' check (char_length(public_email) <= 320),
  phone text not null default '' check (char_length(phone) <= 50),
  address text not null default '' check (char_length(address) <= 500),
  business_hours text not null default '' check (char_length(business_hours) <= 200),
  facebook_url text not null default 'https://www.facebook.com/mmindcodeacademy' check (char_length(facebook_url) <= 2_000),
  instagram_url text not null default 'https://www.instagram.com/mindcode_academy/' check (char_length(instagram_url) <= 2_000),
  website_url text not null default '' check (char_length(website_url) <= 2_000),
  updated_at timestamptz not null default now()
);

insert into public.academy_profile (id, display_name, facebook_url, instagram_url)
values (
  true,
  'Mind Academy',
  'https://www.facebook.com/mmindcodeacademy',
  'https://www.instagram.com/mindcode_academy/'
);

alter table public.academy_profile enable row level security;

revoke all on table public.academy_profile from anon, authenticated;
grant select on table public.academy_profile to anon, authenticated;
grant update on table public.academy_profile to authenticated;

create policy "academy profile is publicly readable"
on public.academy_profile
for select
to anon, authenticated
using (true);

create policy "admins update academy profile"
on public.academy_profile
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
