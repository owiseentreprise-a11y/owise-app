-- Fermer au public cinq fonctions qui créaient des comptes ou révélaient des
-- adresses e-mail, sans demander la moindre authentification.
--
-- Trouvé le 2026-11-09 en passant les conseillers Supabase après l'ajout de
-- colonnes. VÉRIFIÉ, pas supposé : chaque point ci-dessous a été constaté par
-- un appel réel depuis Internet, avec la seule clé publiable.
--
--   find_user_by_email(e-mail)        → HTTP 200. Rend l'identifiant du compte.
--                                        Permet de savoir qui a un compte chez
--                                        Owise, et d'obtenir son UUID.
--   get_user_email(identifiant)       → HTTP 200. Rend l'ADRESSE E-MAIL.
--   create_client_account(...)        → HTTP 200. A RÉELLEMENT CRÉÉ UN COMPTE
--                                        client, avec sa fiche. N'importe qui
--                                        peut en créer autant qu'il veut.
--   create_collaborateur_account(...) → HTTP 400 sur une valeur invalide, donc
--                                        la fonction est bien appelée. Avec un
--                                        identifiant d'entreprise valide, elle
--                                        rattacherait un collaborateur à CETTE
--                                        entreprise.
--   create_chauffeur_account(...)     → porte pourtant un garde :
--                                        IF (auth.jwt() -> 'app_metadata' ->>
--                                            'role') != 'admin' THEN RAISE
--                                        Il est INERTE pour un appelant anonyme.
--                                        Sans JWT, `auth.jwt()` vaut NULL, donc
--                                        la comparaison vaut NULL — ni vrai ni
--                                        faux — et un `IF NULL THEN` ne
--                                        s'exécute pas. Le garde n'arrête qu'un
--                                        utilisateur CONNECTÉ non-admin ; il
--                                        laisse passer celui qui n'est pas
--                                        connecté du tout. Constaté : l'appel
--                                        anonyme n'a pas rendu « Permission
--                                        denied » mais une erreur de doublon,
--                                        c'est-à-dire qu'il était arrivé
--                                        jusqu'à l'insertion.
--
-- POURQUOI FERMER NE CASSE RIEN, vérifié dans le code publié :
--   · les trois `create_*` ne sont appelées NULLE PART ;
--   · `find_user_by_email` : seulement dans admin/courses/nouvelle/actions.ts
--     et le webhook Stripe, tous deux avec le client d'administration ;
--   · `get_user_email` : seulement dans src/lib/supabase/admin.ts.
--   Toutes passent donc par la clé de service, qui garde son accès ci-dessous.
--
-- Postgres accorde EXECUTE à PUBLIC par défaut, et `anon`, `authenticated` et
-- `service_role` en héritent. On retire donc à PUBLIC — sinon la porte reste
-- ouverte — puis on redonne explicitement à `service_role`, sans quoi le site
-- cesserait de fonctionner.

-- 1. Les deux lectures d'identité
revoke execute on function public.find_user_by_email(text) from public, anon, authenticated;
grant  execute on function public.find_user_by_email(text) to service_role;

revoke execute on function public.get_user_email(uuid) from public, anon, authenticated;
grant  execute on function public.get_user_email(uuid) to service_role;

-- 2. Les trois créations de compte
revoke execute on function public.create_client_account(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.create_client_account(text, text, text, text, text, text, text, text)
  to service_role;

revoke execute on function public.create_collaborateur_account(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.create_collaborateur_account(uuid, text, text, text, text, text, text)
  to service_role;

revoke execute on function public.create_chauffeur_account(text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.create_chauffeur_account(text, text, text, text, text, text, text, text, text, text)
  to service_role;

-- 3. Les deux fonctions de déclencheur n'ont aucune raison d'être appelables
--    directement. Elles s'exécutent par le déclencheur, qui n'a pas besoin de
--    ce droit.
revoke execute on function public.handle_new_user()  from public, anon, authenticated;
revoke execute on function public.notify_new_devis() from public, anon, authenticated;

-- 4. Le compte vide créé pendant la vérification du 2026-11-09 à 03:07 (heure
--    de Paris). Il n'a ni historique, ni course, ni facture : sa suppression
--    n'orpheline rien. C'est le seul compte qu'ait produit ce test.
delete from clients  where id = '9aaaa12f-a414-46a9-a33e-e346041cc7fa';
delete from profiles where id = '9aaaa12f-a414-46a9-a33e-e346041cc7fa';
delete from auth.users where id = '9aaaa12f-a414-46a9-a33e-e346041cc7fa';
