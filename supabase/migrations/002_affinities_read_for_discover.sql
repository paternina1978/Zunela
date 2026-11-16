-- Slice descubrimiento: usuarios autenticados pueden leer afinidades ajenas
-- (señales de descubrimiento). La escritura sigue siendo solo del dueño.

drop policy if exists affinities_select_own on public.affinities;

create policy affinities_select_authenticated
  on public.affinities for select
  to authenticated
  using (true);
