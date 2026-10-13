# Tutoriel inférence RGB native

[English](README.md) | [Français](README.fr.md)

**Télécharger cet exemple :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-native-consumer-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-native-consumer-examples).

## Ce que démontre cet exemple

Charge MediaPipe et le modèle Full, estime une image RGB vide, active éventuellement les mains et libère les tâches. `sequence=1` confirme le câblage ; une image vide ne prouve pas la précision du suivi humain.

## Démarrage rapide

1. Extrayez `*-native-consumer-standalone` pour Windows/Linux x64.
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
| `runtime` | MediaPipe, modèles Full/mains et bibliothèques Linux. |

## Parcours du code

`main.cpp` contrôle le dossier runtime et `--hands`. `example_usage.hpp` inclut `<mig/native/pose.hpp>`. `demonstrate_inference()` construit `Pose(runtime)` puis règle `set_hands_enabled(hands)`. `infer(rgb, width, height, timestamp_ms, sequence)` retourne les observations non miroir ; remplacez RGB vide par vos pixels caméra et soumettez le résultat à `Engine::update()` pour reconnaître des actions. La sortie de portée ferme les tâches avant la bibliothèque.

## Dépendances et compilation

Externe : Windows x64 et runtime VC++, ou Linux x64 avec glibc 2.35+.
Fourni : exécutable, SDK, licences et MediaPipe/modèles.
L’archive individuelle contient `runtime/` auprès de l’exécutable ; la groupée le partage à sa racine. Le lanceur Linux règle les chemins relatifs.
Développement facultatif : CMake 3.25+, compilateur C++20 et SDK correspondant.
Copiez le dossier et utilisez le SDK installé ou `sdk/` fourni :

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/chemin/MIG/sdk
cmake --build build --config Release
build/mig-native-example runtime
```

Visual Studio utilise `build/Release/` et `.exe`. Les sources seules nécessitent
le SDK et les modèles/runtime de sa version native.
La compilation prend plus de temps que l'essai précompilé.

## Réutilisation et dépannage

Étudiez `example_usage.hpp` et remplacez RGB vide par votre source caméra.
Inférence et reconnaissance sont distinctes ; le tutoriel de positions explique `Engine::update()`.
Conservez des observations fraîches non miroir, leur aspect, un temps monotone,
une séquence croissante et un propriétaire par moteur.

- Runtime absent : conservez modèles/bibliothèque et transmettez son chemin absolu.
- SDK absent : renseignez `CMAKE_PREFIX_PATH` ou conservez `sdk/`.
- Vérifiez l'architecture des bibliothèques et de l'exécutable.

[Installation SDK C++](../../docs/getting-started/cpp.fr.md).
