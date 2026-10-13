# Motion Input Grid Studio et Motion Input Grid Controller Windows

[English](windows.md) | [Français](windows.fr.md)

<details>
<summary>Dans cette page</summary>

- [Compiler et lancer](#compiler-et-lancer)
- [Dessiner](#dessiner)
- [Sorties, Test, enregistrement](#sorties-test-enregistrement)
- [Tests et origine](#tests-et-origine)

</details>

Pour utiliser les applications précompilées, suivez les guides du
[Motion Input Grid Studio](../guides/configurator.fr.md) et du [Motion Input Grid Controller](../guides/controller.fr.md).
Cette page décrit la compilation et les contrôles propres à la plateforme.
Pour une bibliothèque seule, consultez le [SDK C++ / CMake](cpp.fr.md),
[Python](../../bindings/python/README.fr.md) ou [JavaScript](../../bindings/javascript/README.fr.md).

Les deux apps C++20 Win32/GDI partagent capture Media Foundation, MediaPipe natif,
moteur et schéma 2. Pas d'interpréteur ni pont UDP. L'UI reste anglaise ; les guides
sont bilingues.

Le Motion Input Grid Controller dispose d’une interface dédiée aux profils et actions. Consultez
le [guide du Motion Input Grid Controller](../guides/controller.fr.md) pour l’import, la sélection mémorisée,
le mode compact et la vérification. Les outils de dessin ci-dessous concernent
Motion Input Grid Studio.

## Compiler et lancer

Windows 10/11 x64, BuildTools VisualStudio 2022/SDK Windows et CMake 3.25+ pour compiler.
Bootstrap utilise le réseau une fois, -SkipBootstrap réutilise. Microsoft Visual
C++ 2022 Redistributable correspondant est requis sur la machine de destination.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
.\build\windows\bin\motion-input-grid-studio.exe
.\build\windows\bin\motion-input-grid-controller.exe
```

### VS Code et presets CMake

Pour les presets `release` ou `debug`, lancez le bootstrap une fois à la racine :

```powershell
powershell -ExecutionPolicy Bypass -File tools/bootstrap/bootstrap-native.ps1
cmake --preset release
cmake --build --preset release
ctest --preset release
```

Dans VS Code, choisissez `release`, puis **CMake: Configure** et **CMake: Build**.
Les programmes se trouvent dans `build/release/bin`. Si CMake n'est pas dans le
PATH du terminal, utilisez les commandes CMake de VS Code ou le script précédent.
Choisissez `sdk-release` pour les bibliothèques seules, sans applications caméra.

Arrêtez une caméra avant l'autre app. Gardez DLL/modèles/configs près du binaire,
ressources relatives à l'exécutable. --config et --camera N choisissent profil et
caméra. Le Motion Input Grid Studio démarre vide, Right V Recalibrate inactive sans Hands. Le profil fourni
est ouvert explicitement et n'impose aucun dessin. Le Motion Input Grid Controller restaure son dernier
profil sélectionné, avec la caméra et la sortie clavier désactivées.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1 -SkipBootstrap
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1 -Hands OFF -BuildDirectory build/windows-no-hands
cmake --install build/windows --config Release --prefix install
```

Capture préfère les modes larges jusqu'à 1280×720, ajuste toute l'image sans découpe.
Le champ visible reste limité au capteur. Lite par défaut, --pose-full compare
précision/coût ; --pose-lite rétablit Lite. Les deux calculent 33 points, même sans
jambes. Comparez temps/âge/précision avec même éclairage et réglage Hands.

## Dessiner

File/Edit/View, commandes de session, MOVEMENTS et statut entourent la caméra reflétée. View
choisit thème, grille, os des mains, dots et logs séparément. Cacher Hands ne
supprime pas l'inférence ; overlays périmés disparaissent. Logs ferment avec
l'app. Boutons remplis/arrondis, états hover/focus/activé. Action verte900 ms
même sans logs/clavier.

Les vues **Movements**, **Edit** et **Test** restent dans la fenêtre principale.
Activez la caméra explicitement et gardez les épaules visibles une seconde.
Body suit les épaules ; Full grid montre27x27, dots/traces reflétés une fois.
Pointage inverse identique ; un trait gèle sa vue.
Nouveau mouvement vide, une étape Ordered sans limite. Choisissez corps, Pencil/Fill/Tolerance/
Eraser/Select et couleur : vert Required, rouge Forbidden, jaune Trigger.
Tolerance cible la région cliquée, même via son contour Low, sans sélection
préalable. Select trace un rectangle ; Ctrl conserve la sélection précédente,
Suppr retire les régions sélectionnées et leurs tolérances. Un trait=un undo. Order1/2 crée des
alternatives horizontales ; une région de chaque numéro suffit. Trigger unique
movable ; numéros centrés, X gardes, R Required non ordonné.

La stack regroupe contraintes par landmark, autres layers en contour. Aide
facultative ; Hide seulement présentation, Delete tous scopes, Clear step nettoie la portée courante.
Layer body part puis Save layer réaffecte. Collision rejetée ; pending à sauver
ou rétablir avant changement/dessin/Test. IDs/régions/règles conservés, mais mains
explicites et identité des traces inchangées. Save layer=brouillon, Apply=publication
dans document, File Save=fichier.

L’inspecteur sépare Movement, Zones, Fingers, Hand sign, Layers et Recording.
Movement contient identité, clavier et délais ; Zones contient parcours et géométrie.
Il n’y a plus de bascule Basic/Advanced. Violet : main/signe/hold 0..60000 ms avant dessin,
Select/Update pour modifier. Fonctionne sans vert/jaune, réserve la main des
commandes globales. Details montre tous scopes/doigts/signes/délais/touches.
Jump/Crouch sont des régions calibrées ordinaires ; body suit torse. Mirror
échange anatomie/règles/doigts séparément du miroir caméra. Hands partagé/persisté,
activé par règles/signes en ON ; absence ne contourne rien. OFF édite sans inférer.
[Contrat mains](../guides/hands.fr.md).

## Sorties, Test, enregistrement

Nom/action/clavier dans **Movement**. Keys/Ctrl+K et Edit keys acceptent
`"Hello world" _ Enter _ Ctrl + C`, répétitions, accords+ ; boîtes de confirmation.
None événement logique. Single press, Hold ou Repeat 20..60000 ms ; Hold doit finir
par accord. Clavier désactivé au départ, envoie au premier plan après consentement.
Perte, ancienneté, Stop, dialogue, édition et Test annulent/libèrent. Modificateur
reste maintenu tant qu'un propriétaire subsiste. [Contrat](../reference/configuration.fr.md).

Test isole sans touches, feedback persistant. Restart efface sans recalibrer,
Recalibrate remplace l'ancre avec récupération. Remote contrôle Restart/Recalibrate/
Record par Thumb/V/OK/Open palm/Fist anatomiques. Validation 250 ms par défaut,
récupération exactement 1000 ms, relâchement volontaire requis. Un couple signe/main
ne contrôle qu'une commande ; réaffectation retire l'ancienne.
Enregistrement dans éditeur ouvert : landmarks/espace ou full body, Start/Stop
manuel/signe, déplacer point, supprimer échantillon synchronisé, trim/discard puis
conversion explicite.20 Hz max,60 s,2048 points ; au-delà de 64 transitions réduire.
Pas de vidéo sauvée ni règle implicite. Apply/Save, undo/Ctrl+Z/Y et copie/duplication.

## Tests et origine

```powershell
ctest --test-dir build/windows -C Release --output-on-failure
ctest --test-dir build/windows-no-hands -C Release --output-on-failure
```

UI synthétique sans caméra, infer/hands-test sur images vides, camera/session-test
explicitement matériels sans clavier. [Résultats et limites](../reference/support.fr.md).
Bootstrap extrait le wheel officiel0.10.35 comme archive, headers/modèles C ABI
SHA256 épinglés. Pas de Python/Bazel pendant l'exécution ; CPU XNNPACK.
Modèles téléchargés en setup, licences MediaPipe/JSON fournies.
[Paquet officiel](https://pypi.org/project/mediapipe/0.10.35/),
[guide pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).
Connexions de télémétrie observées, silence réseau non garanti. Revue transitive
licences/modèles manuelle. Face/gamepad/analogique/courbure/replay prévus ; Hold
clavier existe bien.
