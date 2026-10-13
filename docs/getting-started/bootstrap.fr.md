# Démarrer un projet

[English](bootstrap.md) | [Français](bootstrap.fr.md)

<details>
<summary>Dans cette page</summary>

- [Configurer une action](#configurer-une-action)
- [Lancer et adapter](#lancer-et-adapter)
- [Bibliothèque installée ou dépôt](#bibliothèque-installée-ou-dépôt)
- [Choisir un preset CMake](#choisir-un-preset-cmake)
- [Vérifier](#vérifier)

</details>

Pour installer uniquement la bibliothèque et la lier à votre projet, suivez
le [guide SDK C++ / CMake](cpp.fr.md). Il couvre les archives,
la compilation, `cmake --install` et les Makefiles générés sous Linux.

Pour utiliser les bibliothèques sans les compiler, installez
`python -m pip install motion-input-grid` (Python) ou
`npm install motion-input-grid` (navigateur/React/Vue/Next.js), puis
`npx mig-copy-assets public/mig` pour les ressources navigateur.
[Python](../../bindings/python/README.fr.md) · [JavaScript](../../bindings/javascript/README.fr.md).

Les applications de bureau et le runtime caméra Python restent des
archives natives séparées ; les exemples précompilés incluent leurs dépendances.

Téléchargez le tutoriel individuel `*-standalone` de votre technologie depuis les
[téléchargements de la release](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-downloads). Extrayez tout le contenu : le tutoriel individuel possède
ses ressources ; l’archive commune partage runtime, bindings et licences. Le
code accompagne les exécutables ou pages compilées. Les [instructions autonomes](../../examples/README.fr.md)
précisent les exigences du système.

## Configurer une action

Commencez avec [raised-hands.json](../../examples/common/raised-hands.json).
Les actions `left_raise` et `right_raise` suivent les poignets anatomiques 15/16
à travers quatre lignes vertes Required puis une ligne jaune Trigger. Chaque ligne
traverse la grille. Gardez les épaules visibles environ une seconde, baissez les
mains puis levez-en une. L'image est reflétée une seule fois ; gauche/droite
désignent votre anatomie. Copiez le profil avant de changer ses noms `action`.
Les IDs doivent rester uniques et le [schéma 2](../reference/configuration.fr.md) valide.

La démo charge ce profil. La variante profile commence vide : **Import profile**
charge un JSON et relance le calibrage. Une erreur conserve le profil précédent.
Les événements s'affichent dans la fenêtre et le terminal ; les exemples
n'envoient pas de touches aux autres applications.

## Lancer et adapter

| Technologie | Lancement depuis l'archive | Retour à connecter |
| --- | --- | --- |
| Python/Tk | `main.exe` sous Windows, `./main` sous Linux | `handle_detected_actions()` dans son `example_usage.py` |
| Pygame | `main.exe` sous Windows, `./main` sous Linux | `handle_detected_actions()` dans son `example_usage.py` |
| SDL2 | `mig-sdl2.exe` ou `./mig-sdl2` | `tutorial::handle_detected_actions()` dans son `example_usage.hpp` |
| SFML | `mig-sfml.exe` ou `./mig-sfml` | Même fonction nommée dans son propre `example_usage.hpp` |
| Navigateur simple | `run.cmd` ou `sh run.sh` | `MIGSession.onAction` |
| React | `run.cmd` ou `sh run.sh`, `/` ou `/profile.html` | `useMIG({onAction})` |
| Vue | `run.cmd` ou `sh run.sh`, `/` ou `/profile.html` | Composable `useMIG({onAction})` |
| Next.js | `run.cmd` ou `sh run.sh`, `/` ou `/profile` | `onAction` du composant client |
| C++ positions fournies | `run.cmd` / `sh run.sh` dans le tutoriel SDK | Événements du résultat de `engine.update(frame)` |
| Estimateur C++ natif | `run.cmd` / `sh run.sh` ; arguments dans son README | Fournir RGB, mettre à jour le moteur, lire les événements |
| Unity | Ajouter le `package.json` du tutoriel autonome via Package Manager | UnityEvent `OnAction`, `SubmitFrame(packet)` |
| Godot C# | Ouvrir le projet .NET autonome et `raised_hands.tscn` | Signal `MotionAction`, `SubmitFrame` |
| Godot GDScript | Ouvrir `project.godot` autonome et `raised_hands.tscn` | Signal `motion_action`, `submit_frame` |
| Unreal | Copier le dossier autonome dans `Plugins/MigExample` du projet | `OnMotion`, `SubmitFrame` |

Lancez ces commandes depuis le dossier du tutoriel autonome extrait. Les anciennes
archives communes ou celles compilées localement utilisent `examples/<technologie>`.
Le README de chaque tutoriel précise les prérequis.

Les variantes d'import utilisent `profile.exe`/`profile` en Python et
`mig-*-profile` en C++. Les composants des moteurs ont une démo et une variante
générique. Ils nécessitent l'éditeur installé et un fournisseur caméra/points.
`UseSyntheticDemo` vérifie les branchements ; ce ne sont pas des exports autonomes.

## Bibliothèque installée ou dépôt

Les sources Python nécessitent Python 3.10+, Pillow, Pygame et Tk pour le sélecteur :

```sh
python -m pip install motion-input-grid pillow pygame
python examples/python-tkinter/main.py
python examples/pygame/profile.py
```

L'import `mig` installé est préféré, avec repli sur `bindings/python` fourni
dans le package ou un dépôt complet vérifié.
La wheel pip inclut l’ABI C de positions. Les exemples caméra demandent aussi
un SDK natif avec caméra ; `MIG_LIBRARY` désigne sa bibliothèque ABI C et
`MIG_RUNTIME` son dossier MediaPipe/modèles pour remplacer la découverte. Les exécutables figés
incluent Python et les interfaces, puis utilisent le runtime natif de l'archive.
Consultez le [paquet Python](../../bindings/python/README.fr.md).

Les exemples graphiques C++ cherchent `find_package(MIG CONFIG)` avant de compiler le dépôt :

```sh
cmake --install build/linux-native --prefix "$PWD/install"
cmake -S examples -B build/graphics -DCMAKE_PREFIX_PATH="$PWD/install"
cmake --build build/graphics --parallel 2
```

Ajoutez `--config Release` sous Windows pour compiler/installer. La recompilation
exige le compilateur et les paquets de développement SDL2/SFML ; l'archive fournit
leurs dépendances d'exécution. L'[intégration](../integrations/overview.fr.md) décrit RGB et
les observations fournies.

Les workspaces JavaScript utilisent le même nom de paquet que les applications :

```sh
cmake -P tools/bootstrap/bootstrap-web.cmake
node tools/bootstrap/bootstrap-browser.mjs
npm ci
npm run prepare:javascript
npm run build:examples
```

Compilez d'abord `build/web/web/mig.mjs` et `mig.wasm` avec Emscripten ; les
commandes complètes sont dans le [guide JavaScript](../integrations/javascript.fr.md).
Le paquet npm inclut modèles, MediaPipe et WASM locaux. Dans un projet consommateur,
`mig-copy-assets public/mig` les copie vers les fichiers servis. Utilisez localhost
ou HTTPS. Start demande explicitement la caméra. React libère ses ressources
en StrictMode ; Next n'initialise celles du navigateur que côté client.

Pour C#, utilisez [MigTracker](../../bindings/dotnet/README.fr.md).
L'[API C](../reference/c-abi.fr.md) expose les contrats bas niveau Python/C#.
Traitez des événements logiques, puis libérez les trackers et la caméra à la sortie.

## Choisir un preset CMake

Un preset enregistre les options de compilation et le dossier de sortie.
L'extension CMake Tools de VS Code utilise ces mêmes presets. En choisir un
configure le projet ; cela ne lance pas le programme.

`CMakePresets.json` est partagé dans Git. Placez les réglages propres à votre
machine, comme les chemins des outils locaux, dans `CMakeUserPresets.json`, ignoré
par Git.

- `release` : Motion Input Grid Studio, Motion Input Grid Controller et moteur optimisés. Préparez d'abord les
  dépendances natives ; voir [Windows](windows.fr.md) ou [Linux](linux.fr.md).
- `debug` : les mêmes applications avec les informations de débogage.
- `sdk-release` / `sdk-debug` : moteur et bindings seuls, sans applications caméra
  ni MediaPipe. Un compilateur C++20 est nécessaire ; la première configuration
  télécharge la dépendance JSON si elle n'est pas déjà installée.

```sh
cmake --preset sdk-release
cmake --build --preset sdk-release
ctest --preset sdk-release
```

Pour les applications, sélectionnez `release` après le bootstrap. Un clone neuf
ne contient ni dépendances téléchargées ni binaires. Une erreur de bootstrap
manquant se résout avec la commande de préparation de la plateforme ; changer
le mode d'optimisation ne la résout pas.

## Vérifier

`--smoke` produit des positions synthétiques et teste événements et affichage.
Il ne vérifie pas la caméra. Testez vous-même précision des signes, relâchement
des touches et systèmes cibles. Consultez l'[explication du code](examples.fr.md)
avant de modifier les threads, les ressources ou le miroir.
