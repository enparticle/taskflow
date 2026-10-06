-- Private recording archive. Apply and test in an isolated database first.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-audio', 'meeting-audio', false, 52428800,
        array['audio/webm', 'audio/mp4'])
on conflict (id) do nothing;

-- Abort rather than silently accepting an incompatible pre-existing bucket.
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'meeting-audio'
    and public = false and file_size_limit = 52428800
    and allowed_mime_types = array['audio/webm', 'audio/mp4']) then
    raise exception 'meeting-audio bucket configuration differs; inspect before applying';
  end if;
end $$;

-- Do not reuse the broad meeting_drafts SELECT policy: recordings are private.
-- The UUID comparison stays text-based so malformed object paths fail closed.
create policy meeting_audio_read on storage.objects
for select to authenticated using (
  bucket_id = 'meeting-audio'
  and exists (
    select 1 from public.users u join public.meeting_drafts m
      on m.id::text = (storage.foldername(storage.objects.name))[1]
    where u.auth_id = (select auth.uid()) and u.is_active = true
      and (m.user_id = u.id or u.role in ('admin', 'leader'))
  )
);

create policy meeting_audio_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'meeting-audio'
  and array_length(storage.foldername(storage.objects.name), 1) = 1
  and exists (
    select 1 from public.users u join public.meeting_drafts m
      on m.id::text = (storage.foldername(storage.objects.name))[1]
    where u.auth_id = (select auth.uid()) and u.is_active = true
      and u.role <> 'viewer'
      and (m.user_id = u.id or u.role in ('admin', 'leader'))
  )
);
create policy meeting_audio_read_guard on storage.objects as restrictive
for select to public using (
  bucket_id <> 'meeting-audio' or
   exists (
    select 1 from public.users u join public.meeting_drafts m
      on m.id::text = (storage.foldername(storage.objects.name))[1]
    where u.auth_id = (select auth.uid()) and u.is_active = true
      and (m.user_id = u.id or u.role in ('admin', 'leader'))
  )
);

create policy meeting_audio_insert_guard on storage.objects as restrictive
for insert to public with check (
  bucket_id <> 'meeting-audio' or
   array_length(storage.foldername(storage.objects.name), 1) = 1
  and exists (
    select 1 from public.users u join public.meeting_drafts m
      on m.id::text = (storage.foldername(storage.objects.name))[1]
    where u.auth_id = (select auth.uid()) and u.is_active = true
      and u.role <> 'viewer'
      and (m.user_id = u.id or u.role in ('admin', 'leader'))
  )
);

create policy meeting_audio_no_update on storage.objects as restrictive
for update to public using (bucket_id <> 'meeting-audio') with check (bucket_id <> 'meeting-audio');
create policy meeting_audio_no_delete on storage.objects as restrictive
for delete to public using (bucket_id <> 'meeting-audio');

-- Do not orphan archived audio when the existing meeting delete button is used.
create function public.protect_meeting_audio_archive() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if exists (select 1 from storage.objects o where o.bucket_id = 'meeting-audio'
    and (storage.foldername(o.name))[1] = old.id::text) then
    raise exception '녹음 원본이 보관된 회의록은 삭제할 수 없습니다. 관리자에게 보관 정책을 확인해 주세요.';
  end if;
  return old;
end;
$$;
revoke all on function public.protect_meeting_audio_archive() from public, anon, authenticated;
create trigger protect_meeting_audio_archive before delete on public.meeting_drafts
for each row execute function public.protect_meeting_audio_archive();
commit;
