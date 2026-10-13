# Port vcpkg Motion Input Grid (MIG)

[English](README.md) | [Français](README.fr.md)

[**Télécharger l’overlay prêt à installer**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-vcpkg-overlay) — extrayez-le avant `vcpkg install`. La génération ci-dessous est facultative.

Ce dossier est le port de MIG lui-même. Le `vcpkg.json` à la racine est le manifeste
séparé des dépendances nécessaires pour compiler MIG.

Lancez `python tools/packaging/package-source.py` pour créer les archives du moteur et de
l'overlay dans `build/releases`. Extrayez l'overlay et passez sa racine à
`vcpkg install motion-input-grid --overlay-ports=/chemin/motion-input-grid-vcpkg-overlay`. Le fichier généré
`motion-input-grid/source.cmake` fixe l'URL de publication et le SHA512 réel de l'archive source.
Le modèle versionné échoue volontairement tant que ce fichier n'a pas été généré.

Les features par défaut activent les profils JSON et les mains. `motion-input-grid[c-api]`
ajoute l'ABI C partagée et nécessite un triplet dynamique. Applications et
MediaPipe sont exclus. Utilisez `find_package(MIG CONFIG REQUIRED)` et les cibles
`MIG::core`, `MIG::format`, `MIG::hands` ou `MIG::c`. Le SDK et son consommateur
doivent employer le même compilateur/toolset.

Avant l'upload, le test d'artefact place l'archive générée dans le cache vcpkg et
vérifie son hash. Après l'upload manuel, testez aussi l'URL publique sans ce cache.
La publication dans un registre ou la proposition à vcpkg restent manuelles.

[Guide de distribution](../../docs/getting-started/packages.fr.md).
