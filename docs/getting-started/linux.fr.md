# Motion Input Grid Studio et Motion Input Grid Controller Linux

[English](linux.md) | [Français](linux.fr.md)

> [!NOTE]
> Sur Debian, Motion Input Grid Studio, Motion Input Grid Controller et certains exemples natifs sont
> encore en cours de développement et de test. Ils peuvent ne pas fonctionner
> entièrement pour le moment.

Pour utiliser les applications précompilées, suivez les guides du
[Motion Input Grid Studio](../guides/configurator.fr.md) et du [Motion Input Grid Controller](../guides/controller.fr.md).
Cette page décrit la compilation et les contrôles propres à la plateforme.
Pour une bibliothèque seule, consultez le [SDK C++ / CMake](cpp.fr.md),
[Python](../../bindings/python/README.fr.md) ou [JavaScript](../../bindings/javascript/README.fr.md).

mig-Motion Input Grid Studio et mig-Motion Input Grid Controller sont des applications Qt 6 natives partageant
moteur, estimateur et profils schéma 2 avec Windows.

Le Motion Input Grid Controller dispose d’une interface dédiée aux profils et actions. Consultez
le [guide du Motion Input Grid Controller](../guides/controller.fr.md) pour l’import, la sélection mémorisée,
le mode compact et la vérification. Les outils de dessin ci-dessous concernent
Motion Input Grid Studio.

```sh
sudo apt-get install cmake ninja-build g++ python3 qt6-base-dev libxtst-dev libegl1 libgles2
python3 tools/bootstrap/bootstrap-native-linux.py
cmake -S . -B build/linux-apps -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/linux-apps --parallel 3
ctest --test-dir build/linux-apps --output-on-failure
build/linux-apps/bin/motion-input-grid-studio --runtime "$PWD/build/native-linux-deps"
build/linux-apps/bin/motion-input-grid-controller --runtime "$PWD/build/native-linux-deps" --config configs/default.json
```

bash tools/build/build-linux.sh [dossier] [ON|OFF] automatise bootstrap/build/tests
après installation. Sources testées sur Ubuntu 22.04/24.04 x64 ; MediaPipe exige
glibc2.28+, archives apps glibc2.35+. Sources utilisent Qt/X11 système ; archives
fournissent dépendances/plugins/polices. [Installation](packages.fr.md).
--camera N sélectionne /dev/videoN, capture V4L2 YUYV single-plane et permissions
requises. Start ouvre explicitement ; arrêtez une app avant l'autre.

Les commandes de session restent hors de la caméra. Les vues **Movements**, **Edit**
et **Test** partagent la fenêtre principale, avec outils compacts, parties du corps
et les six outils du web : Select, Passage, Action, Cancel, Hand sign et Erase.
Les étapes sont des phases successives ; leur parcours est libre, simultané ou ordonné ;
le maintien apparaît pour les étapes simultanées. Le test désactive la sortie clavier.
Les cases sont numérotées automatiquement pour un parcours ordonné ; poser ou
sélectionner un déclencheur violet affiche le signe et le maintien 0..60000 ms.
Dessinez en Full grid ; Body ajuste l'image
complète reflétée. Le terminal de logs est flottant, déplaçable, redimensionnable
et ancrable. View gère grille, dots/hands, logs et thèmes. Input édite
séquences, Mirror, Single/Hold/Repeat, intervalle et cooldown. Save valide atomiquement.
La page intégrée **Complete JSON profile** conserve tous les champs : doigts, étapes, tolérance, commandes, traces.

Cliquez sur un mouvement pour éditer son point suivi et ses zones. Changer le
point réaffecte ses zones immédiatement ; les collisions avec un autre point
sont refusées sans perte. **Movement settings** et **Back to zones** séparent
l’identité du dessin. Sélectionner une zone affiche X/Y/largeur/hauteur.
Les réglages main/signe/maintien apparaissent pour un déclencheur conditionnel
violet nouvellement posé ou sélectionné et modifient directement la condition.
Un clic avec sa couleur sélectionne la zone ; une autre couleur demande
confirmation. Save écrit le document ; aucun fichier importé n’est écrasé
automatiquement. Les marges et doigts importés restent reconnus ; l’édition
détaillée des doigts passe par JSON. Enregistrement et Undo/Redo ne sont pas
présentés dans cette interface.

Un worker possède caméra/modèles/moteur/commandes. Snapshot sous mutex avec image
Qt copiée et au plus 64 événements. Changement de profil stop/join, rejet sorties
anciennes après 250 ms. Fermeture rejoint et libère les touches. Les widgets restent
sur le thread principal selon [Qt](https://doc.qt.io/qt-6/threads-qobject.html).

Clavier opt-in X11/XTest, désactivé sur Wayland natif. Lettres/chiffres, fonctions,
modificateurs et navigation supportés. Le texte utilise les caractères présents
dans le layout X11 ; caractères absents/non-BMP désactivent avec erreur.
Pas d'équivalent Unicode Windows complet. Hold/Repeat gardent l'ordonnanceur partagé.
--ui-test vérifie les apps offscreen sans caméra. V4L2 physique, touches et précision
humaine demandent un contrôle desktop.
