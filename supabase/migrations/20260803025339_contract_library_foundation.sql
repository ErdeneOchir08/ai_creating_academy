create table public.contract_variables (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label_mn text not null check (char_length(trim(label_mn)) between 1 and 120),
  description_mn text not null default '' check (char_length(description_mn) <= 500),
  category text not null check (category in ('contract', 'participant', 'program', 'payment', 'academy')),
  is_active boolean not null default true
);

insert into public.contract_variables (key, label_mn, description_mn, category) values
  ('contract_number', 'Гэрээний дугаар', 'Үүссэн гэрээний давтагдашгүй дугаар.', 'contract'),
  ('contract_date', 'Гэрээний огноо', 'Гэрээ үүсгэсэн эсвэл хүчин төгөлдөр болох огноо.', 'contract'),
  ('student_name', 'Суралцагчийн нэр', 'Сургалтад хамрагдах хүний бүтэн нэр.', 'participant'),
  ('student_registration_number', 'Суралцагчийн регистр', 'Суралцагчийн регистрийн дугаар.', 'participant'),
  ('guardian_name', 'Асран хамгаалагчийн нэр', 'Насанд хүрээгүй суралцагчийн хууль ёсны төлөөлөгчийн бүтэн нэр.', 'participant'),
  ('guardian_registration_number', 'Асран хамгаалагчийн регистр', 'Хууль ёсны төлөөлөгчийн регистрийн дугаар.', 'participant'),
  ('guardian_relationship', 'Асран хамгаалагчийн холбоо', 'Суралцагчтай ямар холбоотойг илэрхийлнэ.', 'participant'),
  ('program_name', 'Хөтөлбөрийн нэр', 'TeenCoder зэрэг сургалтын үндсэн хөтөлбөрийн нэр.', 'program'),
  ('cohort_name', 'Ээлж, ангийн нэр', 'Тухайн элсэлтийн ээлж эсвэл ангийн нэр.', 'program'),
  ('learning_format', 'Сургалтын хэлбэр', 'Танхим, цахим эсвэл хосолсон хэлбэр.', 'program'),
  ('schedule', 'Хичээлийн хуваарь', 'Долоо хоногийн өдөр, цагийн мэдээлэл.', 'program'),
  ('start_date', 'Эхлэх огноо', 'Сургалт эхлэх огноо.', 'program'),
  ('end_date', 'Дуусах огноо', 'Сургалт дуусах огноо.', 'program'),
  ('location', 'Сургалтын байршил', 'Танхимын хаяг эсвэл цахим сургалтын тайлбар.', 'program'),
  ('tuition_amount', 'Сургалтын төлбөр', 'Тухайн суралцагчийн баталгаажсан нийт төлбөр.', 'payment'),
  ('payment_plan', 'Төлбөрийн нөхцөл', 'Бүтэн, урьдчилгаа эсвэл хуваан төлөх нөхцөл.', 'payment'),
  ('academy_name', 'Академийн нэр', 'Гэрээ байгуулагч академийн албан ёсны нэр.', 'academy'),
  ('academy_representative', 'Академийн төлөөлөгч', 'Академийг төлөөлөн гэрээ байгуулах эрх бүхий хүн.', 'academy'),
  ('academy_phone', 'Академийн утас', 'Академийн холбоо барих утас.', 'academy'),
  ('academy_address', 'Академийн хаяг', 'Академийн албан ёсны хаяг.', 'academy'),
  ('bank_name', 'Банкны нэр', 'Төлбөр хүлээн авах банк.', 'payment'),
  ('bank_account_number', 'Дансны дугаар', 'Төлбөр хүлээн авах дансны дугаар.', 'payment'),
  ('bank_account_holder', 'Данс эзэмшигч', 'Банкны данс эзэмшигчийн нэр.', 'payment');

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1_000),
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contract_templates_name_unique
on public.contract_templates (lower(trim(name)));

create table public.contract_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.contract_templates(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  title text not null check (char_length(trim(title)) between 1 and 240),
  content text not null default '' check (char_length(content) <= 100_000),
  change_summary text not null default '' check (char_length(change_summary) <= 1_000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  retired_by uuid references public.profiles(id) on delete restrict,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version_number),
  check (
    (status = 'draft' and published_by is null and published_at is null and retired_by is null and retired_at is null)
    or
    (status = 'published' and published_by is not null and published_at is not null and retired_by is null and retired_at is null)
    or
    (status = 'retired' and published_by is not null and published_at is not null and retired_by is not null and retired_at is not null)
  )
);

