# API C++ de reconnaissance

[English](cpp.md) | [Français](cpp.fr.md)

> [!TIP]
> **Vous intégrez un jeu ?** Commencez par la boucle ci-dessous, puis lisez les contrats de durée de vie et d’état actif.
> L’installation est détaillée dans le [démarrage C++](../getting-started/cpp.fr.md).

Pour installer uniquement la bibliothèque et la lier à votre projet, suivez
le [guide SDK C++ / CMake](../getting-started/cpp.fr.md). Il couvre les archives,
la compilation, `cmake --install` et les Makefiles générés sous Linux.

Liez `MIG::core` pour reconnaître les positions et `MIG::format` pour charger
les profils. Les en-têtes publics `mig/core/engine.hpp` et
`mig/format/configuration.hpp` ne dépendent ni de la caméra ni de MediaPipe.
`MIG::native` ajoute séparément capture et estimation sous Windows/Linux.
Une façade SDK complète avec gestion des threads reste prévue. [Consommateur natif](../../examples/native-consumer/CMakeLists.txt).

### Requêtes de coordonnées facultatives

`mig/core/coordinates.hpp` fournit des accès XYZ en O(1), sans allocation, et des spans empruntés.
La profondeur image et les mètres monde relatifs aux hanches sont indépendants
de la reconnaissance 2D. `WorldHeightUp` inverse Y monde. Une absence retourne `nullopt`,
sans profondeur inventée. Hands fournit les accès équivalents/associations.
Import/export texte et wrapper Emscripten réutilisent schéma 2 et moteur.
[Intégration et unités](../integrations/overview.fr.md).

## Boucle de mise à jour minimale

```cpp
mig::Engine engine(mig::load_configuration("profile.json"));
mig::Frame frame;
frame.timestamp_ms = monotonic_capture_time_ms;
frame.sequence = next_sequence;
frame.aspect = float(image_width) / image_height;
// Remplir les 33 points anatomiques non reflétés ; confiance 0 si absent.
for (const auto event : engine.update(frame, monotonic_now_ms)) {
    const auto& motion = engine.configuration().motions[event.motion];
    game_dispatch(motion.id);
}
```

## Propriété et horodatage

`update` est `noexcept` ; le stockage est réservé à la construction et la géométrie
est compilée hors de la boucle temps réel. Validation, grille, reconnaissance, arbitrage sont des modules distincts.
Le [test temps réel](../../tests/core/realtime_tests.cpp) vérifie l’absence d’allocations
C++ ordinaires pendant son scénario de mise à jour ; cela ne couvre pas l’inférence native. Paquets futurs/périmés n'avancent pas les watermarks.
Le span retourné appartient au moteur jusqu'au prochain update. L'événement réfère
l'index immuable du mouvement et le temps observé, sans interpolation temporelle
du croisement. Utilisez un seul domaine monotone et recalibrate en changement de
source. Un thread par moteur ; grille/conversions seulement quand grid est valide.

## Contrat des coordonnées

Les épaules **11/12** doivent être valides, chaque chemin exige son poignet 15/16.
L'axe X de la grille pointe image-droite pour un sujet de face, indépendamment de
l'ID anatomique. Ancre [4.5,3.5], ratio 0.2 largeur actuelle, filtre 35 ms comme
centre/axe. La référence d'approche reste fixe. Grille **27 × 27**, `min_cell = -9`, `max_cell = 18`.
Les apps reflètent uniquement image et overlays ; le pointage applique l'inverse
avant les coordonnées grille.

## Événements et actions maintenues

Le SDK émet un événement unique et expose l’état terminal via `action_active(index)` /
`InputProgress::output_active`, vrai après activation valide tant que régions
High/Low et signes/doigts concordent. Sortie, perte, garde ou Restart le supprime.
Ordered sans déclencheur utilise le dernier groupe Required de chaque voie.
Le flag Test triggered persistant ne prouve pas le maintien physique.
Les hôtes implémentent Hold/Repeat avec action_mode/repeat_interval_ms ;
le SDK n’injecte pas de clavier.

> [!WARNING]
> **L’hôte doit relâcher les sorties si les images cessent d’arriver.** Le moteur
> ne peut pas actualiser `output_active` sans appel ; ajoutez un contrôle de fraîcheur dans l’application.

Constructeurs/loaders valident et lèvent une erreur
descriptive ; préparez les remplacements hors boucle temps réel.
[Consommateur installé](../../examples/sdk-consumer/CMakeLists.txt).
