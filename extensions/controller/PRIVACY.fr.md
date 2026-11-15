# Confidentialité de MIG Controller

[English](PRIVACY.md) | [Français](PRIVACY.fr.md)

Éditeur : **Motion Input Grid**. Mise à jour : **1 novembre 2026**.

MIG Controller analyse la caméra **sur votre appareil** pour reconnaître les gestes.
Il n'enregistre aucune vidéo, ne téléverse ni images ni positions et n'envoie pas
de télémétrie. JavaScript, WebAssembly et modèles sont embarqués dans l'extension.

La caméra démarre après activation explicite du contrôle manuel ou automatique et
autorisation du navigateur. Le mode automatique suit la présentation sélectionnée.
Arrêtez ou fermez la fenêtre de contrôle pour libérer la caméra. L'icône montre
un rond rouge quand la caméra tourne et un carré gris lorsqu'elle est désactivée.

Réglages, profils importés, langue et touches sont conservés dans le stockage local
de l'extension. La désinstallation supprime ce stockage. Vous pouvez aussi effacer
les données de l'extension dans le navigateur. Aucune synchronisation cloud n'est utilisée.

Les permissions des sites de présentation permettent d'observer leur état et de
leur transmettre des événements clavier. Les autres pages accessibles utilisent
l'accès temporaire accordé lors du clic sur l'icône. L'URL et le titre de l'onglet
ciblé servent localement à identifier le site et les onglets accessibles peuvent
être affichés dans le sélecteur de cible. Les scripts vérifient localement URL,
DOM, visibilité et plein écran ; ces vérifications n'exportent pas les documents
de présentation et ne créent pas de journal persistant de navigation. Ces données
ne sont pas téléversées vers l'éditeur. Les commandes sont ignorées lorsqu'un
champ de saisie reconnu a le focus.

Les pixels caméra et positions dérivées sont traités en mémoire pour reconnaître
les mouvements, pas pour identifier les personnes. Aucun enregistrement vidéo,
outil d'analyse d'usage, publicité, vente de données ou serveur exploité par
l'éditeur n'est utilisé. Les réglages/profils locaux restent jusqu'à leur effacement
ou suppression ; les observations ne sont pas sauvegardées comme enregistrements.
Les sites peuvent effectuer leurs propres requêtes normales en réponse aux commandes,
selon leurs politiques respectives.

Le lien facultatif du Studio ouvre le site public MIG, avec le comportement propre
à ce site. Installation et mises à jour via les stores sont gérées par le navigateur
et le store. L'extension ne nécessite pas de compte MIG.

Pour une question, une demande de suppression concernant un échange de support ou
un problème de confidentialité, contactez **robin.g0.dev@gmail.com** ou utilisez le
[suivi des problèmes du projet](https://github.com/Robin-G0/Motion-Input-Grid/issues).
Contacter le support transmet volontairement les informations de votre message via
votre fournisseur de messagerie ou GitHub ; elles servent à répondre à votre demande.
Ne publiez pas d'images caméra ou de présentations privées dans les issues publiques.
L'éditeur ne peut pas accéder à vos profils locaux ni les supprimer à distance :
effacez les données de l'extension dans votre navigateur.
