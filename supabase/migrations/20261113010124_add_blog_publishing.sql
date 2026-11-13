create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  draft jsonb not null,
  published jsonb,
  published_asset_ids uuid[] not null default '{}',
  published_at timestamptz,
  published_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  revision integer not null default 1,
  constraint blog_posts_draft_object check (jsonb_typeof(draft) = 'object'),
  constraint blog_posts_revision_positive check (revision > 0),
  constraint blog_posts_valid_slug check (
    slug is null or (
      char_length(slug) between 1 and 120
      and slug not in ('.', '..', 'media')
      and slug !~ '[[:space:][:cntrl:]/?#%]'
      and position(chr(92) in slug) = 0
    )
  ),
  constraint blog_posts_consistent_publication check (
    (
      published is null and published_at is null and published_updated_at is null
      and cardinality(published_asset_ids) = 0
    ) or (
      published is not null and published_at is not null and published_updated_at is not null
      and slug is not null and jsonb_typeof(published) = 'object'
      and (published ->> 'slug') is not distinct from slug
    )
  )
);

create index blog_posts_created_by_idx on public.blog_posts (created_by);
create index blog_posts_updated_at_idx on public.blog_posts (updated_at desc, id desc);
create index blog_posts_published_order_idx on public.blog_posts (published_at desc, id)
  where published is not null;

alter table public.blog_posts enable row level security;
revoke all on public.blog_posts from public, anon, authenticated;
grant select, insert, update on public.blog_posts to authenticated;
grant select, insert, update, delete on public.blog_posts to service_role;

create policy blog_posts_admin_select on public.blog_posts
  for select to authenticated using ((select private.is_admin()));

create policy blog_posts_admin_insert on public.blog_posts
  for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

create policy blog_posts_admin_update on public.blog_posts
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create function private.set_blog_publication_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := statement_timestamp();
    if old.slug is not null and new.slug is distinct from old.slug then
      raise exception 'The link for a published blog post cannot be changed' using errcode = '23514';
    end if;
  end if;

  if new.published is null then
    new.published_updated_at := null;
  elsif tg_op = 'INSERT' then
    new.published_updated_at := statement_timestamp();
  elsif new.published is distinct from old.published or new.published_at is distinct from old.published_at then
    new.published_updated_at := statement_timestamp();
  else
    new.published_updated_at := old.published_updated_at;
  end if;
  return new;
end;
$$;

revoke all on function private.set_blog_publication_metadata() from public, anon, authenticated;

create trigger set_blog_publication_metadata
before insert or update on public.blog_posts
for each row execute function private.set_blog_publication_metadata();

create table public.blog_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  kind text not null check (kind in ('image', 'pdf')),
  name text not null check (char_length(name) between 1 and 180),
  path text not null unique,
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint blog_assets_path_matches_id check (
    path = post_id::text || '/' || id::text || case kind when 'image' then '.webp' else '.pdf' end
  )
);

create index blog_assets_post_id_idx on public.blog_assets (post_id);

alter table public.blog_assets enable row level security;
revoke all on public.blog_assets from public, anon, authenticated;
grant select on public.blog_assets to authenticated;
grant select, insert, update, delete on public.blog_assets to service_role;

create policy blog_assets_admin_select on public.blog_assets
  for select to authenticated using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-media', 'blog-media', false, 20971520, array['image/webp', 'application/pdf']);

-- These readers project only published data. Direct table access stays admin-only.
create function public.list_published_blog_posts(p_limit integer default 100, p_offset integer default 0)
returns table (id uuid, published jsonb, published_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select post.id, post.published - 'blocks', post.published_at, post.published_updated_at
  from public.blog_posts as post
  where post.published is not null
  order by post.published_at desc, post.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create function public.get_published_blog_post(p_slug text)
returns table (id uuid, published jsonb, published_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select post.id, post.published, post.published_at, post.published_updated_at
  from public.blog_posts as post
  where post.slug = p_slug and post.published is not null;
$$;

create function public.list_published_blog_sitemap(p_limit integer default 1000, p_offset integer default 0)
returns table (slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select post.slug, post.published_updated_at
  from public.blog_posts as post
  where post.published is not null
  order by post.published_at desc, post.id
  limit least(greatest(p_limit, 1), 1000)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.list_published_blog_posts(integer, integer) from public, anon, authenticated;
revoke all on function public.get_published_blog_post(text) from public, anon, authenticated;
revoke all on function public.list_published_blog_sitemap(integer, integer) from public, anon, authenticated;

grant execute on function public.list_published_blog_posts(integer, integer) to anon, authenticated, service_role;
grant execute on function public.get_published_blog_post(text) to anon, authenticated, service_role;
grant execute on function public.list_published_blog_sitemap(integer, integer) to anon, authenticated, service_role;

-- The file route signs a Storage URL only after looking up the active publication.
create function public.get_published_blog_asset(p_asset_id uuid)
returns table (kind text, name text, path text)
language sql
stable
set search_path = ''
as $$
  select asset.kind, asset.name, asset.path
  from public.blog_assets as asset
  join public.blog_posts as post on post.id = asset.post_id
  where asset.id = p_asset_id and asset.validated
    and post.published is not null and asset.id = any (post.published_asset_ids)
    and (
      (asset.kind = 'image' and post.published ->> 'coverAssetId' = asset.id::text)
      or exists (
        with recursive blocks(node, depth) as (
          select item.node, 1
          from jsonb_path_query(post.published, 'strict $.blocks[*]', '{}', true) as item(node)
          union all
          select child.node, parent.depth + 1
          from blocks as parent
          cross join lateral jsonb_path_query(parent.node, 'strict $.children[*]', '{}', true) as child(node)
          where parent.depth < 8
        )
        select 1 from blocks
        where node ->> 'type' = asset.kind and node #>> '{props,assetId}' = asset.id::text
      )
    );
$$;

revoke all on function public.get_published_blog_asset(uuid) from public, anon, authenticated;
grant execute on function public.get_published_blog_asset(uuid) to service_role;
