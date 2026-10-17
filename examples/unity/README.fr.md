# Tutoriel d’entrée Unity desktop

[English](README.md) | [Français](README.fr.md)

**Télécharger le projet :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-examples).

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

1. Extrayez `*-unity-standalone` pour votre plateforme.
2. Ajoutez `package.json` via Package Manager → **Add package from disk**.
   Ajoutez **MigRaisedHands** à un GameObject, activez **UseSyntheticDemo**, puis Play.
3. Observez `left_raise` et `right_raise` dans le panneau ; connectez le signal
   au jeu. Désactivez le mode synthétique pour un fournisseur réel.

Éditeur Unity et projet desktop Windows/Linux x64. La création du projet et
l’installation peuvent dépasser une minute. Aucun estimateur caméra fourni ; la démo synthétique ne nécessite pas de caméra.

## Organisation du dossier

| Fichier/dossier | Rôle |
| --- | --- |
| `MigInput.cs` | Propriétaire du tracker, profil, images, actions et nettoyage. |
| `MigRaisedHands.cs / MigProfileInput.cs` | Sélection du composant démo/import. |
| `Resources/MIG/raised-hands.json` | Profil des deux poignets chargé comme TextAsset. |
| `SyntheticFrames.cs` | Archive : fournisseur synthétique sans caméra. |
| `MIG.Examples.asmdef` | Assembly des exemples référençant celui du binding. |
| `package.json` | Descripteur UPM ; aucune seconde dépendance UPM dans l’archive autonome. |
| `Runtime/` | Archive : assembly MIG.Runtime, bridge géré et plugins natifs filtrés. |
| `licenses/`, `LICENSE`, `manifest.json` | Notices et sommes de contrôle de l’archive. |

## Parcours du code

1. `MigInput.cs` → `OnEnable()` : initialise le propriétaire MIG et charge/valide la configuration locale.
2. `MigInput.cs` → `Update()` : fournit éventuellement les observations synthétiques, séquence et temps croissants.
3. `MigInput.cs` → `SubmitFrame(packet)` : soumet chaque nouvelle observation une seule fois à MIG et récupère les actions.
4. `MigInput.cs` → `HandleAction()` : transmet les chaînes action/identifiant copiées au jeu et actualise le panneau.
5. `MigInput.cs` → `ImportProfile(path)` : valide un JSON avant remplacement ; un échec conserve les anciennes règles.
6. `MigInput.cs` → `OnDisable()` : libère le tracker et ses ressources avant la destruction du composant/nœud.

## Dépendances et placement des ressources

Les bibliothèques natives, profil, bridge et licences sont fournis dans l’archive
individuelle ; l’éditeur et ses outils sont externes. Aucun modèle MediaPipe n’est
nécessaire pour reconnaître des positions fournies. Le fournisseur caméra réel
est facultatif et appelle SubmitFrame() sur le thread principal du jeu.

Conservez `Runtime/Plugins/<platform>/` et ses filtres d’import, ainsi que
`Runtime/Bridge/MigTracker.cs`. L’assembly `MIG.Examples` référence `MIG.Runtime`.
Le paquet autonome n’a pas besoin d’un second UPM. Cibles : Windows/Linux x64 ;
mobile/WebGL ne sont pas validés. `TryCoordinate()` fournit des mètres, Y vers le
haut, relatifs aux hanches ; une observation monde absente ne déplace pas l’objet.

## Sources hors du dépôt

Pour les sources seules, installez le paquet UPM runtime correspondant, puis
copiez `SyntheticFrames.cs` du binding géré dans ce dossier. Le descripteur source
déclare cette dépendance ; l’archive autonome la remplace par les fichiers locaux.
Profile accepte un TextAsset schema-v2 ; MigProfileInput démarre vide sinon.

## Réutilisation et dépannage

Étudiez `MigInput.cs` et le profil. Gardez le cycle de vie, remplacez
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
