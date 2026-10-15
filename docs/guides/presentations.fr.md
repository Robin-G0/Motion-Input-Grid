# Commander une présentation

[English](presentations.md) | [Français](presentations.fr.md)

**Télécharger Studio + Controller :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Motion Input Grid Controller peut envoyer des raccourcis pendant une présentation.
Commencez par un mouvement volontaire et gardez le clavier comme solution de secours.

1. Ouvrez le [Studio web](https://robin-g0.github.io/Motion-Input-Grid/studio/) ou le
   [Studio de bureau](configurator.fr.md). Créez **Diapositive suivante**, avec
   l'action `next_slide`, en suivant le poignet de votre choix.
2. Dessinez une région 🟩 **Required** autour de sa position de repos puis une
   région 🟨 **Trigger** plus haut. Placez-les avec le retour caméra selon votre
   mouvement réel, en gardant les épaules visibles. Évitez les positions atteintes
   naturellement en parlant. Revenez au repos entre deux activations.
3. Dans le Studio web, choisissez **Associer des touches**. Ajoutez une pression,
   gardez **Right** (flèche droite) et **Une seule fois**, puis **Enregistrer et
   revenir aux mouvements**. **Tester toute la configuration** montre les actions
   et les opérations clavier simulées. Choisissez **Exporter** : le rappel donne
   accès au Controller et au guide illustré. Aucune modification de JSON n’est nécessaire.
4. Arrêtez la caméra de l'éditeur. Importez le fichier dans le
   [Controller](controller.fr.md), démarrez le suivi et calibrez à votre position
   de présentation. Gardez **Keyboard output** désactivé jusqu'à ce que seul
   le mouvement voulu fasse s'allumer sa ligne.
5. Activez la sortie, donnez le focus à PowerPoint et lancez le diaporama.
   Répétez sur une copie avant de l'utiliser en public.

Dans PowerPoint, **Flèche droite** avance à l'animation ou diapositive suivante ;
**Flèche gauche** revient à la précédente. Une diapositive animée peut donc
demander plusieurs activations. Consultez les
[raccourcis de diaporama Microsoft](https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0).
Pour un autre logiciel, vérifiez d'abord ses raccourcis.

Si nécessaire, créez un mouvement distinct **Diapositive précédente** avec `Left`
(code JSON `37`). Gardez les deux parcours distincts et utilisez Single press.
Désactivez la sortie pendant les questions ou lorsque des gestes ordinaires
risquent de déclencher un parcours.
