# Intégrer MIG dans une application

[English](overview.md) | [Français](overview.fr.md)

<details>
<summary>Dans cette page</summary>

- [Installation des bibliothèques](#installation-des-bibliothèques)
- [SDK et coordonnées](#sdk-et-coordonnées)
- [SDL2/SFML et Linux natif](#sdl2sfml-et-linux-natif)
- [Navigateur](#navigateur)
- [Construire les assets](#construire-les-assets)

</details>

## Installation des bibliothèques

**Choisissez la ligne correspondant à votre application :**

| Application | Installation | Prochaine étape |
| --- | --- | --- |
| Python | `python -m pip install motion-input-grid` | [Binding et positions](../../bindings/python/README.fr.md) |
| Navigateur, React, Vue, Next.js | `npm install motion-input-grid`, puis `npx mig-copy-assets public/mig` | [Démarrage JavaScript](javascript.fr.md) |
| C++ | SDK CMake correspondant à votre plateforme | [Démarrage C++](../getting-started/cpp.fr.md) |
| Godot, Unity, Unreal | Exemple adapté à votre éditeur | [Choisir un exemple](../../examples/README.fr.md) |

> [!IMPORTANT]
> **Reconnaître des positions et obtenir ces positions sont deux étapes distinctes.**
> Le wheel Python et les packages runtime de moteurs de jeu attendent vos points du corps.
> Le package navigateur inclut sa session caméra ; les exemples desktop demandent le runtime natif.

Choisissez pip pour Python (`from mig import Tracker`) ou npm pour le
navigateur, React, Vue et Next.js. Consultez les guides
[Python](../../bindings/python/README.fr.md) · [JavaScript](../../bindings/javascript/README.fr.md).

Les applications de bureau et leur runtime caméra se téléchargent séparément :
[Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Le dossier `distribution/` regroupe les applications, le SDK CMake et les ressources
préparées pour chaque plateforme ; `build/releases/` contient les archives compressées.
Sous Windows, conservez les DLL, modèles et configurations avec les applications.
La version Linux fournit Qt 6 et le SDK ABI. Les exemples graphiques sont distribués séparément.
[Bootstrap](../getting-started/bootstrap.fr.md) donne les commandes simples, [Linux](../getting-started/linux.fr.md)
les limites UI, [exemples](../../examples/README.fr.md) les deux variantes.

## SDK et coordonnées

`MIG::core` reconnaît les mouvements depuis les points fournis. `MIG::format`
charge les profils JSON ; `MIG::native` ajoute la capture et MediaPipe ; `MIG::hands`
expose les 21 articulations d’une main. Un snapshot correspond à une acquisition,
un timestamp et une séquence. Utilisez-le sur son thread propriétaire ou copiez-le
vers une boîte aux lettres synchronisée.

```cpp
#include <mig/core/coordinates.hpp>
#include <mig/core/engine.hpp>
#include <mig/format/configuration.hpp>
#include <mig/native/pose.hpp>

auto configuration = mig::load_configuration("profile.json");
mig::Engine engine(std::move(configuration));
mig::native::Pose pose("runtime", engine.configuration().track_hands);
auto frame = pose.infer(rgb_bytes, width, height, capture_ms, sequence);
const auto events = engine.update(frame, capture_ms);
for (const auto& event : events) {
    game_action(engine.configuration().motions[event.motion].action);
}
```

parse_configuration(json_text) importe le même schéma strict depuis HTTP/fichier/ressource.
body_coordinate(frame,15) donne XYZ/confiance ; WorldHeightUp pour Y monde haut.

| Espace | X/Y/Z | Origine |
| --- | --- | --- |
| Image corps | X droit,Y bas normalisés,Z modèle plus petit = plus près | Z relatif aux hanches |
| Image main | Idem | Poignet |
| Monde corps | Mètres X droit, Y bas, Z profondeur | Milieu des hanches |
| Monde main | Mètres | Centre main, indépendant du corps |
| WorldHeightUp | Monde avec Y inversé | Même origine |

> [!WARNING]
> Les coordonnées sont des **estimations du modèle**, pas une distance caméra mesurée.
> Les profondeurs de la main et du corps ont des origines différentes : ne les additionnez pas.
> Pour un aperçu miroir, utilisez `screen_x = (1 - x) * width` ; la règle Mirror est indépendante.

| Besoin | Contrat |
| --- | --- |
| Lire un point | `body_coordinate` / `hand_coordinate` : O(1), sans allocation, `std::nullopt` si absent ou invalide |
| Fonctionner en 2D | Les validités image/monde sont indépendantes ; le monde est facultatif |
| Lire la tête | L'indice 33 utilise le milieu des oreilles, sinon le nez ; seuil corps par défaut : 0,6 |
| Filtrer les mains | Le score de classification gauche/droite ne donne pas une confiance par articulation |
| Lire en bloc | `body_coordinates` / `hand_coordinates` renvoient des spans empruntés |
| Résoudre un nom | Appelez `landmark_index` une seule fois, puis gardez l'indice |
| Associer les mains | Seules les entrées `[0, count)` existent ; appelez `hand_observations(hands, body)` une fois par image, puis lisez `hand_indices[Left/Right]` (`-1` si ambigu ou absent) |
| Garder les données | `Pose::hand_frame()` expire à la prochaine inférence, modification de capacité ou destruction ; les événements expirent au prochain `update()` |
| Maintenir une commande | `action_active` expose l'activation ; l'hôte planifie Hold/Repeat et ses commandes, sans injection clavier par le SDK |

## SDL2/SFML et Linux natif

Les viewers chargent JSON, dessinent corps/mains, déplacent les objets et affichent
actions. SDL2>=2.0.10, SFML 2.5/2.6 ; SFML 3 exige ses propres appels de dessin.

```sh
cmake -S examples -B build/graphics -DCMAKE_PREFIX_PATH=/sdk
cmake --build build/graphics
build/graphics/sdl2/mig-sdl2
build/graphics/sfml/mig-sfml
```

La découverte native fonctionne sans argument. --synthetic produit des points,
--runtime choisit caméra, --hands force l'affichage mains, --smoke exécute 90 images sans caméra.
SDL dummy et SFML headless vérifient sans écran. Capture/inférence synchrones pour
lisibilité ; les jeux peuvent utiliser worker/boîte au dernier état.
Le natif Linux dlopen MediaPipe C ABI 0.10.35 x64 ; les outils Python téléchargent,
le runtime C++ n'utilise pas Python.

```sh
python3 tools/bootstrap/bootstrap-native-linux.py
cmake -S . -B build/linux-native -DCMAKE_BUILD_TYPE=Release \
    -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
    -DMIG_BUILD_NATIVE_RUNTIME=ON -DMIG_NATIVE_DEPS="$PWD/build/native-linux-deps"
cmake --build build/linux-native --parallel 3
ctest --test-dir build/linux-native --output-on-failure
cmake --install build/linux-native --prefix "$PWD/build/linux-install"
```

V4L2 single-plane streaming YUYV,1280x720 négocié, permission pour /dev/videoN.
MJPEG seul/multiplane rejetés. shutdown demande arrêt, read poll de 100 ms borné.
Même propriété Pose/Hands que Windows ; les tests synthétiques ne prouvent pas
la compatibilité d’une caméra physique. Vérifiez votre appareil et son format.

## Navigateur

Emscripten compile core/format/hands en mig.mjs+wasm, wrapper mig-tracker.
MediaPipe Tasks Vision fournit image/monde ; copie en typedarrays fixes, sans JSON
par image. Même validation/reconnaissance C++ locale.

```js
import {MIGTracker} from './mig-tracker.mjs';
const tracker = await MIGTracker.create(await (await fetch('profile.json')).text());
await tracker.importURL('another-profile.json');
tracker.update(poseResult, handResult, Math.floor(performance.now()), width / height,
  (action, inputId) => gameAction(action, inputId));
const wrist = tracker.coordinate(15);
const height = tracker.coordinate(15, 2);
const indexTip = tracker.handCoordinate(0, 8, 0);
tracker.recalibrate();
tracker.dispose();
```

handCoordinate(side,joint,system) absent si anatomie inconnue/ambiguë. MediaPipe
landmarks/worldLandmarks ou handBuffer basniveau sont aussi disponibles.
gesture(0/1),active(index) pour logique hôte. Corps 33×8 : XYZ,confidence,worldXYZ,
worldValid ; mains 2×21×6 image XYZ + world XYZ. Reprenez les vues empruntées après
import/appel pouvant faire croître la mémoire WASM.
Servez localhost/HTTPS, pas file://. Le serveur affiche index/profile, import,
Start/Stop/recalibration, dessin, événements DOM mig-action. vision JS/WASM,
modèles et moteur sont locaux, copiés lors du bootstrap/package. Aucun CDN au Start.
Pas clavier OS navigateur. Inférence synchrone peut bloquer UI ; Worker en production
si nécessaire. [Guide pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
[guide main](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js),
[Emscripten](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html).

## Construire les assets

```sh
cmake -P tools/bootstrap/bootstrap-web.cmake
node tools/bootstrap/bootstrap-browser.mjs
emcmake cmake -S . -B build/web -DMIG_BUILD_WEB=ON -DMIG_BUILD_TESTS=OFF \
    -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF
cmake --build build/web --parallel 3
node tests/bindings/javascript/web_tests.mjs
```

CMake>=3.25 ; l’image Emscripten 4.0.15 utilise un CMake plus vieux :
vous pouvez installer CMake 3.31.10 avec pip.
tools/docker/linux-sdk.Dockerfile pour Linux. package-distribution.ps1 copie SDK et assets
disponibles sans effacer les fichiers étrangers. Binaires SDL2/SFML bruts peuvent
nécessiter dépendances système ; archives release les fournissent. Gardez permissions
et architecture/compilateur compatibles. WASM indépendant du système hôte.
Le [guide des outils](../../tools/README.fr.md) précise les entrées des packagers
et les ressources incluses dans chaque archive.
Godot propose des dossiers C# et GDScript ; ce dernier utilise une GDExtension.
Python/Tk/Pygame et Unity/Godot/Unreal utilisent le même [ABI](../reference/c-abi.fr.md).
Graphiques compilables séparément ou par examples/CMakeLists. Chaque UI a démo
et importeur. Python/Tk est dans `examples/python-tkinter` ; Pygame possède
sa propre application, intégration, configuration et ses utilitaires locaux.
React/Vue sont adaptateurs minces, Next réutilise React avec un démarrage SSR sûr :
[guide JavaScript](javascript.fr.md), [code complet](../getting-started/examples.fr.md).
