# Confidentialité de MIG Controller

[English](PRIVACY.md) | [Français](PRIVACY.fr.md)

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
ciblé servent localement à identifier le site ; ni contenu des présentations ni
historique de navigation ne sont collectés ou téléversés. Les commandes sont
ignorées lorsqu'un champ de saisie a le focus.

Le lien facultatif du Studio ouvre le site public MIG, avec le comportement propre
à ce site. Installation et mises à jour via les stores sont gérées par le navigateur
et le store. L'extension ne nécessite pas de compte MIG.

Pour une question ou un problème de confidentialité, utilisez le
[suivi des problèmes du projet](https://github.com/Robin-G0/Motion-Input-Grid/issues).
