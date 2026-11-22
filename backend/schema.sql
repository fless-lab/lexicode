-- Classements réels (Supabase / PostgreSQL).
-- Remplace DemoRanking (src/services/ranking.ts) par un service qui appelle ces tables.

create table players (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,               -- compte Supabase Auth (anonyme ou Google)
  name text not null check (char_length(name) between 2 and 16),
  city text,
  country text,
  rating int not null default 1000,
  created_at timestamptz default now()
);

create table friendships (
  player_id uuid references players(id) on delete cascade,
  friend_id uuid references players(id) on delete cascade,
  primary key (player_id, friend_id)
);

-- Un seul score par joueur, par langue et par jour.
create table daily_scores (
  player_id uuid references players(id) on delete cascade,
  lang text not null,
  day date not null,
  score int not null check (score between 0 and 1000),
  ms int not null check (ms > 3000),     -- moins de 3 s = suspect
  mistakes int not null,
  hints int not null,
  created_at timestamptz default now(),
  primary key (player_id, lang, day)
);

create index daily_rank on daily_scores (lang, day, score desc, ms asc);

-- Anti-triche minimal : le serveur fixe le début de partie, le client ne peut pas mentir sur le temps.
create table daily_starts (
  player_id uuid references players(id) on delete cascade,
  lang text not null,
  day date not null,
  started_at timestamptz default now(),
  primary key (player_id, lang, day)
);

-- Classement filtré : scope = 'city' | 'country' | 'world' | 'friends'
create or replace function board(p_lang text, p_day date, p_scope text, p_me uuid)
returns table (name text, place text, score int, ms int, is_you boolean)
language sql stable as $$
  select p.name,
         case when p_scope = 'world' then p.country else p.city end,
         d.score, d.ms, p.id = p_me
  from daily_scores d join players p on p.id = d.player_id
  where d.lang = p_lang and d.day = p_day
    and (p_scope = 'world'
      or (p_scope = 'country' and p.country = (select country from players where id = p_me))
      or (p_scope = 'city' and p.city = (select city from players where id = p_me))
      or (p_scope = 'friends' and (p.id = p_me or p.id in (select friend_id from friendships where player_id = p_me))))
  order by d.score desc, d.ms asc
  limit 100;
$$;
