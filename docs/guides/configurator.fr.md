# Motion Input Grid Studio

Motion Input Grid Studio est l’éditeur de bureau.
[Studio Web](https://robin-g0.github.io/Motion-Input-Grid/studio/) permet de dessiner,
importer et tester avec la caméra dans le navigateur, sans installation.
L’éditeur de bureau permet de configurer et tester les raccourcis clavier système.

[English](configurator.md) | [Français](configurator.fr.md)

<details>
<summary>Dans cette page</summary>

- [Où trouver et lancer l'application](#où-trouver-et-lancer-lapplication)
- [Exemple : lever la main pour avancer une présentation](#exemple--lever-la-main-pour-avancer-une-présentation)
- [Créer un premier profil](#créer-un-premier-profil)
- [Vérifier et utiliser le profil](#vérifier-et-utiliser-le-profil)
- [Compiler depuis les sources](#compiler-depuis-les-sources)

</details>

Le Motion Input Grid Studio de Motion Input Grid (MIG) transforme les mouvements dessinés
en profils JSON. Choisissez une partie du corps, dessinez son parcours et définissez
l'action à envoyer. Exécutez le profil enregistré dans le [Motion Input Grid Controller](controller.fr.md)
ou dans une application utilisant MIG.

## Où trouver et lancer l'application

> [!NOTE]
> Sur Debian, Motion Input Grid Studio, Motion Input Grid Controller et certains exemples natifs sont
> encore en cours de développement et de test. Ils peuvent ne pas fonctionner
> entièrement pour le moment.

Téléchargez pour votre système. Le même paquet contient le Studio et le Controller :

| Système | Télécharger v1.1.0 | Ouvrir après extraction |
| --- | --- | --- |
| Windows x64 | [Télécharger ZIP](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) | `windows/motion-input-grid-studio.exe` |
| Linux x64 | [Télécharger tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) | `./motion-input-grid-studio` |

Ces chemins partent du dossier principal de l'archive extraite. Sous Windows,
ouvrez l'exécutable. Sous Linux, ouvrez un terminal dans ce dossier et lancez
`./motion-input-grid-studio` ; ce lanceur configure les bibliothèques fournies avant d'ouvrir
le binaire dans `bin/`. Conservez les DLL, modèles, configurations et autres
ressources de l'archive ensemble. Windows nécessite le [dernier runtime Visual C++
x64](https://aka.ms/vc14/vc_redist.x64.exe) ; les archives Linux nécessitent glibc 2.35+.

## Exemple : lever la main pour avancer une présentation

Un **profil** est un fichier qui regroupe vos mouvements. Un **input** décrit
un mouvement et son action ; un **layer** contient les régions associées à une
partie du corps. Plusieurs layers peuvent appartenir au même input.

1. Démarrez la caméra, gardez les deux épaules visibles pour le calibrage, puis
   ajoutez un input nommé `Next slide` et sélectionnez votre poignet comme partie suivie.
2. Dessinez des régions 🟩 **Required** en montant depuis la position basse de la
   main. Numérotez-les dans l'ordre du parcours et placez une région 🟨 **Trigger**
   au-dessus. Des régions larges laissent plus de liberté au mouvement.
3. Définissez une action `next_slide`, la touche `Right` et le mode **Single press**.
   La touche doit correspondre au raccourci de votre application de présentation.
4. Sous Windows, utilisez **Apply** et **File → Save**.
   Sous Linux, enregistrez le profil depuis l'interface principale.
5. Arrêtez la caméra du Motion Input Grid Studio, importez le fichier dans le
   [Motion Input Grid Controller](controller.fr.md) et vérifiez le retour visuel avant d'activer
   **Keyboard output**. Donnez ensuite le focus à la présentation.

Baissez la main avant de refaire le mouvement. Pour commencer avec un parcours
déjà dessiné, ouvrez [raised-hands.json](../../examples/common/raised-hands.json),
puis ajoutez votre raccourci à l'input choisi. Il fournit deux parcours de poignet,
active le suivi des mains et demande une version compilée avec leur prise en charge.
Il n'envoie aucune touche tant que vous n'avez pas ajouté de binding.

### Choisir ce que le clavier fait

| Mode | Comportement |
| --- | --- |
| Single press | Exécute la séquence une fois quand le mouvement est accepté. |
| Hold | Maintient le dernier raccourci jusqu'à la fin des conditions du déclencheur. |
| Repeat | Répète la séquence tant que les conditions restent valides, à l'intervalle choisi. |

Dans le champ des touches, `Ctrl + C` est un raccourci simultané ;
`"Hello world" _ Enter` écrit le texte puis appuie sur Entrée. `A _ A` appuie
deux fois sur A. Le mode Hold doit se terminer par un raccourci, pas du texte.
La [référence clavier](../reference/configuration.fr.md#clavier-et-modes)
détaille les limites et les séquences.

## Créer un premier profil

1. Ouvrez Motion Input Grid Studio et démarrez la caméra. Gardez les deux épaules visibles pendant le calibrage.
2. Ajoutez un input. Sous Windows, **Add/Edit** ouvre l'éditeur de dessin ; Linux utilise le volet latéral.
3. Choisissez la partie du corps suivie, par exemple un poignet, et dessinez ses régions sur la grille.
4. Définissez le nom de l'input, son action et éventuellement ses touches clavier.
5. Enregistrez le profil en JSON. Sous Windows, appliquez l'input au document avant **File → Save**.
6. Arrêtez la caméra, ouvrez Motion Input Grid Controller et importez le profil enregistré.

Les couleurs des régions indiquent leurs conditions :

| Couleur | Condition |
| --- | --- |
| 🟩 Vert - Required | Passer par cette région ; les numéros définissent l'ordre du parcours. |
| 🟥 Rouge - Forbidden | Éviter cette région. |
| 🟨 Jaune - Trigger | Terminer le mouvement ici pour déclencher son action. |
| 🟪 Violet - Interaction | Faire le signe de main choisi dans cette région, avec un maintien facultatif. |

Cliquez sur un mouvement pour afficher son point suivi et ses zones. Changer le
point réaffecte immédiatement ses zones dans le document ; une collision avec un
autre point est refusée sans perdre de dessin. **Movement settings** ouvre
l’identité et les sorties ; **Back to zones** revient au dessin. Les réglages du
signe apparaissent après la pose ou la sélection d’un déclencheur conditionnel
violet et modifient directement cette condition. Un clic avec la même couleur
sélectionne la zone ; une autre couleur demande confirmation avant remplacement.
Windows conserve Ctrl+Z/Y sans boutons dans la barre d’outils. Enregistrement et
menu séparé des parties du corps ne sont plus présentés. **File → Save** écrit le
JSON ; l’édition n’écrase jamais silencieusement un fichier importé. Linux conserve
la page intégrée **Complete JSON profile** pour tous les champs du schéma.
Les guides [Windows](../getting-started/windows.fr.md#dessiner)
et [Linux](../getting-started/linux.fr.md) détaillent les outils disponibles.

## Vérifier et utiliser le profil

Choisissez **Select**, puis maintenez le clic gauche en déplaçant la souris pour
sélectionner un rectangle du layer courant. Maintenez **Ctrl** pour conserver
la sélection précédente. **Suppr** retire les régions sélectionnées et leurs
tolérances liées. Sous Linux, utilisez la vue grille complète pour sélectionner.
Les deux interfaces natives reprennent les six outils du web : Select, Required,
Trigger, Forbidden, Interaction et Erase. Placez directement les cases ; l'outil de
tolérance et le sélecteur de priorité sont supprimés. Les marges des profils
importés restent reconnues. Les étapes sont des phases successives ; le parcours
détermine comment atteindre les cases d'une phase : dans l'ordre, en ordre libre
ou simultanément. Une seule étape suffit pour un mouvement simple.

Changer de section conserve les conditions du mouvement. Supprimer une région
violette retire son signe et ses règles de doigts propres, mais les règles
indépendantes de l'input entier et des étapes restent actives. Le résumé des
bindings indique ces règles. **Clear fingers** sous Windows ou
**Clear all finger rules** sous Linux efface les conditions
de doigts de toutes les portées sans supprimer les régions ni les signes des
cases violettes. Sous Windows, le sélecteur de portée dans Fingers indique aussi le
nombre de règles par portée. Après modification, appliquez de nouveau l'input
avant de le tester et enregistrez le document pour conserver les changements.

Gardez les épaules visibles pour que la grille suive votre corps. Essayez le
mouvement et observez le retour des actions. Consultez le [suivi des mains](hands.fr.md)
pour les signes et conditions de doigts. Fermez la caméra d'une application avant
d'ouvrir celle de l'autre.

La sortie clavier est désactivée au lancement. Le guide du Motion Input Grid Controller explique
comment l'activer et utiliser Single press, Hold et Repeat. **View** règle le thème,
les calques de l'aperçu et les logs. La [référence de configuration](../reference/configuration.fr.md)
décrit les champs enregistrés et les modes d'action.

## Compiler depuis les sources

Après compilation depuis les sources :

| Méthode | Fichier depuis la racine du dépôt |
| --- | --- |
| Preset Windows `release` | `build/release/bin/motion-input-grid-studio.exe` |
| Script `tools/build/build-windows.ps1` par défaut | `build/windows/bin/motion-input-grid-studio.exe` |
| Compilation du guide Linux | `build/linux-apps/bin/motion-input-grid-studio` |

Suivez les guides [Windows](../getting-started/windows.fr.md) ou
[Linux](../getting-started/linux.fr.md) pour compiler. Le guide Linux indique
également le paramètre `--runtime` pour les modèles et la bibliothèque MediaPipe.
Les presets `sdk-*` et les packages de bibliothèques ne construisent pas ces applications.
