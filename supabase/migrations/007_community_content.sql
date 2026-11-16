-- Slice chat y publicaciones de comunidad.
-- Solo miembros escriben; lecturas de posts públicas abiertas en comunidades publicadas.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists community_posts_community_created_idx
  on public.community_posts (community_id, created_at desc);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_community_created_idx
  on public.community_messages (community_id, created_at);

create index if not exists community_messages_author_created_idx
  on public.community_messages (author_id, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_messages enable row level security;

-- Posts: miembros siempre; públicos publicados visibles a autenticados.
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select
  on public.community_posts for select
  to authenticated
  using (
    public.is_community_member(community_id)
    or exists (
      select 1 from public.communities c
      where c.id = community_id
        and c.status = 'publicada'
        and c.access = 'publica'
    )
  );

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert
  on public.community_posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and public.is_community_member(community_id)
  );

-- Chat: solo miembros.
drop policy if exists community_messages_select on public.community_messages;
create policy community_messages_select
  on public.community_messages for select
  to authenticated
  using (public.is_community_member(community_id));

drop policy if exists community_messages_insert on public.community_messages;
create policy community_messages_insert
  on public.community_messages for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and public.is_community_member(community_id)
  );
