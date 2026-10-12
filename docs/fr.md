# Last.fm

Cette intégration amène vos **écoutes Last.fm** dans Gladys : ce que vous écoutez en ce moment, vos scrobbles, des scènes qui réagissent à la musique et trois widgets de tableau de bord.

Last.fm enregistre (« scrobble ») chaque titre écouté sur Spotify, Deezer, Apple Music, YouTube Music, Tidal, Plex, Sonos et bien d'autres lecteurs. Peu importe le lecteur : si vos écoutes arrivent sur votre profil Last.fm, Gladys les voit.

> Intégration communautaire, sans lien avec Last.fm.

## Configuration

### 1. Créer une clé d'API (gratuit)

1. Connectez-vous à Last.fm, puis ouvrez [Créer un compte d'API](https://www.last.fm/api/account/create).
2. Renseignez un nom d'application (par exemple « Gladys ») et une description. L'**URL de callback peut rester vide**.
3. Last.fm affiche une **clé d'API** (32 caractères) et un **secret partagé**. Retrouvez-les à tout moment dans [Mes comptes d'API](https://www.last.fm/api/accounts).

### 2. Renseigner l'intégration

| Champ                     | Rôle                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Clé d'API**             | obligatoire                                                                                                                |
| **Secret partagé**        | uniquement pour lier un compte (aimer des titres depuis Gladys)                                                            |
| **Profils à suivre**      | noms d'utilisateur Last.fm séparés par des virgules (10 au maximum) : le vôtre, celui d'un proche…                         |
| **Intervalle de lecture** | 30 secondes par défaut (de 15 à 300) : c'est le délai de réaction des scènes                                               |
| **Langue des textes**     | noms des appareils et résumés des scènes ; _Automatique_ suit votre tableau de bord dès qu'un widget Last.fm a été affiché |

Enregistrez. Le bouton **Tester la connexion** vérifie la clé et lit chaque profil.

Un profil dont les **écoutes récentes sont masquées** (réglages de confidentialité de Last.fm) ne peut pas être suivi : Last.fm refuse de les communiquer.

### 3. Ajouter les appareils

Dans l'onglet **Découverte**, chaque profil suivi apparaît comme un appareil « Last.fm – _nom_ ». Ajoutez-le et placez-le dans une pièce. Les widgets et les scènes fonctionnent aussi sans appareil, mais le choix du profil dans leurs réglages passe par la liste des appareils.

### 4. Lier votre compte (optionnel)

Uniquement pour **aimer ou ne plus aimer** des titres depuis Gladys (bouton du widget, actions de scène) :

1. renseignez le **secret partagé** et enregistrez ;
2. cliquez sur **Connecter** : une page Last.fm s'ouvre ;
3. cliquez sur **Oui, autoriser l'accès**. Gladys le détecte en quelques secondes : l'écran de configuration indique « compte _nom_ lié ».

Rien d'autre n'est demandé : pas d'URL de redirection à déclarer. La page reste valable 15 minutes ; au-delà, cliquez de nouveau sur Connecter.

Pour délier : bouton **Délier le compte**, et éventuellement révocation de l'accès dans vos réglages Last.fm (rubrique Applications).

## L'appareil d'un profil

| Fonctionnalité                      | Valeur                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- |
| **En écoute**                       | 1 pendant qu'un titre est joué, 0 sinon                                |
| **Titre en cours ou dernier titre** | « Artiste – Titre » ; garde le dernier titre une fois l'écoute arrêtée |
| **Scrobbles du jour**               | depuis minuit, dans le fuseau horaire de Gladys                        |
| **Scrobbles au total**              | depuis la création du compte                                           |

L'historique est conservé : la carte « Graphique » du tableau de bord montre par exemple vos écoutes de la semaine, et les scènes classiques sur la valeur d'un appareil fonctionnent (« plus de 100 scrobbles aujourd'hui »…).

## Scènes : déclencheurs

Dans l'éditeur de scène, rubrique **Last.fm** :

| Déclencheur                  | Se déclenche quand…                                               | Filtres         |
| ---------------------------- | ----------------------------------------------------------------- | --------------- |
| **Last.fm : nouveau titre**  | un profil commence à écouter un titre                             | profil, artiste |
| **Last.fm : début d'écoute** | un profil se met à écouter après une pause                        | profil          |
| **Last.fm : fin d'écoute**   | plus rien n'est joué depuis deux vérifications de suite           | profil          |
| **Last.fm : titre aimé**     | un profil aime un titre (sur Last.fm ou dans un lecteur connecté) | profil, artiste |

Informations transmises aux actions de la scène : nom d'utilisateur, artiste, titre, album, coup de cœur, lien Last.fm, et un **résumé** prêt à envoyer ; pour la fin d'écoute, la durée de la session (minutes) et le nombre de titres joués.

Exemples :

- **Début d'écoute** → tamiser le salon et allumer l'ampli ;
- **Fin d'écoute** → éteindre l'ampli ;
- **Nouveau titre**, artiste « Daft Punk » → passer les lumières en mode disco.

Bon à savoir :

- Le filtre **Artiste** compare le nom **exactement** comme Last.fm l'écrit, majuscules comprises (« Daft Punk », pas « daft punk »).
- Last.fm ne pousse rien : l'intégration lit les profils toutes les 30 secondes par défaut. Une scène réagit donc avec quelques secondes à une demi-minute de décalage.
- Au démarrage de l'intégration, une écoute déjà en cours ne déclenche pas « Début d'écoute » ; seul le titre suivant compte.
- Le même titre écouté deux fois de suite ne compte qu'une fois (Last.fm ne permet pas de distinguer les deux écoutes).

## Scènes : actions

| Action                               | Résultat                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| **Last.fm : titre en cours**         | en écoute (oui/non), artiste, titre, album, coup de cœur, lien, heure d'écoute, résumé  |
| **Last.fm : statistiques d'écoute**  | scrobbles du jour et au total, artiste / album / titre préférés sur une période, résumé |
| **Last.fm : aimer un titre**         | ajoute un titre aux coups de cœur du compte lié                                         |
| **Last.fm : ne plus aimer un titre** | le retire                                                                               |

Pour aimer ou ne plus aimer : laissez **artiste et titre vides** pour viser le titre en cours (ou le dernier écouté) du compte lié, ou renseignez-les (les variables de scène sont acceptées). Ces deux actions nécessitent un compte lié.

## Widgets de tableau de bord

| Widget                       | Contenu                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Last.fm en écoute**        | pochette, titre, artiste et album, scrobbles du jour et au total, état, bouton **J'aime** (compte lié), lien Last.fm |
| **Last.fm écoutes récentes** | les derniers titres avec leur pochette ; le titre en cours et les coups de cœur sont signalés                        |
| **Last.fm tops**             | top artistes, albums (en grille de pochettes) ou titres sur 7 jours, 1, 3, 6 ou 12 mois, ou depuis toujours          |

Chaque widget se règle sur un profil (vide = le premier profil suivi). Le widget « en écoute » se met à jour dès qu'un nouveau titre commence.

Last.fm ne fournit plus de photos d'artistes depuis 2019 : le top artistes s'affiche donc sans image.

## Dépannage

| Symptôme                                 | Cause probable                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| « Last.fm refuse la clé d'API »          | clé mal copiée, ou secret partagé erroné lors de la liaison                                             |
| Un profil n'apparaît pas dans Découverte | nom d'utilisateur inexistant (voir les journaux de l'intégration)                                       |
| « masque ses écoutes récentes »          | le profil a activé l'option de confidentialité correspondante sur Last.fm                               |
| Rien ne se passe en écoutant             | le lecteur n'envoie pas ses écoutes à Last.fm : vérifiez que le titre apparaît sur votre profil Last.fm |
| Le bouton Connecter échoue               | secret partagé manquant : renseignez-le et enregistrez avant de cliquer                                 |
