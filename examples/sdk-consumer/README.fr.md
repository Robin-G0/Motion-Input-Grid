# Tutoriel reconnaissance C++ de positions

[English](README.md) | [Français](README.fr.md)

**Télécharger cet exemple :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-sdk-consumer-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-sdk-consumer-examples).

## Ce que démontre cet exemple

Reconnaît `left_raise` à partir de positions synthétiques. Illustre SDK installé, calibration, chemin ordonné et actions logiques sans caméra, modèle ni fenêtre.

## Démarrage rapide

1. Extrayez `*-sdk-consumer-standalone` pour Windows/Linux x64.
2. Lancez `run.cmd` sous Windows ou `sh run.sh` sous Linux dans ce dossier.
3. Observez la sortie console et la fermeture normale. Aucune webcam nécessaire.

Objectif : 30–60 secondes avec les prérequis ; le chargement des modèles dépend
du matériel. L'archive groupée propose aussi ces lanceurs dans son dossier d'exemple.

## Organisation du dossier

| Fichier/dossier | Rôle |
| --- | --- |
| `main.cpp` | Validation des arguments et orchestration simple. |
| `example_usage.hpp` | Appels MIG réels et commentaires pédagogiques. |
| `CMakeLists.txt` | Cibles publiques du SDK ; recherche aussi `sdk/`. |
| `run.cmd`, `run.sh` | Lancement avec arguments relatifs à ce dossier. |
| `sdk/` | En-têtes et bibliothèques dans l'archive individuelle. |
| `licenses/`, `LICENSE` | Notices de redistribution. |
| `configuration/default.json` | Chemin ordonné `left_raise` de l’archive individuelle. |

## Parcours du code

`main.cpp` appelle `initialize_mig()` dans `example_usage.hpp`. Les API core/format sont incluses explicitement ; `mig::load_configuration(path)` valide le JSON avant création du moteur. `calibrate()` fournit des épaules stables, puis `demonstrate_path()` soumet les centres des contraintes avec `engine.update(frame, frame.timestamp_ms)`. `dispatch_events()` consomme immédiatement les événements empruntés et retrouve leur action dans `engine.configuration().motions[event.motion]`. La sortie de portée détruit le moteur, même après une erreur.

## Dépendances et compilation

Externe : Windows x64 et runtime VC++, ou Linux x64 avec glibc 2.35+.
Fourni : exécutable, SDK, licences et profil.
La reconnaissance est liée statiquement ; aucun runtime caméra/MediaPipe requis.
Développement facultatif : CMake 3.25+, compilateur C++20 et SDK correspondant.
Copiez le dossier et utilisez le SDK installé ou `sdk/` fourni :

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/chemin/MIG/sdk
cmake --build build --config Release
build/mig-sdk-example configuration/default.json
```

Visual Studio utilise `build/Release/` et `.exe`. Les sources seules nécessitent
le SDK ; le profil local `configuration/default.json` est déjà fourni.
La compilation prend plus de temps que l'essai précompilé.

## Réutilisation et dépannage

Étudiez `example_usage.hpp` et remplacez les positions synthétiques et la réaction console.
Le marcheur synthétique illustre un chemin simple ; pas les profils simultanés, doigts ou Interaction arbitraires.
Conservez des observations fraîches non miroir, leur aspect, un temps monotone,
une séquence croissante et un propriétaire par moteur.

- Profil absent : transmettez un JSON existant ; le lanceur utilise `configuration/default.json`.
- SDK absent : renseignez `CMAKE_PREFIX_PATH` ou conservez `sdk/`.
- Vérifiez l'architecture des bibliothèques et de l'exécutable.

[Installation SDK C++](../../docs/getting-started/cpp.fr.md).
