alter table public.project_files
  add column if not exists content_sha256 text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_files'
      and column_name = 'checksum'
  ) then
    execute '
      update public.project_files
      set content_sha256 = checksum
      where content_sha256 is null
        and checksum is not null
    ';
  end if;
end;
$$;

notify pgrst, 'reload schema';
