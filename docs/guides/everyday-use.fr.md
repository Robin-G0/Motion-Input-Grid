# Utiliser MIG au quotidien

[English](everyday-use.md) | [Français](everyday-use.fr.md)

**Télécharger Studio + Controller :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Associez un mouvement volontaire à un raccourci connu de l'application au premier
plan. Commencez sur un document jetable avec une action facile à annuler.

1. Créez un mouvement dans le [Studio web](studio-web.fr.md) ou le
   [Studio de bureau](configurator.fr.md). Nommez-le **Copier la sélection**, avec
   l'action `copy_selection`. Dessinez 🟩 **Required** au repos du poignet et
   🟨 **Trigger** dans une position que votre frappe normale n'atteint pas.
2. Dans les réglages du mouvement du Studio de bureau, associez **Ctrl + C** en
   **Single press**. Sinon, ouvrez **JSON** dans le Studio web et ajoutez ces
   champs à l'objet du mouvement dans `inputs`, en conservant les autres champs :

   ```json
   "keyboard": [{"keys": [17, 67]}],
   "action_mode": "single_press",
   "cooldown_ms": 700
   ```

   Appliquez puis exportez le profil. Consultez la
   [référence clavier](../reference/configuration.fr.md) pour d'autres raccourcis.
3. Arrêtez la caméra de l'éditeur et importez le JSON dans le
   [Controller](controller.fr.md). Démarrez le suivi, calibrez et vérifiez le
   mouvement avec la sortie clavier désactivée.
4. Activez la sortie. Dans un éditeur de texte, sélectionnez du texte d'essai et
   effectuez le mouvement. Collez manuellement pour vérifier ce qui a été copié.
5. Revenez au repos avant de recommencer. Désactivez la sortie ou arrêtez le suivi
   lorsque vous quittez l'application cible.

Les raccourcis vont à l'application qui a le focus ; MIG ne choisit pas sa fenêtre.
Vérifiez les raccourcis avant de réutiliser un profil. Évitez les commandes
destructrices, les mots de passe et les actions irréversibles pendant les essais.
Si le suivi manque de précision, replacez les régions avec la caméra et
recalibrez après avoir déplacé la chaise ou la caméra. Vous pouvez éditer et
exporter un profil même si la caméra n'est pas accessible.

Ce parcours fonctionne sur Windows et Linux x64. La sortie Linux nécessite
X11/XTest et n'est pas disponible sous Wayland natif. Le Studio web affiche
uniquement les actions et ne commande pas les autres applications.
