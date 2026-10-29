# Tutoriel d’entrée Godot 4 .NET

[English](README.md) | [Français](README.fr.md)

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

1. Extrayez `*-godot-csharp-standalone` pour votre plateforme.
2. Importez `project.godot` dans Godot 4.4 .NET, compilez le projet C#, puis Run.
   `raised_hands.tscn` active déjà **UseSyntheticDemo** ; `profile.tscn` permet les imports.
3. Observez `left_raise` et `right_raise` dans le panneau ; connectez le signal
   au jeu. Désactivez le mode synthétique pour un fournisseur réel.

Éditeur Godot 4.4 .NET desktop, SDK .NET 8 et bibliothèque Windows/Linux x64
correspondante. Le premier restore/build ou l’installation dépassent parfois une minute.
Aucun fournisseur caméra fourni ; la démo utilise des observations synthétiques.

## Organisation du dossier

| Fichier/dossier | Rôle |
| --- | --- |
| `project.godot / MigExample.csproj` | Projet Godot complet et version de compilation .NET fixée. |
| `raised_hands.tscn / profile.tscn` | Scènes de démo synthétique et de profil arbitraire. |
| `MigInput.cs` | Cycle de vie du tracker, résolution native, paquets et signaux. |
| `MigRaisedHands.cs / MigProfileInput.cs` | Sélection du mode initial. |
| `raised-hands.json` | Profil local schema-v2 des deux poignets. |
| `MigTracker.cs / SyntheticFrames.cs` | Archive : bridge géré et fournisseur synthétique sans caméra. |
| `mig-c.dll / libmig-c.so` | Archive : bibliothèque ABI C libre à la racine du projet. |
| `licenses/`, `LICENSE`, `manifest.json` | Notices et sommes de contrôle de l’archive. |

## Parcours du code

1. `MigInput.cs` → `_Ready()` : initialise le propriétaire MIG et charge/valide la configuration locale.
2. `MigInput.cs` → `_Process()` : fournit éventuellement les observations synthétiques, séquence et temps croissants.
3. `MigInput.cs` → `SubmitFrame(packet)` : soumet chaque nouvelle observation une seule fois à MIG et récupère les actions.
4. `MigInput.cs` → `HandleAction()` : transmet les chaînes action/identifiant copiées au jeu et actualise le panneau.
5. `MigInput.cs` → `ImportProfile(path)` : valide un JSON avant remplacement ; un échec conserve les anciennes règles.
6. `MigInput.cs` → `_ExitTree()` : libère le tracker et ses ressources avant la destruction du composant/nœud.

## Dépendances et placement des ressources

Les bibliothèques natives, profil, bridge et licences sont fournis dans l’archive
individuelle ; l’éditeur et ses outils sont externes. Aucun modèle MediaPipe n’est
nécessaire pour reconnaître des positions fournies. Le fournisseur caméra réel
est facultatif et appelle SubmitFrame() sur le thread principal du jeu.

`mig-c.dll` / `libmig-c.so` reste un fichier libre à la racine du projet.
`InitializeNativeLibrary()` résout ce chemin via ProjectSettings.GlobalizePath ;
le dossier de l’assembly généré et le dossier courant ne sont pas utilisés.
Gardez aussi ce fichier libre lors de l’export, hors PCK. Les coordonnées monde
sont en mètres, Y vers le haut ; Z est adapté à Godot et une absence ne déplace rien.

## Sources hors du dépôt

Pour les sources seules, copiez `MigTracker.cs`, `SyntheticFrames.cs` du binding
géré et la bibliothèque ABI correspondante à la racine. L’archive les fournit.
Compilez dans Godot ou avec `dotnet build MigExample.csproj` ; NuGet restaure
Godot.NET.Sdk 4.4.1. ProfilePath précharge un profil du composant générique.
Cette preview cible desktop, pas les exports mobiles/navigateurs.

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

[Référence configuration](../../../docs/reference/configuration.fr.md).
