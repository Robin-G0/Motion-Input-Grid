# Tutoriel d’entrée Godot 4 GDScript

[English](README.md) | [Français](README.fr.md)

## Ce que démontre cet exemple

Une action logique par poignet levé, un panneau de retour et un mode import JSON.
Les composants reçoivent des observations fournies. La démo synthétique vérifie
le câblage sans caméra et sans prétendre mesurer la précision. Ces intégrations
d’éditeur restent en preview.

> [!IMPORTANT]
> **Commencez en mode synthétique** pour voir `left_raise` et `right_raise` sans caméra.
> Pour jouer avec une webcam, fournissez ensuite les points du corps depuis votre propre
> estimateur. **Cette intégration est en preview** : vérifiez votre éditeur et vos exports.

## Démarrage rapide

1. Extrayez `*-godot-gdscript-standalone` pour votre plateforme.
2. Importez `project.godot` dans Godot 4.3+ desktop. Ouvrez `raised_hands.tscn`,
   activez **use_synthetic_demo** sur le nœud, puis Run. `profile.tscn` permet les imports.
3. Observez `left_raise` et `right_raise` dans le panneau ; connectez le signal
   au jeu. Désactivez le mode synthétique pour un fournisseur réel.

Éditeur Godot 4.3+ desktop de même plateforme/architecture que l’archive.
L’import et l’exécution sont rapides avec l’éditeur installé ; installation/export
peuvent dépasser une minute. Aucun estimateur caméra fourni.

## Organisation du dossier

| Fichier/dossier | Rôle |
| --- | --- |
| `project.godot / raised_hands.tscn / profile.tscn` | Projet complet, scène démo et scène d’import. |
| `mig_input.gd` | Initialisation MIG, images, signaux et nettoyage. |
| `mig_raised_hands.gd / mig_profile_input.gd` | Sélection du mode initial. |
| `mig_synthetic_frames.gd` | Fournisseur d’observations sans caméra. |
| `raised-hands.json` | Profil local schema-v2 des deux poignets. |
| `addons/mig/` | Archive : GDExtension, descripteur de plateforme, ABI C et licences. |
| `native/ / dependencies/godot/` | Point d’entrée de recompilation facultative et sources locales du bridge. |
| `tests/regression.gd` | Tests déterministes du bridge, scènes, imports et nettoyage. |
| `licenses/`, `LICENSE`, `manifest.json` | Notices et sommes de contrôle de l’archive. |

## Parcours du code

1. `mig_input.gd` → `_ready()` : initialise le propriétaire MIG et charge/valide la configuration locale.
2. `mig_input.gd` → `_process()` : fournit éventuellement les observations synthétiques, séquence et temps croissants.
3. `mig_input.gd` → `submit_frame()` : soumet chaque nouvelle observation une seule fois à MIG et récupère les actions.
4. `mig_input.gd` → `motion_action.emit()` : transmet les chaînes action/identifiant copiées au jeu et actualise le panneau.
5. `mig_input.gd` → `import_profile()` : valide un JSON avant remplacement ; un échec conserve les anciennes règles.
6. `mig_input.gd` → `_exit_tree()` : libère le tracker et ses ressources avant la destruction du composant/nœud.

## Dépendances et placement des ressources

Les bibliothèques natives, profil, bridge et licences sont fournis dans l’archive
individuelle ; l’éditeur et ses outils sont externes. Aucun modèle MediaPipe n’est
nécessaire pour reconnaître des positions fournies. Le fournisseur caméra réel
est facultatif et appelle submit_frame() sur le thread principal du jeu.

`addons/mig/bin/` fournit extension et ABI ; `mig.gdextension` sélectionne
plateforme/architecture. Conservez l’addon dans le projet. Les coordonnées monde
sont en mètres, Y vers le haut ; le script adapte Z à la convention Godot.
Une observation monde absente ne déplace pas le nœud.

## Sources hors du dépôt

Pour les sources seules, installez l’addon Godot MIG correspondant dans `addons/`,
puis importez le projet. Une recompilation facultative du bridge nécessite CMake
3.25+, C++20, SDK ABI et godot-cpp godot-4.3-stable. L’archive inclut les sources
dans `dependencies/godot/` ; configurez `native/` avec GODOT_CPP_DIR et
CMAKE_PREFIX_PATH. Le repli vers le dépôt ne concerne que ses compilations.
Exportez avec l’addon natif correspondant à la cible.

## Réutilisation et dépannage

Étudiez `mig_input.gd` et le profil. Gardez le cycle de vie, remplacez
le callback/signal par vos commandes. Panneau et déplacement sont illustratifs.
Fournissez anatomie MediaPipe non miroir, aspect original, temps monotone et
séquence croissante. Envoyez des observations absentes en cas de perte de suivi.
Ne réutilisez jamais un tracker fermé. Les actions n’injectent pas de touches système.

- Bibliothèque absente : conservez le placement et l’architecture documentés.
- Import refusé : corrigez l’erreur ; les règles précédentes restent actives.
- Aucune action : calibrez les deux épaules, commencez dans Required puis passez
  dans Trigger. Une pose Trigger isolée ne déclenche rien ; au-delà de 180 ms entre
  images, profilez le matériel. Le mode synthétique illustre le profil de démo.
- Le profil contient deux chemins larges Required/Trigger. Un import valide
  recommence la calibration et vide la progression précédente.
- Le premier build/export peut dépasser une minute. Validez exports preview et
  fournisseurs caméra sur votre éditeur/plateforme.

[Référence configuration](../../../docs/reference/configuration.fr.md).
