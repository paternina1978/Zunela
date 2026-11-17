-- Chat privado: insert solo si hay conexión accepted entre las partes.

create or replace function public.private_message_pair_accepted(sender uuid, recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and (
        (c.from_user = sender and c.to_user = recipient)
        or (c.from_user = recipient and c.to_user = sender)
      )
  );
$$;

revoke all on function public.private_message_pair_accepted(uuid, uuid) from public;
grant execute on function public.private_message_pair_accepted(uuid, uuid) to authenticated;

drop policy if exists private_messages_insert_own on public.private_messages;
create policy private_messages_insert_own
  on public.private_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.private_message_pair_accepted(sender_id, recipient_id)
  );
