-- ============================================================
--  OPÉ IAP — « Coup de boost pour les ATC » (23 → 27 novembre 2026)
--  Projet Supabase « COMMERCE » ; tables préfixées boost_ (indépendantes de PICARD-ATC).
--
--  Accès : pas de compte. Chaque personne a un CODE unique :
--    rôle « atc »       → voit et met à jour uniquement ses IAP
--    rôle « adv »       → tableau de suivi complet + export (lecture seule)
--    rôle « direction » → idem + gestion des codes + import du listing
--  Les tables ne sont lisibles par personne en direct (RLS sans politique pour anon) :
--  tout passe par les fonctions ci-dessous, qui vérifient le code.
-- ============================================================

create table public.boost_acces (
  code text primary key,                 -- ex. K7PM-4Q9X
  nom text not null,                     -- « Rondia », « Direction », « ADV »
  role text not null default 'atc' check (role in ('atc', 'adv', 'direction')),
  email text,
  actif boolean not null default true,
  derniere_connexion timestamptz,
  created_at timestamptz not null default now()
);
create unique index boost_acces_atc_unique on public.boost_acces (nom) where role = 'atc';

create table public.boost_iap (
  id int generated always as identity primary key,
  atc text not null,                     -- nom de l'ATC (colonne « Commercial » du listing)
  numero text,                           -- N° client
  raison text not null,                  -- nom de l'IAP
  statut text,                           -- ELITE, PREMIUM, OFFICIEL
  contact_nom text,
  contact_prenom text,
  mail text,
  portable text,
  adresse text,
  cp text,
  ville text,
  created_at timestamptz not null default now()
);
create index boost_iap_atc on public.boost_iap (atc);
create unique index boost_iap_numero_raison on public.boost_iap (numero, raison); -- un même N° client peut couvrir deux agences

-- Une ligne par IAP : la to-do phoning
create table public.boost_suivi (
  iap_id int primary key references public.boost_iap on delete cascade,
  date_contact date,                     -- date du premier contact
  appel timestamptz,                     -- coché le…
  mail timestamptz,
  presentation timestamptz,
  commande timestamptz,
  quantites jsonb not null default '{}', -- { "p2-ent-vigie": 2, … }
  montant numeric not null default 0,    -- HT, calculé sur les prix promo
  rappel date,                           -- à rappeler le…
  commentaire text,
  maj timestamptz not null default now(),
  maj_par text
);

-- Historique de chaque modification (traçabilité)
create table public.boost_journal (
  id bigint generated always as identity primary key,
  iap_id int references public.boost_iap on delete cascade,
  par text not null,
  action text not null,
  detail jsonb,
  at timestamptz not null default now()
);
create index boost_journal_at on public.boost_journal (at desc);

alter table public.boost_acces enable row level security;
alter table public.boost_iap enable row level security;
alter table public.boost_suivi enable row level security;
alter table public.boost_journal enable row level security;
-- Les deux administrateurs PICARD (connexion Supabase) gardent un accès direct complet.
create policy boost_admin on public.boost_acces for all using (public.is_admin()) with check (public.is_admin());
create policy boost_admin on public.boost_iap for all using (public.is_admin()) with check (public.is_admin());
create policy boost_admin on public.boost_suivi for all using (public.is_admin()) with check (public.is_admin());
create policy boost_admin on public.boost_journal for all using (public.is_admin()) with check (public.is_admin());

-- ─── Prix promo (HT) : sert au calcul du montant côté serveur ───
create or replace function public.boost_prix()
returns jsonb language sql immutable set search_path = '' as $$
  select '{"p2-ent-vigie":269.10,"p2-ent-vtx":278.10,"p2-etr-vigie":251.10,"p2-etr-vtx":260.10,"p3-ent-vigie":450.00,"s710-ent-vak":490.00}'::jsonb;
$$;

-- ─── Vérification d'un code (ralentie en cas d'échec) ───
create or replace function public.boost_qui(p_code text)
returns public.boost_acces language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces;
begin
  select * into a from public.boost_acces where code = upper(trim(p_code)) and actif;
  if not found then
    perform pg_sleep(0.8);
    raise exception 'Code inconnu ou désactivé.' using errcode = '28000';
  end if;
  return a;
end $$;
revoke all on function public.boost_qui(text) from public, anon, authenticated;

