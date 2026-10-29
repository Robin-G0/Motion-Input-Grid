# SFML : caméra et actions logiques

[English](README.md) | [Français](README.fr.md)

**Télécharger cet exemple :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sfml-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-sfml-examples).

## Ce que démontre cet exemple

Un aperçu miroir, les doigts et des objets suivant les poignets illustrent
**Left hand raised!** et **Right hand raised!**. Le second exécutable importe
votre JSON du Motion Input Grid Studio et affiche ses noms d'actions.

## Démarrage rapide - archive compilée

1. Extrayez l'archive `*-sfml-standalone`.
2. Dans ce dossier, lancez `mig-sfml.exe` sous Windows ou `./mig-sfml` sous Linux.
3. Gardez les deux épaules visibles pour la calibration. Baissez les mains
   dans le vert, puis montez un poignet vers le jaune. Observez le panneau.
4. Fermez la fenêtre pour libérer la caméra. `mig-sfml-profile.exe / ./mig-sfml-profile` permet d'importer un JSON.

Comptez 30–60 secondes avec les prérequis installés ; le chargement des modèles
dépend du matériel. Dans l'archive groupée, utilisez le dossier de l'exemple.

## Organisation du dossier

| Fichier ou dossier | Rôle |
| --- | --- |
| `main.cpp` | Petit point d'entrée ; sélection du mode démo ou import. |
| `example_usage.hpp` | Initialisation MIG, reconnaissance et gestion des actions. |
| `application.cpp` | Fenêtre, événements, rendu et boucle de traitement. |
| `configuration/raised-hands.json` | Profil local schema-v2 des deux poignets. |
| `support/` | Recherche de ressources et affichage, avec leurs sources locales. |
| `hud.hpp` | Texte des actions et commandes du sélecteur de profil. |
| `CMakeLists.txt` | Compilation des deux variantes avec les cibles publiques MIG. |
| `support/DejaVuSans.ttf` | Police redistribuable du panneau, avec sa licence. |
| `lib/` | Archive Linux : bibliothèques graphiques et sélecteur de fichier. |
| `sdk/` | Archive individuelle : en-têtes et bibliothèques de développement. |

## Parcours du code

1. `main.cpp` appelle `run_application()` dans `application.cpp`.
2. `example_usage.hpp` inclut l'API publique. `initialize_mig()` appelle
   `load_configuration()`, valide le JSON, puis construit `mig::Engine`.
3. `demo::Source::sample()` dans `support/source.hpp` capture RGB et appelle
   `Pose::infer()` ; le mode synthétique fournit des observations de test.
4. `tutorial::process_tracking_frame()` appelle `engine.update(frame, timestamp_ms)`
   et consomme immédiatement les événements empruntés, via
   `engine.configuration().motions[event.motion]`.
5. La boucle d'actions écrit le texte et le panneau ; remplacez-la par vos commandes.
   `draw_frame()` ne retourne que l'aperçu visuel.
6. `demo::import_profile()` valide un remplacement avant de changer le moteur.
7. À la fermeture, Source libère caméra et tâches avant la destruction du moteur.
   Les propriétaires C++ libèrent aussi textures et fenêtre.

## Dépendances et placement des ressources

Fourni : les deux exécutables, MIG/MediaPipe, modèles Lite et mains, bibliothèques
graphiques, police et licences. `runtime/` est local dans l'archive individuelle,
partagé à la racine dans l'archive groupée. Les lanceurs Linux règlent les chemins
des bibliothèques, polices et plugins Qt depuis leur emplacement. Les DLL Windows
restent à côté des exécutables. Conservez tous ces dossiers.

Externe : Windows x64 et runtime VC++, ou Linux x64 avec glibc 2.35+ et affichage
graphique ; webcam pour le suivi réel. Développement facultatif : CMake 3.25+,
compilateur C++20, SDK MIG et bibliothèques de développement graphiques.

## Recompiler hors du dépôt

> [!IMPORTANT]
> **Recompiler demande un SDK avec caméra exportant `MIG::native`.** Utilisez `sdk/`
> d'une archive d'application/tutoriel natif ou une [compilation native](../../docs/integrations/overview.fr.md).
> Le SDK autonome de positions ne fournit pas cette cible.

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH="/chemin/MIG/sdk;/chemin/sdk/graphique"
cmake --build build --config Release
```

L'archive individuelle fournit `sdk/`, recherché par CMake. Les sources copiées
seules nécessitent un SDK MIG installé. Le dépôt complet peut compiler MIG après
bootstrap natif. Les modèles sont séparés des en-têtes : définissez `MIG_RUNTIME`
vers le dossier MediaPipe et `models/`. `--smoke` génère des images sans caméra,
puis quitte. La capture est synchrone : utilisez un worker dans un jeu qui doit
rendre indépendamment du temps d'inférence.

Développement : SFML 2.5 ou 2.6 (pas SFML 3), et Qt6 Widgets sous Linux pour le sélecteur.
Sous Windows, le sélecteur est natif.

## Configuration et réutilisation

> [!TIP]
> **Baissez le poignet dans le vert, puis montez-le vers le jaune.** Rester dans le
> jaune ne déclenche rien : MIG reconnaît un parcours.

| Étape du profil | Région |
| --- | --- |
| Départ Required (vert) | `[-9,3,27,3]` |
| Arrivée Trigger (jaune) | `[-9,1,27,2]` |

Le mode import démarre sans règles. Un JSON invalide préserve le profil précédent ;
un import valide recommence la calibration.

Reprenez le fichier d'intégration indiqué et le profil. Remplacez le callback
d'action par une commande du jeu. Fournissez des observations MediaPipe non
miroir, leur aspect original, une séquence croissante et un temps monotone.
Traitez chaque nouvelle image une fois ; fournissez des observations absentes
si le suivi est perdu. L'aperçu, les objets et le panneau sont uniquement visuels.
Gardez un propriétaire par tracker et son nettoyage. Aucune touche système n'est injectée.

## Dépannage

- Bibliothèque ou modèle absent : conservez tout le dossier extrait. Les sources
  seules nécessitent l'installation ci-dessous et ne contiennent pas les exécutables.
- Caméra occupée : fermez les autres applications et autorisez son accès.
- Aucune action : attendez la calibration des deux épaules, baissez les poignets,
  puis passez du vert au jaune. Un intervalle supérieur à 180 ms nécessite un profilage.
- Import refusé : corrigez l'erreur de schéma ; les règles précédentes restent actives.
- La fermeture attend la fin de l'inférence en cours avant de libérer MIG.
