-- Jeu à plusieurs : cote de duel, tenue visible des autres, historique des parties, défis entre amis.

alter table players add column if not exists duel_rating int not null default 1000;
alter table players add column if not exists look jsonb not null default '{}';

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('duel', 'party', 'coop')),
  lang text not null,
  code text not null,
  seed text not null,
  ranking jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists match_players (
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  rank int not null,
  rating_delta int not null default 0,
  primary key (match_id, player_id)
);
create index if not exists match_players_player on match_players (player_id);

-- Défi entre amis : le créateur joue une grille fixée par le serveur, puis partage le code.
create table if not exists challenges (
  code text primary key,
  owner_id uuid not null references players(id) on delete cascade,
  lang text not null,
  d int not null,
  nonce text not null,
  started_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'ready', 'rejected')),
  score int,
  ms int,
  log jsonb,
  created_at timestamptz not null default now()
);
create table if not exists challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  code text not null references challenges(code) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  started_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  score int,
  ms int
);
create index if not exists challenge_attempts_code on challenge_attempts (code, score desc);
