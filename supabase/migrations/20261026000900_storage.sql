-- Private "media" bucket for venue photos, videos and brochures. Object paths
-- start with the org id ("<org_id>/halls/main.jpg") so policies can scope them.
-- Guarded so the migration also runs on plain Postgres in CI.

do $outer$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not found; skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('media', 'media', false, 16 * 1024 * 1024)  -- 16 MB: WhatsApp's video limit
  on conflict (id) do nothing;

  execute $p$
    create policy media_read on storage.objects for select to authenticated
      using (bucket_id = 'media' and (storage.foldername(name))[1] = (select app.current_org_id())::text)
  $p$;
  execute $p$
    create policy media_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'media'
        and (storage.foldername(name))[1] = (select app.current_org_id())::text
        and (select app.has_role('owner','manager','ops'))
      )
  $p$;
  execute $p$
    create policy media_update on storage.objects for update to authenticated
      using (
        bucket_id = 'media'
        and (storage.foldername(name))[1] = (select app.current_org_id())::text
        and (select app.has_role('owner','manager','ops'))
      )
  $p$;
  execute $p$
    create policy media_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'media'
        and (storage.foldername(name))[1] = (select app.current_org_id())::text
        and (select app.has_role('owner','manager','ops'))
      )
  $p$;
end
$outer$;
