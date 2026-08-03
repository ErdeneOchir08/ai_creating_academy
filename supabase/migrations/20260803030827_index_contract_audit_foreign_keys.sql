create index contract_templates_created_by_idx
on public.contract_templates (created_by);

create index contract_template_versions_created_by_idx
on public.contract_template_versions (created_by);

create index contract_template_versions_published_by_idx
on public.contract_template_versions (published_by);

create index contract_template_versions_retired_by_idx
on public.contract_template_versions (retired_by);
