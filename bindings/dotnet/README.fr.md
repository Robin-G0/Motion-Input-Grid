# Pont C#

[English](README.md) | [Français](README.fr.md)

`MigTracker.cs` encapsule l'ABI 1 de `mig-c` pour Unity et Godot .NET.
Copiez-le dans le projet avec la bibliothèque native correspondant à l'éditeur
et à chaque architecture exportée. Le dépôt ne publie pas de paquet NuGet.

| Étape | API et contrat |
| --- | --- |
| Créer | Construire le tracker avec un JSON **schéma 2** |
| Alimenter | Réutiliser les tableaux de `MigTracker.Packet.Empty()` et soumettre les observations fraîches avec `Update(ref packet, callback)` |
| Réagir | Le callback reçoit des chaînes action/ID copiées |
| Lire une coordonnée | `TryCoordinate` demande un buffer d'au moins quatre floats et retourne fraîcheur/confiance |
| Importer | `ImportJson` valide avant remplacement et réinitialise la reconnaissance si l'import réussit |
| Fermer | Appeler `Dispose()` à la sortie/désactivation de la scène |

> [!IMPORTANT]
> **Un thread propriétaire par tracker.** Ne mettez jamais le même handle à jour simultanément.

Disposition des tableaux, espaces et durées de vie : [API C](../../docs/reference/c-abi.fr.md).
Commencez avec [Unity](../../examples/unity/README.fr.md) ou
[Godot](../../examples/godot/README.fr.md). Les deux variantes montrent import
et retour de levée de poignet ; hors simulation, un fournisseur d'observations
reste nécessaire.
