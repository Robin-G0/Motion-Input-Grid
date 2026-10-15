# Motion Input Grid Studio Web

[English](studio-web.md) | [Français](studio-web.fr.md)

[Ouvrir le Studio](https://robin-g0.github.io/Motion-Input-Grid/studio/). Créez des
gestes, associez leurs touches et exportez sans modifier de JSON. Aucun compte requis.

## Votre premier mouvement

1. Choisissez **Me guider pas à pas** pour les explications à l’écran, ou
   **Créer un profil**. Nommez le premier mouvement, par exemple « Diapositive suivante ».
2. Choisissez le point du corps à déplacer, par exemple votre poignet gauche.
3. Choisissez **Required** en vert et dessinez une zone de départ, puis **Trigger**
   en jaune et dessinez l’arrivée. Le geste passe de la verte à la jaune.
   Gardez les deux épaules visibles pour placer la grille. Le bouton caméra aide
   à repérer votre position avant de dessiner.
4. Choisissez **Tester ce mouvement**, puis **Activer la caméra**. Autorisez l’accès
   et suivez le parcours. Le journal confirme les actions reconnues. Revenez à
   l’édition pour ajuster les zones. Aucune touche n’est envoyée aux applications.
5. Choisissez **Continuer : associer des touches** (ou **Associer des touches**).
6. Pour une présentation, ajoutez une pression et gardez **Right** (flèche droite)
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
Il extrait temporairement ses fichiers pendant l’exécution, puis les retire à la
fermeture. Les fonctions caméra et affichage du système restent nécessaires ;
Linux demande glibc 2.35 ou plus récent. Aucun compilateur, Python ou Studio de
bureau à installer.

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