create unique index contract_template_versions_one_draft
on public.contract_template_versions (template_id)
where status = 'draft';

create unique index contract_template_versions_one_published
on public.contract_template_versions (template_id)
where status = 'published';

create index contract_template_versions_template_status_idx
on public.contract_template_versions (template_id, status, version_number desc);

create or replace function private.set_contract_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.enforce_contract_template_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Contract template identity and authorship are immutable.';
  end if;

  if tg_op = 'DELETE' and exists (
    select 1
    from public.contract_template_versions
    where template_id = old.id
      and status in ('published', 'retired')
  ) then
    raise exception 'A contract template with published history cannot be deleted.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function private.enforce_contract_version_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  unknown_variables text[];
  content_without_valid_variables text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New contract versions must begin as drafts.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published or retired contract versions cannot be deleted.';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.template_id is distinct from old.template_id
     or new.version_number is distinct from old.version_number
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Contract version identity and authorship are immutable.';
  end if;

  if old.status = 'retired' then
    raise exception 'Retired contract versions are immutable.';
  end if;

  if old.status = 'published' then
    if new.status <> 'retired' then
      raise exception 'Published contract versions are immutable and may only be retired.';
    end if;

    if new.title is distinct from old.title
       or new.content is distinct from old.content
       or new.change_summary is distinct from old.change_summary
       or new.published_by is distinct from old.published_by
       or new.published_at is distinct from old.published_at then
      raise exception 'Published contract content and publication metadata are immutable.';
    end if;

    new.retired_by := (select auth.uid());
    new.retired_at := now();
    return new;
  end if;

  if new.status = 'retired' then
    raise exception 'A draft must be published before it can be retired.';
  end if;

  if new.status = 'published' then
    if exists (
      select 1 from public.contract_templates
      where id = new.template_id and is_archived
    ) then
      raise exception 'An archived contract template cannot be published.';
    end if;

    if char_length(trim(new.content)) < 100 then
      raise exception 'Contract content must contain at least 100 characters before publication.';
    end if;

    content_without_valid_variables := regexp_replace(new.content, '\{\{[a-z][a-z0-9_]*\}\}', '', 'g');
    if strpos(content_without_valid_variables, '{{') > 0 or strpos(content_without_valid_variables, '}}') > 0 then
      raise exception 'Contract content contains a malformed variable.';
    end if;

    select array_agg(distinct matches.variable_key)
    into unknown_variables
    from (
      select match[1] as variable_key
      from regexp_matches(new.content, '\{\{([a-z][a-z0-9_]*)\}\}', 'g') as match
    ) as matches
    left join public.contract_variables variables
      on variables.key = matches.variable_key
     and variables.is_active
    where variables.key is null;

    if unknown_variables is not null then
      raise exception 'Unknown or inactive contract variables: %', array_to_string(unknown_variables, ', ');
    end if;

    new.published_by := (select auth.uid());
    new.published_at := now();
    new.retired_by := null;
    new.retired_at := null;
    return new;
  end if;

  new.published_by := null;
  new.published_at := null;
  new.retired_by := null;
  new.retired_at := null;
  return new;
end;
$$;

create trigger a_contract_templates_lifecycle
before update or delete on public.contract_templates
for each row execute function private.enforce_contract_template_lifecycle();

create trigger z_contract_templates_updated_at
before update on public.contract_templates
for each row execute function private.set_contract_updated_at();

create trigger a_contract_template_versions_lifecycle
before insert or update or delete on public.contract_template_versions
for each row execute function private.enforce_contract_version_lifecycle();

create trigger z_contract_template_versions_updated_at
before update on public.contract_template_versions
for each row execute function private.set_contract_updated_at();

alter table public.contract_variables enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contract_template_versions enable row level security;

revoke all on table public.contract_variables from anon, authenticated;
revoke all on table public.contract_templates from anon, authenticated;
revoke all on table public.contract_template_versions from anon, authenticated;

grant select on table public.contract_variables to authenticated;
grant select, insert, update, delete on table public.contract_templates to authenticated;
grant select, insert, update, delete on table public.contract_template_versions to authenticated;

