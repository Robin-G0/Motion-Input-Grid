# Motion Input Grid Studio Web

[English](studio-web.md) | [Français](studio-web.fr.md)

[Ouvrir Motion Input Grid Studio Web](https://robin-g0.github.io/Motion-Input-Grid/studio/).
C’est une alternative statique dans le navigateur à [Motion Input Grid Studio](configurator.fr.md),
avec le même format de profil JSON et le même moteur de reconnaissance.

1. Choisissez **Importer JSON**, **Nouveau profil**, ou l’exemple. L’accueil propose
   aussi de reprendre le brouillon local si le stockage du navigateur est disponible.
2. Choisissez un mouvement puis **Éditer**. Sélectionnez une partie du corps et
   dessinez les zones 🟩 **Required**, 🟥 **Forbidden**, 🟨 **Trigger** ou 🟪 **Interaction**.
   L’inspecteur donne accès aux coordonnées précises, doigts et durées ; les
   réglages avancés du mouvement restent séparés.
3. Choisissez **Tester**, autorisez la caméra et gardez les deux épaules visibles.
   Affichez seulement les actions ou choisissez un niveau de log. Les zones
   déclenchées s’allument brièvement.
4. Pour les raccourcis, ajoutez `keyboard` au mouvement via **JSON**, ou ouvrez
   le profil exporté dans les réglages du mouvement du Studio de bureau. Le
   [guide des présentations](presentations.fr.md) donne un exemple. Exportez puis
   importez le JSON dans [Motion Input Grid Controller](controller.fr.md).

La grille miroir correspond au retour caméra. Dessinez ou gommez des notes pendant
le test ; elles restent visibles en édition et peuvent être nettoyées séparément
du profil. La vue grille seule offre zoom et défilement. Le copier-coller garde les
zones sélectionnées pour les déplacer et redimensionner ; Ctrl+A, Ctrl+Z et Ctrl+Y
agissent dans l’éditeur.

Les images sont traitées localement ; le chargement initial télécharge les modèles
et le moteur. Le navigateur émet des actions mais ne peut pas envoyer de raccourcis
aux autres applications. Le Studio de bureau propose les réglages des raccourcis
et les tests clavier système. L’export fonctionne aussi sans autorisation caméra.

Les brouillons appartiennent à un navigateur et une origine (protocole, hôte et port).
Un autre port localhost ou navigateur ne les partage pas. Exportez le JSON pour une
copie durable ou un transfert entre ordinateurs. Vider le stockage du navigateur
supprime les brouillons ; ils ne sont pas synchronisés à un compte.
