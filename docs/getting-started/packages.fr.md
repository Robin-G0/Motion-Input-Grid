# Installer les packages de release

[English](packages.md) | [Français](packages.fr.md)

Téléchargez les packages correspondant à votre système et à votre architecture
depuis les [tableaux de la dernière release](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.0.2#user-content-downloads).
Conservez l’archive complète après extraction. La [matrice de support](../reference/support.fr.md)
précise les prérequis et la maturité des intégrations.

## Applications desktop et exemples

- Les archives `desktop applications` contiennent Motion Input Grid Studio, Motion Input Grid Controller, le runtime
  caméra et les modèles. Consultez le [Motion Input Grid Studio](../guides/configurator.fr.md)
  ou le [Motion Input Grid Controller](../guides/controller.fr.md).
- Chaque exemple possède son téléchargement `*-standalone` ; choisissez la
  technologie et la plateforme dans le [guide des exemples](../../examples/README.fr.md).
- Les archives `*-standalone` contiennent un tutoriel natif, navigateur ou moteur
  à la racine avec ses dépendances. Suivez son README et conservez tout le contenu.
  Node 22.12+ est externe pour les tutoriels navigateur individuels ; les ponts
  natifs sont fournis, tandis que les éditeurs/compilateurs restent externes.
- Les exemples JavaScript incluent les assets navigateur et les lanceurs Node.
  Lancez `run.cmd` ou `sh run.sh` dans le dossier choisi, puis ouvrez l’URL affichée.

## Structure des archives et compilation des sources

Un tutoriel individuel place README, application, intégration et ressources
runtime dans un seul dossier. Une archive commune les range sous `examples/`
et partage ses dépendances à la racine. Déplacer seulement un sous-dossier peut
perdre ces dépendances ; choisissez son archive `*-standalone` pour le copier seul.

Le dépôt source contient du code modifiable, pas les runtimes précompilés.
Installez les dépendances du README pour recompiler. Les viewers natifs fournissent
bibliothèques/modèles ; Python fournit aussi l'interpréteur ; les viewers navigateur
fournissent pages compilées/WASM/MediaPipe/modèles. Node reste externe aux archives
navigateur individuelles et est fourni dans l'archive JavaScript commune. Les
tutoriels moteurs fournissent les ponts natifs, mais exigent l'éditeur et votre fournisseur de tracking.

Le [guide des outils](../../tools/README.fr.md) relie chaque packager à ses entrées
et à son contenu ; le [guide des tests](../../tests/README.fr.md) décrit la validation des téléchargements.

## SDK C++ et vcpkg

Extrayez l’archive `*-sdk` adaptée et fournissez son dossier SDK à CMake :

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/chemin/absolu/vers/sdk
```

Liez `MIG::core` et, pour les profils, `MIG::format`. Le SDK reconnaît les mouvements
à partir de points fournis ; les applications caméra utilisent un runtime natif
séparé. Consultez l’[installation C++](cpp.fr.md).

Pour vcpkg, extrayez l’overlay de release puis installez avec :

```sh
vcpkg install motion-input-grid --overlay-ports=/chemin/vers/motion-input-grid-vcpkg-overlay
```

L’overlay télécharge les sources de la release correspondante. Le
[guide vcpkg](../../ports/motion-input-grid/README.fr.md) précise les triplets supportés.

## Python et JavaScript

```sh
python -m pip install motion-input-grid
npm install motion-input-grid
npx mig-copy-assets public/mig
```

Pour une installation hors ligne, utilisez la wheel ou le tarball npm téléchargé :

```sh
python -m pip install /chemin/motion_input_grid-1.0.2-<tags>.whl
npm install /chemin/motion-input-grid-1.0.2.tgz
```

Python importe `mig` ; la wheel reconnaît les mouvements à partir de positions
fournies. Le package npm inclut WebAssembly, les modèles navigateur et les
adaptateurs de frameworks. Ces packages n’installent pas les applications desktop.
Consultez les guides [Python](../../bindings/python/README.fr.md) et
[JavaScript](../../bindings/javascript/README.fr.md).

## Debian/Ubuntu

Installez le package téléchargé correspondant à votre architecture :

```sh
sudo apt install ./motion-input-grid_1.0.2_amd64.deb
```

Utilisez le package `arm64` sur ARM64. Le package Debian fournit le SDK C++ et
l’ABI C ; les applications desktop sont distribuées séparément. Une installation
par nom nécessite un dépôt APT proposant MIG ; télécharger un `.deb` n’en configure
pas un. Le [guide Linux](linux.fr.md) couvre les applications caméra.

## Moteurs de jeu

Choisissez le package adapté à votre plateforme et à votre version du moteur :

- [Add-on Godot](../../integrations/godot/README.fr.md)
- [Package UPM Unity](../../integrations/unity/README.fr.md)
- [Plugin Unreal](../../integrations/unreal/README.fr.md)

Ces intégrations sont en Preview et utilisent votre fournisseur de tracking.
Leurs README décrivent l’installation, les dépendances natives et les limites
de l’éditeur et des exports.
