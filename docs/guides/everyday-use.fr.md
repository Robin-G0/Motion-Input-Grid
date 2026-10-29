# Utiliser MIG au quotidien

[English](everyday-use.md) | [Français](everyday-use.fr.md)

**Télécharger Studio + Controller :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Associez un mouvement volontaire à un raccourci connu de l'application au premier
plan. Commencez sur un document jetable avec une action facile à annuler.

> [!TIP]
> **Premier objectif : copier du texte d'essai.** Choisissez **Une seule fois**
> et une zone jaune que vos gestes habituels n'atteignent pas.

## Créer, tester et utiliser

1. Créez un mouvement dans le [Studio web](studio-web.fr.md) ou le
   [Studio de bureau](configurator.fr.md). Nommez-le **Copier la sélection**, avec
   l'action `copy_selection`. Dessinez 🟩 **Required** au repos du poignet et
   🟨 **Trigger** dans une position que votre frappe normale n'atteint pas.
2. Dans le Studio web, choisissez **Associer des touches**, ajoutez un raccourci
   et capturez **Ctrl+C**, ou ajoutez **Ctrl** et **C** sur la même ligne.
   Gardez **Une seule fois**, puis **Enregistrer et revenir aux mouvements**.
   Dans le Studio de bureau, utilisez les réglages et **Single press**.
   Testez la configuration, puis exportez-la. Aucune modification de JSON n’est nécessaire.
3. Arrêtez la caméra de l'éditeur et importez le JSON dans le
   [Controller](controller.fr.md). Démarrez le suivi, calibrez et vérifiez le
   mouvement avec la sortie clavier désactivée.
4. Activez la sortie. Dans un éditeur de texte, sélectionnez du texte d'essai et
   effectuez le mouvement. Collez manuellement pour vérifier ce qui a été copié.
5. Revenez au repos avant de recommencer. Désactivez la sortie ou arrêtez le suivi
   lorsque vous quittez l'application cible.

> [!WARNING]
> Les raccourcis vont à **l'application au premier plan**. Vérifiez-les avant de
> réutiliser un profil. Pendant les essais, évitez les commandes destructrices,
> les mots de passe et les actions irréversibles.

## Si le suivi manque de précision

Si le suivi manque de précision, replacez les régions avec la caméra et
recalibrez après avoir déplacé la chaise ou la caméra. Vous pouvez éditer et
exporter un profil même si la caméra n'est pas accessible.

Ce parcours fonctionne sur Windows et Linux x64. La sortie Linux nécessite
X11/XTest et n'est pas disponible sous Wayland natif. Le Studio web affiche
uniquement les actions et ne commande pas les autres applications.