grant all on table public.contract_variables to service_role;
grant all on table public.contract_templates to service_role;
grant all on table public.contract_template_versions to service_role;

create policy "contract variables: admins read"
on public.contract_variables
for select
to authenticated
using ((select private.is_admin()));

create policy "contract templates: admins read"
on public.contract_templates
for select
to authenticated
using ((select private.is_admin()));

create policy "contract templates: admins create"
on public.contract_templates
for insert
to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));

create policy "contract templates: admins update"
on public.contract_templates
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "contract templates: admins delete drafts"
on public.contract_templates
for delete
to authenticated
using ((select private.is_admin()));

create policy "contract versions: admins read"
on public.contract_template_versions
for select
to authenticated
using ((select private.is_admin()));

create policy "contract versions: admins create"
on public.contract_template_versions
for insert
to authenticated
with check (
  (select private.is_admin())
  and created_by = (select auth.uid())
  and status = 'draft'
);

create policy "contract versions: admins update"
on public.contract_template_versions
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "contract versions: admins delete drafts"
on public.contract_template_versions
for delete
to authenticated
using ((select private.is_admin()));

create or replace function public.create_contract_template(
  p_name text,
  p_description text,
  p_title text,
  p_content text,
  p_change_summary text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_template_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  insert into public.contract_templates (name, description, created_by)
  values (trim(p_name), trim(coalesce(p_description, '')), current_user_id)
  returning id into new_template_id;

  insert into public.contract_template_versions (
    template_id,
    version_number,
    title,
    content,
    change_summary,
    created_by
  ) values (
    new_template_id,
    1,
    trim(p_title),
    coalesce(p_content, ''),
    trim(coalesce(p_change_summary, '')),
    current_user_id
  );

  return new_template_id;
end;
$$;

create or replace function public.create_contract_template_draft(p_template_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_version public.contract_template_versions%rowtype;
  new_version_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  perform 1 from public.contract_templates where id = p_template_id for update;
  if not found then
    raise exception 'Contract template was not found.';
  end if;

  if exists (
    select 1 from public.contract_template_versions
    where template_id = p_template_id and status = 'draft'
  ) then
    raise exception 'This contract template already has a draft.';
  end if;

  select * into source_version
  from public.contract_template_versions
  where template_id = p_template_id
  order by version_number desc
  limit 1;

  if not found then
    raise exception 'This contract template has no source version.';
  end if;

  insert into public.contract_template_versions (
    template_id,
    version_number,
    title,
    content,
    change_summary,
    created_by
  ) values (
    p_template_id,
    source_version.version_number + 1,
    source_version.title,
    source_version.content,
    '',
    current_user_id
  ) returning id into new_version_id;

  return new_version_id;
end;
$$;

create or replace function public.publish_contract_template_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_template_id uuid;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  select template_id into target_template_id
  from public.contract_template_versions
  where id = p_version_id and status = 'draft';

  if target_template_id is null then
    raise exception 'The draft contract version was not found.';
  end if;

  perform 1 from public.contract_templates where id = target_template_id for update;

  update public.contract_template_versions
  set status = 'retired'
  where template_id = target_template_id and status = 'published';

  update public.contract_template_versions
  set status = 'published'
  where id = p_version_id and status = 'draft';

  if not found then
    raise exception 'The draft contract version could not be published.';
  end if;
end;
$$;

create or replace function public.retire_contract_template_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  update public.contract_template_versions
  set status = 'retired'
  where id = p_version_id and status = 'published';

  if not found then
    raise exception 'The published contract version was not found.';
  end if;
end;
$$;

revoke all on function public.create_contract_template(text, text, text, text, text) from public, anon;
revoke all on function public.create_contract_template_draft(uuid) from public, anon;
revoke all on function public.publish_contract_template_version(uuid) from public, anon;
revoke all on function public.retire_contract_template_version(uuid) from public, anon;

grant execute on function public.create_contract_template(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.create_contract_template_draft(uuid) to authenticated, service_role;
grant execute on function public.publish_contract_template_version(uuid) to authenticated, service_role;
grant execute on function public.retire_contract_template_version(uuid) to authenticated, service_role;

revoke all on function private.set_contract_updated_at() from public, anon, authenticated;
revoke all on function private.enforce_contract_template_lifecycle() from public, anon, authenticated;
revoke all on function private.enforce_contract_version_lifecycle() from public, anon, authenticated;
