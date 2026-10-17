# Historique des changements

[English](CHANGELOG.md) | [Français](CHANGELOG.fr.md)

## Non publié

- Ajouter un parcours illustré bilingue pour Canva, PowerPoint, PDF et autres présentations ; alléger la navigation, les exemples et les références techniques.
- Refuser NUL dans les identifiants, noms et actions des profils pour préserver les chaînes natives.
- Conserver l'enregistrement actif si une nouvelle sélection de points est invalide.
- Valider la documentation à chaque push et pull request, même sans modification de code.
- Aligner l'architecture bilingue, les prérequis du SDK caméra et les exemples avec l'implémentation.

## 1.1.0

- Présentation et Studio web pour créer, importer, annoter et tester les profils.
- Contrôles Required / Forbidden / Trigger / Interaction harmonisés et icônes natives.
- Terminal de logs déplaçable, édition contextuelle et corrections de rafraîchissement.
- Wheels Python : RECORD vérifié et normalisé après auditwheel.
- Déclaration TypeScript corrigée : confidence sur MIGCoordinate.
- Catalogue de téléchargement organisé par usage, plateforme et intégration.


- Renomme les interfaces, le Studio web et les exécutables en Motion Input Grid
  Studio / Controller (`motion-input-grid-studio`, `motion-input-grid-controller`).
- Studio regroupe édition contextuelle et test dans une fenêtre, sans mode
  Basic/Advanced. Linux expose aussi étapes, parcours et maintien simultané.

- Motion Input Grid Studio et Motion Input Grid Controller reprennent la palette claire/sombre du site et séparent
  session, mouvements et zones sous Windows/Linux. La précision avancée et le
  consentement clavier restent disponibles.
- Motion Input Grid Studio Web est documenté comme alternative navigateur partageant les profils JSON.

## 1.0.2

- Chaque tutoriel natif, navigateur ou moteur possède son téléchargement autonome,
  avec sources, instructions de lancement et runtime nécessaire. Les tableaux de
  release séparent les exemples par technologie et plateforme ; les collections
  regroupant tous les exemples ne sont pas publiées.
- Outils et tests sont classés par usage. Les guides bilingues décrivent le contenu
  des packages, l'installation et les cycles de vie, avec les derniers téléchargements.
- L’import desktop présente toutes les commandes clavier avant acceptation et exige
  une activation séparée. Le moteur et le parseur valident les touches et les limites
  des séquences de manière cohérente.
- Les démos des mains levées utilisent de grandes régions Required et Trigger, avec
  des tests sur les observations sautées et le sens du mouvement.
- Les packages natifs partagent les dépendances Python et évitent les copies de
  runtime dans le SDK. Les builds C++ parallèles sérialisent la copie des assets.
- Les guides d’exemples décrivent le lancement, l’intégration et l’installation
  des packages.

## 1.0.0 - première version publique

Le prototype et le développement initial ont eu lieu en privé avant cette première publication.

- Moteur C++20 : grille proportionnelle aux épaules, régions Required/Forbidden/Trigger
  ordonnées, symétrie anatomique, interactions doigts/signes et durée de maintien.
- Schéma JSON 2 strict, coordonnées calibrées et C ABI 1 avec cycle de vie explicite.
- Contrôleur/configurateur caméra Windows/Linux ; clavier Single/Hold/Repeat sur activation.
- SDK CMake installé, overlay vcpkg, wheel/sdist Python autonome, package navigateur
  WASM avec adaptateurs React/Vue/Next.js et outils Debian/APT signé.
- Add-on Godot, UPM Unity et Code Plugin Unreal, tous **Preview**.
- Builds candidats reproductibles, tests de packages extraits, manifestes et empreintes.

Voir les [limites de validation](../reference/support.fr.md) et la [roadmap](ROADMAP.fr.md).
