-- Exercises the roles and readers against disposable rows, then rolls them back.
begin;

do $$
declare
  actor uuid;
  previous_sub text := current_setting('request.jwt.claim.sub', true);
  post_id uuid := gen_random_uuid();
  image_id uuid := gen_random_uuid();
  draft_image_id uuid := gen_random_uuid();
  test_slug text := 'blog-test-' || post_id::text;
  original jsonb;
  private_edit jsonb;
  publication_time timestamptz;
  changed_rows integer;
begin
  select r.user_id into actor from public.user_roles as r
  join auth.users as u on u.id = r.user_id
  where r.role = 'admin' limit 1;
  if actor is null then raise exception 'Blog verification requires an administrator fixture'; end if;

  original := jsonb_build_object('title', 'Original article', 'slug', test_slug, 'blocks',
    jsonb_build_array(jsonb_build_object('type', 'paragraph', 'children',
      jsonb_build_array(jsonb_build_object('type', 'image', 'props', jsonb_build_object('assetId', image_id))))));
  private_edit := jsonb_set(original, '{title}', '"Private changes"');

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.blog_posts (id, draft, created_by) values (post_id, original, actor);
    raise exception 'A non-admin was able to create a draft';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.blog_posts (id, draft, created_by) values (post_id, original, actor);
  perform set_config('role', 'service_role', true);
  insert into public.blog_assets (id, post_id, kind, name, path, size_bytes, validated) values
    (image_id, post_id, 'image', 'published.webp', post_id || '/' || image_id || '.webp', 100, true),
    (draft_image_id, post_id, 'image', 'draft.webp', post_id || '/' || draft_image_id || '.webp', 100, true);
  if exists (select from public.get_published_blog_asset(image_id)) then
    raise exception 'A draft image was publicly reachable';
  end if;

  perform set_config('role', 'anon', true);
  if exists (select from public.get_published_blog_post(test_slug)) then
    raise exception 'An unpublished draft was publicly readable';
  end if;
  begin
    perform draft from public.blog_posts;
    raise exception 'Anon can read the private posts table';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'authenticated', true);
  update public.blog_posts set slug = test_slug, published = original, published_at = now(), revision = 2,
    published_asset_ids = array[image_id, draft_image_id] where id = post_id and revision = 1;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then raise exception 'Publishing did not update exactly one revision'; end if;
  select published_updated_at into publication_time from public.blog_posts where id = post_id;

  update public.blog_posts set draft = private_edit, revision = 3 where id = post_id and revision = 2;
  update public.blog_posts set draft = original where id = post_id and revision = 2;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then raise exception 'A stale revision overwrote a draft'; end if;

  perform set_config('role', 'anon', true);
  if (select published from public.get_published_blog_post(test_slug)) is distinct from original then
    raise exception 'The public reader did not preserve the published version';
  end if;
  if not exists (select from public.list_published_blog_posts(100, 0) as entry
      where entry.id = post_id and entry.published = original - 'blocks') then
    raise exception 'The public listing did not return the article summary';
  end if;
  if not exists (select from public.list_published_blog_sitemap(1000, 0) as entry
      where entry.slug = test_slug and entry.updated_at = publication_time) then
    raise exception 'The sitemap did not preserve the published modification time';
  end if;

  perform set_config('role', 'service_role', true);
  if not exists (select from public.get_published_blog_asset(image_id))
      or exists (select from public.get_published_blog_asset(draft_image_id)) then
    raise exception 'Public asset authorization did not enforce the current published references';
  end if;

  perform set_config('role', 'authenticated', true);
  update public.blog_posts set published = null, published_at = null, published_asset_ids = '{}', revision = 4
    where id = post_id and revision = 3;
  begin
    update public.blog_posts set slug = test_slug || '-changed' where id = post_id;
    raise exception 'A previously shared slug was changed after unpublishing';
  exception when check_violation then null;
  end;

  perform set_config('role', 'anon', true);
  if exists (select from public.get_published_blog_post(test_slug)) then
    raise exception 'The article remained public after unpublishing';
  end if;
  perform set_config('role', 'service_role', true);
  if exists (select from public.get_published_blog_asset(image_id)) then
    raise exception 'An unpublished asset still issues a public URL';
  end if;

  perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
end;
$$;

rollback;
