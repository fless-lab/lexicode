-- Schéma initial du serveur Lexicode.

create extension if not exists pgcrypto;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  city text not null default '',
  country text not null default '',
  rating int not null default 1000,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Une partie classée commence côté serveur : la graine et l'heure de départ sont fixées ici.
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  lang text not null,
  mode jsonb not null,
  board_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int,
  ms int,
  status text not null default 'open' check (status in ('open', 'won', 'failed', 'rejected'))
);
create index if not exists games_player on games (player_id, started_at desc);

-- Meilleur résultat validé par joueur, langue et tableau (défi du jour d'une date, mode d'arène…).
create table if not exists scores (
  player_id uuid not null references players(id) on delete cascade,
  lang text not null,
  board_key text not null,
  score int not null,
  ms int not null,
  game_id uuid references games(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (player_id, lang, board_key)
);
create index if not exists scores_rank on scores (lang, board_key, score desc, ms asc);

-- Fantômes : parties classées rejouables, pour les duels quand personne n'est en ligne.
create table if not exists ghosts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  lang text not null,
  board_key text not null,
  mode jsonb not null,
  rating int not null,
  ms int not null,
  log jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists ghosts_pick on ghosts (lang, board_key, rating);

-- Événements saisonniers pilotés à distance (vide = l'application utilise sa copie embarquée).
create table if not exists events (
  id text primary key,
  data jsonb not null,
  starts date not null,
  ends date not null,
  enabled boolean not null default true
);

create table if not exists friendships (
  player_id uuid references players(id) on delete cascade,
  friend_id uuid references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, friend_id)
);
