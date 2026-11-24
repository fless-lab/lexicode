-- Amis : code à partager, demandes en attente. Une amitié acceptée s'écrit dans les deux sens (friendships).

alter table players add column if not exists friend_code text unique;

create table if not exists friend_requests (
  from_id uuid not null references players(id) on delete cascade,
  to_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to on friend_requests (to_id, created_at desc);
