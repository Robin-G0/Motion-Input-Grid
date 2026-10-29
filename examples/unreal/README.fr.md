# Tutoriel d’entrée Unreal 5 desktop

[English](README.md) | [Français](README.fr.md)

**Télécharger le projet :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-examples) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-examples).

## Ce que démontre cet exemple

Une action logique par poignet levé, un panneau de retour et un mode import JSON.
Les composants reçoivent des observations fournies. La démo synthétique vérifie
le câblage sans caméra et sans prétendre mesurer la précision. Ces intégrations
d’éditeur restent en preview.

> [!IMPORTANT]
> **Commencez en mode synthétique** pour voir `left_raise` et `right_raise` sans caméra.
> Pour jouer avec une webcam, fournissez ensuite les points du corps depuis votre propre
> estimateur. **Cette intégration est en preview** : vérifiez votre éditeur et vos exports.

## Démarrage rapide

1. Extrayez `*-unreal-standalone` pour votre plateforme.
2. Copiez ce dossier dans `YourProject/Plugins/MigExample` d’un projet Unreal C++.
   Régénérez les fichiers et compilez. Ajoutez **MigRaisedHandsComponent** à un acteur,
   activez **UseSyntheticDemo**, puis Play.
3. Observez `left_raise` et `right_raise` dans le panneau ; connectez le signal
   au jeu. Désactivez le mode synthétique pour un fournisseur réel.

Éditeur Unreal 5 desktop et compilateur C++, Windows/Linux. Installation du
projet et compilation dépassent une minute. La démo synthétique émet deux actions
sans caméra ; aucun fournisseur caméra n’est inclus.

## Organisation du dossier

| Fichier/dossier | Rôle |
| --- | --- |
| `MigExample.uplugin` | Descripteur du plugin. |
| `Source/MigExample/Public/MigInputComponent.h` | API des paquets, événement Blueprint OnMotion et mode synthétique. |
| `Source/MigExample/Private/MigInputComponent.cpp` | Intégration directe de l’ABI C et cycle de vie. |
| `Source/MigExample/Public/MigRaisedHandsComponent.h / MigProfileInputComponent.h` | Sélection du mode initial. |
| `Source/MigExample/Private/MigExamplePanel.cpp` | Retour UMG, chemin du fichier et bouton d’import. |
| `Source/MigExample/MigExample.Build.cs` | Liaison et placement de la bibliothèque native et du JSON libre. |
| `Content/raised-hands.json` | Profil des deux poignets, fourni en NonUFS. |
| `ThirdParty/` | Archive : en-têtes ABI C et bibliothèques de la plateforme. |
| `licenses/`, `LICENSE`, `manifest.json` | Notices et sommes de contrôle de l’archive. |

## Parcours du code

1. `Source/MigExample/Private/MigInputComponent.cpp` → `BeginPlay()` : initialise le propriétaire MIG et charge/valide la configuration locale.
2. `Source/MigExample/Private/MigInputComponent.cpp` → `TickComponent()` : fournit éventuellement les observations synthétiques, séquence et temps croissants.
3. `Source/MigExample/Private/MigInputComponent.cpp` → `SubmitFrame(Packet)` : soumet chaque nouvelle observation une seule fois à MIG et récupère les actions.
4. `Source/MigExample/Private/MigInputComponent.cpp` → `OnMotion.Broadcast()` : transmet les chaînes action/identifiant copiées au jeu et actualise le panneau.
5. `Source/MigExample/Private/MigInputComponent.cpp` → `ImportProfile(Path)` : valide un JSON avant remplacement ; un échec conserve les anciennes règles.
6. `Source/MigExample/Private/MigInputComponent.cpp` → `EndPlay()` : libère le tracker et ses ressources avant la destruction du composant/nœud.

## Dépendances et placement des ressources

Les bibliothèques natives, profil, bridge et licences sont fournis dans l’archive
individuelle ; l’éditeur et ses outils sont externes. Aucun modèle MediaPipe n’est
nécessaire pour reconnaître des positions fournies. Le fournisseur caméra réel
est facultatif et appelle SubmitFrame() sur le thread principal du jeu.

Conservez `ThirdParty/include/mig/c/api.h`, `lib/mig-c.lib` et `bin/mig-c.dll`
sous Windows, ou `lib/libmig-c.so.1` sous Linux. Build.cs place la bibliothèque
auprès du jeu et le JSON en fichier libre NonUFS, requis par FFileHelper.
Aucun plugin MIGRuntime séparé n’est requis. `mig_coordinate()` et `mig_active()`
permettent des commandes continues ; convertissez les mètres en centimètres
(×100) et adaptez explicitement les axes à votre caméra.

## Sources hors du dépôt

Pour les sources seules, installez le SDK ABI MIG dans `ThirdParty/` (include,
lib, et bin sous Windows), puis régénérez/compilez. Aucun chemin parent caché.
MigProfileInputComponent importe un profil via chemin absolu dans son panneau ou
la fonction Blueprint ImportProfile(Path). Connectez OnMotion aux commandes du jeu.

## Réutilisation et dépannage

Étudiez `Source/MigExample/Private/MigInputComponent.cpp` et le profil. Gardez le cycle de vie, remplacez
le callback/signal par vos commandes. Panneau et déplacement sont illustratifs.
Fournissez anatomie MediaPipe non miroir, aspect original, temps monotone et
séquence croissante. Envoyez des observations absentes en cas de perte de suivi.
Ne réutilisez jamais un tracker fermé. Les actions n’injectent pas de touches système.

- Bibliothèque absente : conservez le placement et l’architecture documentés.
- Import refusé : corrigez l’erreur ; les règles précédentes restent actives.
- Aucune action : calibrez les deux épaules, commencez dans Required puis passez
  dans Trigger. Une pose Trigger isolée ne déclenche rien ; au-delà de 180 ms entre
  images, profilez le matériel. Le mode synthétique illustre le profil de démo.
- Le profil contient deux chemins larges Required/Trigger. Un import valide
  recommence la calibration et vide la progression précédente.
- Le premier build/export peut dépasser une minute. Validez exports preview et
  fournisseurs caméra sur votre éditeur/plateforme.

[Référence configuration](../../docs/reference/configuration.fr.md).