create or replace function public.boost_connexion(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces;
begin
  a := public.boost_qui(p_code);
  update public.boost_acces set derniere_connexion = now() where code = a.code;
  return jsonb_build_object('nom', a.nom, 'role', a.role);
end $$;

-- Ligne IAP + suivi, au format JSON
create or replace function public.boost_ligne(i public.boost_iap)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(i) || jsonb_build_object('suivi', coalesce((select to_jsonb(s) - 'iap_id' from public.boost_suivi s where s.iap_id = i.id), '{}'::jsonb));
$$;
revoke all on function public.boost_ligne(public.boost_iap) from public, anon, authenticated;

-- ─── ATC : ses IAP ───
create or replace function public.boost_mes_iap(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces;
begin
  a := public.boost_qui(p_code);
  return coalesce((select jsonb_agg(public.boost_ligne(i) order by i.raison)
                   from public.boost_iap i where a.role <> 'atc' or i.atc = a.nom), '[]'::jsonb);
end $$;

-- ─── ATC : mise à jour de la to-do d'un IAP ───
-- p_data : champs à modifier parmi date_contact, appel, mail, presentation, commande (booléens pour les étapes),
--          quantites (objet), rappel, commentaire
create or replace function public.boost_maj(p_code text, p_iap int, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces; i public.boost_iap; s public.boost_suivi; k text; kq text; prix jsonb := public.boost_prix(); q jsonb; total numeric := 0; n int;
begin
  a := public.boost_qui(p_code);
  if a.role = 'adv' then raise exception 'Accès en lecture seule.'; end if;
  select * into i from public.boost_iap where id = p_iap;
  if not found or (a.role = 'atc' and i.atc <> a.nom) then raise exception 'IAP introuvable.'; end if;

  insert into public.boost_suivi (iap_id) values (p_iap) on conflict do nothing;
  select * into s from public.boost_suivi where iap_id = p_iap for update;

  for k in select jsonb_object_keys(p_data) loop
    case k
      when 'appel', 'mail', 'presentation', 'commande' then
        execute format('update public.boost_suivi set %I = case when $1 then coalesce(%I, now()) else null end where iap_id = $2', k, k)
          using coalesce((p_data ->> k)::boolean, false), p_iap;
      when 'date_contact' then update public.boost_suivi set date_contact = nullif(p_data ->> k, '')::date where iap_id = p_iap;
      when 'rappel' then update public.boost_suivi set rappel = nullif(p_data ->> k, '')::date where iap_id = p_iap;
      when 'commentaire' then update public.boost_suivi set commentaire = left(p_data ->> k, 2000) where iap_id = p_iap;
      when 'quantites' then
        q := '{}'::jsonb;
        for kq in select jsonb_object_keys(p_data -> 'quantites') loop
          if prix ? kq then
            n := greatest(0, least(9999, coalesce((p_data -> 'quantites' ->> kq)::int, 0)));
            if n > 0 then q := q || jsonb_build_object(kq, n); total := total + n * (prix ->> kq)::numeric; end if;
          end if;
        end loop;
        update public.boost_suivi set quantites = q, montant = total where iap_id = p_iap;
      else null;
    end case;
  end loop;

  -- Une étape cochée sans date de contact : on la renseigne
  update public.boost_suivi set date_contact = coalesce(date_contact, (now() at time zone 'Europe/Paris')::date)
   where iap_id = p_iap and (appel is not null or mail is not null or presentation is not null or commande is not null);
  update public.boost_suivi set maj = now(), maj_par = a.nom where iap_id = p_iap;
  insert into public.boost_journal (iap_id, par, action, detail) values (p_iap, a.nom, 'maj', p_data);

  return public.boost_ligne(i);
end $$;

-- ─── Suivi (ADV, direction) : tout ───
create or replace function public.boost_tableau(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces;
begin
  a := public.boost_qui(p_code);
  if a.role = 'atc' then raise exception 'Accès réservé au suivi.'; end if;
  return jsonb_build_object(
    'iap', coalesce((select jsonb_agg(public.boost_ligne(i) order by i.atc, i.raison) from public.boost_iap i), '[]'::jsonb),
    'atc', coalesce((select jsonb_agg(jsonb_build_object('nom', x.nom, 'derniere_connexion', x.derniere_connexion, 'actif', x.actif) order by x.nom)
                     from public.boost_acces x where x.role = 'atc'), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(j order by j.at desc) from (select jj.at, jj.par, jj.action, jj.detail, ii.raison
                     from public.boost_journal jj left join public.boost_iap ii on ii.id = jj.iap_id order by jj.at desc limit 60) j), '[]'::jsonb)
  );
end $$;

-- ─── Direction : codes d'accès ───
create or replace function public.boost_codes(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces;
begin
  a := public.boost_qui(p_code);
  if a.role <> 'direction' then raise exception 'Accès réservé à la direction.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.role desc, x.nom) from public.boost_acces x), '[]'::jsonb);
end $$;

create or replace function public.boost_nouveau_code()
returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, n) % 31), 1), '') filter (where n < 4)
         || '-' || string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, n) % 31), 1), '') filter (where n >= 4)
  from (select extensions.gen_random_bytes(8) b) r, generate_series(0, 7) n;
