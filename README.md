# Plateforme de suivi sportif — Vercel

## Déploiement
1. Décompressez le ZIP.
2. Importez le dossier dans un dépôt GitHub.
3. Dans Vercel : **Add New → Project**, importez ce dépôt.
4. Framework Preset : **Other** ; Build Command et Output Directory peuvent rester vides.
5. Déployez. `index.html` est servi à la racine et `api/espn.js` / `api/sofa.js` servent de relais serveur.

## Fonctions
- Agenda hebdomadaire du lundi au dimanche, navigation entre semaines et recherche par nom de compétition.
- Football élargi : divisions inférieures (par exemple Championship, League One, League Two, National League), coupes, compétitions féminines, jeunes, tournois continentaux et championnats d'Afrique, d'Asie, d'Amérique et d'Océanie.
- Basketball : NBA, WNBA, compétitions universitaires et quelques ligues internationales selon disponibilité ESPN.
- Hockey : NHL et compétitions universitaires lorsque le flux ESPN est disponible.
- Handball via Sofascore (API publique non officielle, disponibilité variable).
- Mode direct : rafraîchissement de l'écran toutes les 10 secondes lorsque l'option est activée. Les compétitions sans match en cours sont revalidées moins souvent pour limiter les appels ; les compétitions actives sont rafraîchies plus fréquemment.
- Détection d'une hausse du score pendant un match en cours : bannière « BUT ! », mise en évidence du match et remontée temporaire de sa compétition en tête de l'agenda.
- Détails et statistiques ESPN Summary lorsque les données sont disponibles.
- Forme des cinq derniers matchs, estimations statistiques et historique local des pronostics.

## Limites importantes
- La liste étendue repose sur des identifiants de compétitions connus pour l'API ESPN. Certaines compétitions peuvent être absentes, inactives ou ne pas fournir de calendrier pour une date donnée ; elles sont ignorées sans bloquer les autres.
- La couverture des petites équipes n'est pas universelle. Elle dépend de la compétition effectivement couverte par ESPN ou Sofascore ; cette application ne peut pas créer les rencontres manquantes.
- Le suivi n'est pas un flux seconde par seconde : l'actualisation dépend du fournisseur, du cache réseau et de la fréquence de rafraîchissement. Une alerte de but peut donc arriver avec un délai.
- Possession, tirs, corners, cartons et événements détaillés ne sont pas disponibles pour toutes les compétitions ou rencontres ; l'application ne les invente pas.
- Sofascore repose sur une API publique non contractuelle qui peut changer ou bloquer les requêtes.
- L'historique est conservé dans le navigateur/appareil et n'est pas synchronisé entre appareils.
- Les probabilités sont indicatives et ne garantissent aucun résultat. Ce projet n'est pas un conseil financier ou de pari.
- Aucune clé API ni variable d'environnement n'est requise pour cette version.

## Onglet eSport FIFA — 1xBet Côte d'Ivoire
- Onglet indépendant « eSport FIFA · 1xBet », séparé du football réel.
- Intègre la page FIFA officielle 1xBet dans un panneau embarqué, avec liens directs de secours.
- Trois vues : En direct (`/fr/live/fifa`), À venir (`/fr/line/fifa`) et Résultats (`/fr/results`).
- Les données et le rafraîchissement de cette partie sont fournis par le site 1xBet lui-même ; l'application ne scrape pas son interface et ne prétend pas disposer d'une API privée.
- Selon les restrictions d'intégration du site, l'affichage embarqué peut être bloqué sur certains navigateurs. Dans ce cas, utiliser les liens « Ouvrir… » qui ouvrent les pages officielles dans un nouvel onglet.
- La page « Résultats » de 1xBet est générale et peut afficher plusieurs sports ; l'utilisateur doit choisir FIFA/eSport dans les filtres disponibles sur 1xBet. La ligne FIFA peut afficher « Événements introuvables » lorsqu'aucun match à venir n'est publié.
