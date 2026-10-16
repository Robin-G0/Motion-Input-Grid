# Documentation

[English](index.md) | [Français](index.fr.md)

Motion Input Grid (MIG) reconnaît les mouvements décrits dans un profil JSON.
Utilisez ses applications de bureau pour contrôler une autre application,
ou intégrez le même moteur dans votre projet. Choisissez un point de départ.

## Utiliser les applications de bureau

| Je veux… | Guide |
| --- | --- |
| Créer ou tester un profil dans le navigateur | [Motion Input Grid Studio Web](guides/studio-web.fr.md) |
| Dessiner un mouvement et lui attribuer un raccourci | [Motion Input Grid Studio](guides/configurator.fr.md) |
| Utiliser mon profil avec une autre application | [Motion Input Grid Controller](guides/controller.fr.md) |
| Essayer une démo caméra sans créer de profil | [Exemples autonomes](../examples/README.fr.md) |
| Ajouter un signe de main ou une condition sur les doigts | [Suivi des mains](guides/hands.fr.md) |

**Télécharger Studio + Controller :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).
Les guides ci-dessus indiquent comment les lancer. Pour les tutoriels,
choisissez un téléchargement dans le [catalogue des exemples](../examples/README.fr.md).

## Choisir une utilisation concrète

| Situation | Guide |
| --- | --- |
| PowerPoint et autres diaporamas | [Présentations](guides/presentations.fr.md) |
| Jeux existants ou votre propre jeu | [Jeux vidéo et précautions anti-cheat](guides/video-games.fr.md) |
| Raccourcis des applications de bureau | [Usage quotidien](guides/everyday-use.fr.md) |

## Développer une application avec MIG

| Technologie | Installation et première action |
| --- | --- |
| C++ / CMake / Make | [Installation du SDK](getting-started/cpp.fr.md), [API C++](reference/cpp.fr.md) |
| SDL2 / SFML | [Tutoriel SDL2](../examples/sdl2/README.fr.md), [Tutoriel SFML](../examples/sfml/README.fr.md) |
| .NET / C# | [Pont managé et première action](../bindings/dotnet/README.fr.md) |
| Python | [pip et envoi de frames](../bindings/python/README.fr.md), [Tkinter](../examples/python-tkinter/README.fr.md), [Pygame](../examples/pygame/README.fr.md) |
| Navigateur / React / Vue / Next.js | [Package npm](../bindings/javascript/README.fr.md), [Installation des frameworks](integrations/javascript.fr.md) |
| Godot / Unity / Unreal | [Add-on Godot](../integrations/godot/README.fr.md), [UPM Unity](../integrations/unity/README.fr.md), [Plugin Unreal](../integrations/unreal/README.fr.md) |
| vcpkg / Debian | [Installation des packages](getting-started/packages.fr.md) |

Le [guide de démarrage](getting-started/bootstrap.fr.md) relie profil, suivi et
retour d'action. Le [catalogue des exemples](../examples/README.fr.md) et le
[parcours du code](getting-started/examples.fr.md) vous aident ensuite à adapter
une application fonctionnelle. Le [guide d'intégration](integrations/overview.fr.md)
décrit les points fournis et les adaptateurs caméra natifs.

## Comprendre les contrats

| Sujet | Référence |
| --- | --- |
| Champs JSON, séquences clavier, contraintes et layers | [Schéma de configuration](reference/configuration.fr.md) |
| Packets, handles et cycle de vie des bindings | [ABI C](reference/c-abi.fr.md), [Pont .NET](../bindings/dotnet/README.fr.md) |
| Modules, dépendances et structure du dépôt | [Architecture](architecture/overview.fr.md) |
| Calibrage, espaces de coordonnées et reconnaissance | [Reconnaissance](architecture/recognition.fr.md) |
| Workers, capture et arrêt | [Pipeline d'exécution](architecture/lifecycle.fr.md) |
| Travail temps réel, mesures et limites | [Performances](architecture/performance.fr.md) |
| Plateformes et couverture des tests | [Matrice de support](reference/support.fr.md) |

## Compiler et contribuer

[Compilation Windows](getting-started/windows.fr.md) · [Compilation Linux](getting-started/linux.fr.md) ·
[Contribution](fr/CONTRIBUTING.fr.md) · [Installation des packages](getting-started/packages.fr.md) ·
[Historique](development/CHANGELOG.fr.md) · [Roadmap](development/ROADMAP.fr.md)

Chaque guide possède un lien English/Français en tête. Les noms d'API, champs
JSON et notices légales des dépendances conservent leur écriture d'origine.
