-- Index sur les clés étrangères : sans eux, chaque suppression en cascade (effacement d'un joueur,
-- purge des parties abandonnées) parcourt toute la table référençante.

create index if not exists ghosts_game on ghosts (game_id);
create index if not exists ghosts_player on ghosts (player_id);
create index if not exists scores_game on scores (game_id) where game_id is not null;
create index if not exists challenges_owner on challenges (owner_id);
create index if not exists challenge_attempts_player on challenge_attempts (player_id);
create index if not exists friendships_friend on friendships (friend_id);

-- Purge quotidienne des parties restées ouvertes.
create index if not exists games_open on games (started_at) where status = 'open';
