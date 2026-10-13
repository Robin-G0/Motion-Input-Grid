# Motion Input Grid Studio et Motion Input Grid Controller Windows

[English](windows.md) | [Français](windows.fr.md)

**Sans compilation :** [Télécharger Studio + Controller](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications).

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
supprime pas l'inférence ; overlays périmés disparaissent. Le terminal de logs
est une petite fenêtre flottante opaque : déplacez son titre ou redimensionnez
ses bords. Fermer le masque ; le rouvrir conserve sa position et sa taille.
Il reste ouvert entre les vues et ferme avec l'app. Lire ou sélectionner des
événements anciens suspend le défilement automatique jusqu'au retour en bas.
Boutons remplis/arrondis, états hover/focus/activé. Action verte900 ms
même sans logs/clavier.

Les vues **Movements**, **Edit** et **Test** restent dans la fenêtre principale.
Activez la caméra explicitement et gardez les épaules visibles une seconde.
Body suit les épaules ; Full grid montre27x27, dots/traces reflétés une fois.
Pointage inverse identique ; un trait gèle sa vue.
Un mouvement commence vide avec une étape et sans limite de temps. Choisissez
le point suivi, puis **Select**, **Required**, **Trigger**, **Forbidden**, **Interaction**
ou **Erase**, comme sur le web. Placez directement les cases : il n'y a plus
d'outil de tolérance ni de sélecteur de priorité. Les marges importées sont conservées.
Select trace un rectangle ; Ctrl conserve la sélection précédente, Suppr retire
les régions et leurs marges liées. Un trait correspond à un undo. Action déplace
la case de fin. Zones affiche **Step 1 of N** : les étapes sont des phases
successives. Dans une phase, choisissez **In order**, **Any order** ou
**Simultaneous**. Une étape suffit pour un mouvement simple. La position dans
le parcours apparaît pour une région ordonnée sélectionnée ; un même numéro
représente des alternatives pour le point suivi.

Les contraintes de chaque point restent distinctes ; les autres points sont
visibles en contour. Clear step retire la portée courante ; l'aide est facultative.
Cliquez sur un mouvement pour éditer son point suivi et ses zones. Changer le
point réaffecte immédiatement ses zones ; une collision avec un autre point est
refusée sans perte. Les mains explicites et l’identité des traces sont conservées.
**Movement settings** ouvre identité, clavier et délais ; **Back to zones** revient
au parcours et à la géométrie de la zone sélectionnée. Les options séparées Body
parts, Recording et les boutons Undo/Redo sont retirés ; Ctrl+Z/Y reste disponible.
Les mouvements existants sont actualisés automatiquement dans le document,
les nouveaux sont ajoutés par Apply ; File Save écrit le fichier.

Les réglages main/signe/maintien 0..60000 ms apparaissent après la pose ou la
sélection d’un déclencheur conditionnel violet et modifient directement celui-ci.
Un clic avec sa couleur sélectionne la zone ; une autre couleur demande
confirmation avant remplacement. Erase supprime explicitement les zones.
Les marges importées restent prises en charge.
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
L’interface d’enregistrement n’est plus présentée dans Studio. Les traces des
profils existants restent compatibles avec le schéma. Ctrl+Z/Y et les commandes
de copie/duplication restent disponibles.

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