$$;
revoke all on function public.boost_nouveau_code() from public, anon, authenticated;

-- Crée, régénère ou (dés)active le code d'une personne
create or replace function public.boost_code_maj(p_code text, p_nom text, p_role text, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces;
begin
  a := public.boost_qui(p_code);
  if a.role <> 'direction' then raise exception 'Accès réservé à la direction.'; end if;
  if p_action = 'creer' then
    insert into public.boost_acces (code, nom, role) values (public.boost_nouveau_code(), trim(p_nom), coalesce(p_role, 'atc'));
  elsif p_action = 'regenerer' then
    if p_nom = a.nom and p_role = a.role then raise exception 'Impossible de régénérer votre propre code depuis cet écran.'; end if;
    update public.boost_acces set code = public.boost_nouveau_code() where nom = p_nom and role = p_role;
  elsif p_action in ('activer', 'desactiver') then
    if p_nom = a.nom and p_role = a.role then raise exception 'Impossible de désactiver votre propre code.'; end if;
    update public.boost_acces set actif = (p_action = 'activer') where nom = p_nom and role = p_role;
  end if;
  insert into public.boost_journal (par, action, detail) values (a.nom, 'code', jsonb_build_object('nom', p_nom, 'role', p_role, 'action', p_action));
  return public.boost_codes(p_code);
end $$;

-- ─── Direction : import du listing IAP (remplace la liste, conserve le suivi des IAP connus : clé N° + nom) ───
-- p_rows : [{ atc, numero, raison, statut, contact_nom, contact_prenom, mail, portable, adresse, cp, ville }]
create or replace function public.boost_import(p_code text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.boost_acces; r jsonb; nb int := 0; vus text[] := '{}'; num text; rs text;
begin
  a := public.boost_qui(p_code);
  if a.role <> 'direction' then raise exception 'Accès réservé à la direction.'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    num := nullif(trim(r ->> 'numero'), ''); rs := nullif(trim(r ->> 'raison'), '');
    if num is null or rs is null or nullif(trim(r ->> 'atc'), '') is null then continue; end if;
    insert into public.boost_iap (atc, numero, raison, statut, contact_nom, contact_prenom, mail, portable, adresse, cp, ville)
    values (trim(r ->> 'atc'), num, rs, nullif(trim(r ->> 'statut'), ''), nullif(trim(r ->> 'contact_nom'), ''), nullif(trim(r ->> 'contact_prenom'), ''),
            nullif(trim(r ->> 'mail'), ''), nullif(trim(r ->> 'portable'), ''), nullif(trim(r ->> 'adresse'), ''), nullif(trim(r ->> 'cp'), ''), nullif(trim(r ->> 'ville'), ''))
    on conflict (numero, raison) do update set atc = excluded.atc, statut = excluded.statut,
      contact_nom = excluded.contact_nom, contact_prenom = excluded.contact_prenom, mail = excluded.mail, portable = excluded.portable,
      adresse = excluded.adresse, cp = excluded.cp, ville = excluded.ville;
    vus := vus || (num || '|' || rs); nb := nb + 1;
  end loop;
  if nb > 0 then delete from public.boost_iap where numero is null or not ((numero || '|' || raison) = any (vus)); end if;
  -- Un code pour chaque nouvel ATC
  insert into public.boost_acces (code, nom, role)
  select public.boost_nouveau_code(), x.atc, 'atc' from (select distinct atc from public.boost_iap) x
  where not exists (select 1 from public.boost_acces y where y.role = 'atc' and y.nom = x.atc);
  insert into public.boost_journal (par, action, detail) values (a.nom, 'import', jsonb_build_object('lignes', nb));
  return jsonb_build_object('lignes', nb);
end $$;

grant execute on function public.boost_connexion(text), public.boost_mes_iap(text), public.boost_maj(text, int, jsonb),
  public.boost_tableau(text), public.boost_codes(text), public.boost_code_maj(text, text, text, text), public.boost_import(text, jsonb)
  to anon, authenticated;

-- Premiers codes : direction et ADV (les codes ATC sont créés à l'import du listing)
insert into public.boost_acces (code, nom, role) values (public.boost_nouveau_code(), 'Direction', 'direction'), (public.boost_nouveau_code(), 'ADV', 'adv');
