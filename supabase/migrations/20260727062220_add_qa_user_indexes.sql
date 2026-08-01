create index if not exists questions_user_created_at_idx
  on public.questions (user_id, created_at desc);

create index if not exists answers_user_id_idx
  on public.answers (user_id);
