# Motion Input Grid Studio Web

[English](studio-web.md) | [Français](studio-web.fr.md)

[Ouvrir le Studio](https://robin-g0.github.io/Motion-Input-Grid/studio/). Créez des
gestes, associez leurs touches et exportez sans modifier de JSON. Aucun compte requis.

## Votre premier mouvement

### Capturer au lieu de dessiner

1. Créez ou importez un profil, puis choisissez **Ajouter un mouvement → Capturer
   avec la caméra**. Un nouveau profil ouvre ce choix pour son premier mouvement.
   Sélectionnez la partie du corps et **Normale**, **Haute tolérance** ou **Haute précision**.
2. Activez la caméra. Gardez les épaules et le point choisi visibles jusqu'à
   l'activation d'**Enregistrer la prise**.
3. Revenez au départ et faites le geste **une fois par prise**. Chaque prise
   commence après **3–2–1** et se termine après **cinq secondes**. Arrêtez plus tôt
   avec **S**, **Espace** ou **Terminer cette prise**. Répétez pour **trois prises cohérentes**.
   Les **cases bleues** montrent le chemin parcouru, avec **D (vert)** pour le départ
   et **A (jaune)** pour l'arrivée actuelle. Aux prises suivantes, le dernier
   parcours réussi et ses extrémités restent visibles **en transparence**.
4. Testez le parcours vert-jaune généré. Après une reconnaissance, choisissez
   **Choisir une touche**, puis enregistrez avec l'éditeur clavier habituel.

> [!TIP]
> **Commencez par Normale.** Plus de tolérance élargit les zones, qui peuvent
> chevaucher d'autres mouvements ; une haute précision est plus difficile à reproduire.
> Changez le préréglage après capture et retestez, ou réenregistrez le geste.

Une prise différente ou interrompue est expliquée et recommencée ; les bonnes
prises précédentes sont gardées. Seules les positions du point choisi sont
conservées temporairement, pas la vidéo. Le profil ne change qu'à l'acceptation.
Échap annule et libère la caméra ; quitter l'onglet annule aussi la capture.

La capture apprend des **parcours 2D avec départ et arrivée distincts**, pas les
signes de main, la profondeur ni les boucles fermées. Pour déplacer le corps entier,
ouvrez **Nom et repère** et choisissez **Position initiale**. Le résultat
utilise les zones ordinaires du schéma 2 et reste modifiable dans l'éditeur.
Aucun nouveau runtime ni format de fichier n'est nécessaire.

### Dessiner le parcours soi-même

1. Choisissez **Me guider pas à pas** pour les explications à l’écran, ou
   **Créer un profil → Dessiner le parcours**. Dans un profil existant, choisissez
   **Ajouter un mouvement → Dessiner le parcours**. Le guide vous fait créer le mouvement **HI**.
2. Choisissez le point du corps à déplacer, par exemple votre poignet gauche.
3. Choisissez **Required** en vert et dessinez une zone de départ, puis **Trigger**
   en jaune et dessinez l’arrivée. Le geste passe de la verte à la jaune.
   Gardez les deux épaules visibles pour placer la grille. Le bouton caméra aide
   à repérer votre position avant de dessiner.
4. Choisissez **Tester ce mouvement**, puis **Activer la caméra**. Autorisez l’accès
   et suivez le parcours. Le journal confirme les actions reconnues. Revenez à
   l’édition pour ajuster les zones. Aucune touche n’est envoyée aux applications.
5. Choisissez **Continuer : associer des touches** (ou **Associer des touches**).
6. Le clavier est vide au départ. Cliquez sur **+**, puis choisissez **Right** (flèche droite)
   avec le mode **Une seule fois**. Choisissez **Enregistrer et revenir aux mouvements**.

## Touches, raccourcis et séquences

Les touches d’une ligne sont pressées **ensemble**. Les lignes sont exécutées
**de haut en bas**. L’aperçu montre les opérations configurées.

- Une touche : une ligne contenant **Right**.
- Un raccourci : capturez **Ctrl+C**, ou ajoutez **Ctrl** et **C** sur la même ligne.
- Une séquence : des lignes distinctes **Ctrl+C**, **Right**, **Right**.
- Du texte : une ligne de texte, éventuellement suivie d’une ligne **Enter**.

**Monter**, **Descendre** et **Supprimer** organisent les lignes. Le × retire une
touche. Si le navigateur réserve un raccourci et empêche sa capture, utilisez le
sélecteur. La capture utilise la lettre saisie ; choisissez explicitement la ponctuation.

**Une seule fois** exécute la séquence une fois par geste reconnu. **Maintenir**
exécute les premières lignes une fois et maintient le dernier raccourci tant que
la pose reste active ; la dernière ligne doit contenir des touches. **Répéter**
rejoue la séquence tant que la pose reste active, à l’intervalle choisi.
Commencez par **Une seule fois**. Une séquence vide produit une action logique seulement.

## Gérer et tester

**Mouvements** liste les mouvements et leurs touches. Ajoutez, modifiez, testez ou
supprimez un mouvement. **Annuler** restaure une suppression. Les modifications
sont gardées dans un brouillon local si le stockage est disponible.
**Tester toute la configuration**, puis **Activer la caméra**, reconnaît tous
les mouvements. Le journal montre les actions et les opérations clavier qui
seraient envoyées. Un test ouvert depuis une carte ne reconnaît que ce mouvement.
Aucun test du site n’envoie réellement de touches.

## Exporter et utiliser le Controller

Choisissez **Exporter** et conservez `mig-profile.json`. Le rappel donne accès
au [téléchargement et au guide illustré](https://robin-g0.github.io/Motion-Input-Grid/studio/controller/?lang=fr).
Les liens directs Windows x64 et Linux x64 apparaissent si la dernière release
publique contient les fichiers Controller seuls. En attendant, la page le précise
et donne accès à la version disponible. Les anciennes archives doivent être
entièrement extraites et conservées ensemble ; ouvrez le Controller, pas le Studio.

1. Lancez le Controller. En cas d’alerte SmartScreen, vérifiez la source officielle.
   **Informations complémentaires**, puis **Exécuter quand même** peuvent être
   proposés si vous choisissez de lui faire confiance. Ne désactivez pas la
   protection Windows. Sous Linux, autorisez l’exécution du `.run` dans ses
   propriétés. Le clavier nécessite X11, pas Wayland.
2. Cliquez sur **Import profile**, sélectionnez `mig-profile.json` et vérifiez les touches.
3. Démarrez le suivi avec le clavier désactivé. Vérifiez que le bon mouvement
   s’allume, activez **Keyboard: On**, puis donnez le focus à votre application.

Le Controller autonome contient le moteur et les modèles en un fichier.
Windows conserve un cache du moteur dans Local AppData et le vérifie avant
chaque réutilisation ; Linux extrait temporairement ses fichiers et les retire
à la fermeture normale. Les fonctions caméra et affichage du système restent
nécessaires ; Linux demande glibc 2.35 ou plus récent. Aucun compilateur, Python
ou Studio de bureau à installer.

## Quelques repères

Les images sont traitées sur votre appareil. Le chargement initial télécharge
les modèles et le moteur ; la caméra nécessite HTTPS ou localhost. Le site ne
s’installe pas pour fonctionner hors ligne et ne tape pas dans vos applications.

La grille seule permet le zoom et le défilement. Les notes sont séparées des zones.
Le copier-coller duplique les zones sélectionnées ; Ctrl+A, Ctrl+Z et Ctrl+Y
sélectionnent, annulent et rétablissent. Les paramètres avancés incluent doigts
et durées. L’éditeur JSON reste facultatif.

Le brouillon appartient à un navigateur et une origine (protocole, hôte et port).
Exportez une copie durable avant de vider le stockage ou changer d’appareil.
Les brouillons ne sont pas synchronisés avec un compte.

## Le parcours guidé HI

Le guide construit un mouvement nommé **HI**. Un projecteur désigne le contrôle à utiliser, et le reste de l’interface est grisé et inactif. **Quitter le guide** rétablit l’édition normale. Les étapes avancent après les vraies actions et reconnaissances, sans temporisation.

Nommez HI, choisissez Poignet gauche, tracez la bande inférieure de départ puis la bande supérieure d’arrivée. Gardez les épaules visibles et passez le poignet gauche du vert au jaune. Après reconnaissance, l’éditeur clavier est vide : cliquez sur **+**, puis sélectionnez **Right** ou capturez la flèche droite. Aucune touche n’est préremplie. Le + dans une ligne ajoute une touche simultanée ; le + du bas ajoute une étape suivante. Enregistrez, testez toute la configuration et vérifiez HI et Right dans le journal avant l’export.

La page de téléchargement présente directement sous les boutons trois captures réelles de Windows : Controller vide avec Import profile visible, vérification de l’import HI, puis HI avec Keyboard: On. Le suivi caméra n’est pas démarré dans cette dernière capture. La disposition Linux diffère. Pour les profils suivants, Import profile se trouve sous Manage profile. L’origine des images est consignée dans `site/studio/controller/images/capture.json`. Le script `tools/dev/capture-controller.py` de la branche binaire permet de les refaire après modification de l’interface.

Au premier lancement Windows, le fichier autonome explique où son runtime sera extrait. Copiez le chemin si nécessaire, puis choisissez Continue. Les lancements suivants réutilisent ce dossier vérifié. Fermez MIG avant de le supprimer pour nettoyer ; il sera recréé au prochain lancement. Vos profils sont stockés séparément.

La [référence JSON complète](../reference/configuration.fr.md) détaille les champs et valeurs par défaut. Le [profil HI complet](../../configs/studio-hi.json) est vérifié avec le véritable parseur du format.
