-- Fin de la période de test : nouvel équilibre des gains, les résultats joués jusqu'ici sont effacés.
-- Les comptes, codes amis et amitiés restent ; parties, scores, fantômes, matchs et défis repartent de zéro.
-- Appliquée une seule fois, comme toute migration.
delete from challenges;
delete from matches;
delete from scores;
delete from games;
update players set rating = 1000, duel_rating = 1000;
