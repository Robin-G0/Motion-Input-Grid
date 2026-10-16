# Motion Input Grid Studio et Motion Input Grid Controller Linux

[English](linux.md) | [Français](linux.fr.md)

**Sans compilation :** [Télécharger Studio + Controller](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

> [!NOTE]
> Sur Debian, Motion Input Grid Studio, Motion Input Grid Controller et certains exemples natifs sont
> encore en cours de développement et de test. Ils peuvent ne pas fonctionner
> entièrement pour le moment.

Pour utiliser les applications précompilées, suivez les guides du
[Motion Input Grid Studio](../guides/configurator.fr.md) et du [Motion Input Grid Controller](../guides/controller.fr.md).
Cette page décrit la compilation et les contrôles propres à la plateforme.
Pour une bibliothèque seule, consultez le [SDK C++ / CMake](cpp.fr.md),
[Python](../../bindings/python/README.fr.md) ou [JavaScript](../../bindings/javascript/README.fr.md).

`motion-input-grid-studio` et `motion-input-grid-controller` sont des applications Qt 6 natives partageant
moteur, estimateur et profils schéma 2 avec Windows.

Le Motion Input Grid Controller dispose d’une interface dédiée aux profils et actions. Consultez
le [guide du Motion Input Grid Controller](../guides/controller.fr.md) pour l’import, la sélection mémorisée,
le mode compact et la vérification. Les outils de dessin ci-dessous concernent
Motion Input Grid Studio.

## Compiler et lancer

Installez les paquets système, préparez les modèles, puis compilez depuis la
**racine du dépôt** :

```sh
sudo apt-get install cmake ninja-build g++ python3 qt6-base-dev libxtst-dev libegl1 libgles2
python3 tools/bootstrap/bootstrap-native-linux.py
cmake -S . -B build/linux-apps -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/linux-apps --parallel 3
ctest --test-dir build/linux-apps --output-on-failure
build/linux-apps/bin/motion-input-grid-studio --runtime "$PWD/build/native-linux-deps"
build/linux-apps/bin/motion-input-grid-controller --runtime "$PWD/build/native-linux-deps" --config configs/default.json
```

`bash tools/build/build-linux.sh [dossier] [ON|OFF]` automatise préparation,
compilation et tests après installation des prérequis.

### Prérequis d'exécution

- **Système :** sources testées sur Ubuntu 22.04/24.04 x64 ; MediaPipe exige
  glibc 2.28+, les archives d'applications glibc 2.35+.
- **Dépendances :** les sources utilisent Qt/X11 du système ; les archives
  fournissent bibliothèques, plugins et polices. Voir l'[installation](packages.fr.md).
- **Caméra :** `--camera N` sélectionne `/dev/videoN`. Capture V4L2 YUYV
  single-plane et permissions sont nécessaires. **Start** ouvre explicitement
  la caméra ; arrêtez une application avant d'ouvrir l'autre.

## Espace de travail et dessin

Le [guide illustré du Studio](../guides/configurator.fr.md) décrit le parcours
de dessin. Voici les commandes et limites propres à Linux :

| Objectif | Comportement sous Linux |
| --- | --- |
| Changer de vue | **Movements**, **Edit** et **Test** partagent la fenêtre. Les commandes de session restent hors de la caméra. |
| Dessiner | Select, Required, Trigger, Forbidden, Interaction et Erase suivent les outils web. Full grid montre la grille ; Body ajuste l'image complète reflétée. |
| Éditer une phase | Choisissez libre, simultané ou ordonné. Le maintien apparaît pour les phases simultanées. Une zone sélectionnée révèle sa géométrie ; une condition violette révèle aussi main, signe et maintien. |
| Changer le point suivi | Les zones sont réaffectées immédiatement ; une collision préserve les deux dessins. |
| Enregistrer | **Save** valide et écrit le document. Les fichiers importés ne sont jamais écrasés automatiquement. |
| Éditer tous les champs du schéma | **Complete JSON profile** conserve doigts, tolérance, commandes et traces. L'édition détaillée des doigts passe par cette page. |
| Consulter les logs | Le terminal flottant se déplace, se redimensionne et s'ancre. **View** gère les dessins de la caméra et les thèmes. |

**L'enregistrement interactif et Undo/Redo ne sont pas présentés dans cette interface.**
Les règles de doigts et marges importées restent reconnues. Test désactive la sortie clavier.

## Worker et sortie clavier



Un worker possède caméra/modèles/moteur/commandes. Snapshot sous mutex avec image
Qt copiée et au plus 64 événements. Changement de profil stop/join, rejet sorties
anciennes après 250 ms. Fermeture rejoint et libère les touches. Les widgets restent
sur le thread principal selon [Qt](https://doc.qt.io/qt-6/threads-qobject.html).

> [!IMPORTANT]
> **La sortie clavier exige X11/XTest. Elle est indisponible sous Wayland natif.**
> Le SDK de positions peut toujours produire des actions logiques sans injection clavier.

La sortie clavier est activée séparément. Lettres/chiffres, fonctions,
modificateurs et navigation supportés. Le texte utilise les caractères présents
dans le layout X11 ; caractères absents/non-BMP désactivent avec erreur.
Pas d'équivalent Unicode Windows complet. Hold/Repeat gardent l'ordonnanceur partagé.
## Limites des tests

`--ui-test` vérifie les applications sans écran ni caméra. V4L2 physique, touches et précision
humaine demandent un contrôle desktop.
