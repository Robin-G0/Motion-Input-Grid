# Jeux vidéo

[English](video-games.md) | [Français](video-games.fr.md)

**Télécharger Studio + Controller :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

MIG peut envoyer des touches à un jeu existant avec le Controller ou reconnaître
directement des mouvements dans un jeu que vous développez.

> [!TIP]
> **Vous créez votre jeu ?** Passez à [l'intégration](#intégrer-dans-votre-propre-jeu).
> **Vous jouez à un jeu existant ?** Le Controller envoie ses touches habituelles.

## Commander un jeu existant

> [!CAUTION]
> Vérifiez les règles de l'éditeur avant d'activer la sortie. MIG utilise des
> événements clavier du système sans modifier le jeu ni accéder à la mémoire de
> son processus. Un anti-cheat peut néanmoins signaler un logiciel inconnu ou des
> entrées simulées. Cela ne garantit ni son acceptation ni l'absence de sanction.
> Évitez les sessions compétitives ou protégées si l'autorisation est incertaine ;
> ne cherchez pas à contourner une restriction anti-cheat.

1. Choisissez une session hors ligne ou explicitement autorisée. Vérifiez les
   touches réellement configurées dans le jeu et commencez par une action sans
   conséquence importante, comme une direction dans un menu.
2. Créez un mouvement de poignet dans le [Studio web](studio-web.fr.md) ou le
   [Studio de bureau](configurator.fr.md). Dessinez des régions 🟩 **Required**
   puis une 🟨 **Trigger**. Une 🟥 **Forbidden** annule un parcours indésirable ;
   une 🟪 **Interaction** ajoute une condition de signe de main.
3. Dans le Studio web, choisissez **Associer des touches** et sélectionnez la
   touche du jeu, ou capturez un raccourci. Les touches d’une même ligne sont
   simultanées ; des lignes distinctes produisent des pressions successives.
   Enregistrez le mouvement, puis testez toute la configuration. Le
   [guide du Studio](studio-web.fr.md) présente les commandes.
4. Exportez le JSON, arrêtez la caméra de l'éditeur et importez le profil dans le
   [Controller](controller.fr.md). Calibrez et vérifiez le suivi sans sortie clavier.
5. Activez la sortie et donnez le focus au jeu. Testez une action avant d'en
   ajouter d'autres. Si le jeu refuse l'entrée simulée, arrêtez cette utilisation
   plutôt que de modifier les protections pour la forcer.

**Single press** correspond aux actions ponctuelles, **Hold** maintient la touche
tant que les conditions finales sont remplies, et **Repeat** répète les pressions.
Testez aussi le relâchement des touches. Arrêter le suivi ou désactiver la sortie
libère les touches maintenues. Pendant l'apprentissage, privilégiez les actions
dont une activation involontaire a peu de conséquences.

## Intégrer dans votre propre jeu

Traitez directement les actions logiques dans le jeu. Choisissez
[SDL2 / SFML](../integrations/overview.fr.md),
[Godot](../../integrations/godot/README.fr.md),
[Unity](../../integrations/unity/README.fr.md),
[Unreal](../../integrations/unreal/README.fr.md) ou les
[frameworks JavaScript](../integrations/javascript.fr.md).

Les intégrations aux moteurs nécessitent un fournisseur de positions. Importez
le même JSON, fournissez les observations et associez les noms d'actions au jeu.
Le [catalogue des exemples](../../examples/README.fr.md) donne des points de départ ;
consultez les [plateformes prises en charge](../reference/support.fr.md) pour les limites Preview.
