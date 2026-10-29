# Package Unity UPM Motion Input Grid (MIG)

[English](README.md) | [Français](README.fr.md)

**Télécharger l’intégration :** [Windows x64 (tgz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-integration) · [Linux x64 (tgz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-integration).

> [!IMPORTANT]
> **Package runtime en preview, sans fournisseur caméra.** Pour un premier essai,
> préférez les [démos Unity](../../examples/unity/README.fr.md) et leur mode synthétique.
> Validez votre éditeur, le fournisseur réel et les exports : [matrice de support](../../docs/reference/support.fr.md).

Utilisez Unity 2021.3+ sur Windows/Linux x64. Dans Package Manager, choisissez
**Add package from tarball** puis le fichier `motion-input-grid-<version>-<plateforme>-unity.tgz`
adapté. Il contient le pont .NET existant `MotionInputGrid.MigTracker` dans
l'assembly `MIG.Runtime`, un plugin natif limité à sa plateforme et les licences
Apache/MIT. Windows nécessite le runtime VC++ correspondant.

L'identifiant UPM est `com.robin-g0.motion-input-grid`.

```csharp
using MotionInputGrid;

using var tracker = new MigTracker(profileJson);
var packet = MigTracker.Packet.Empty();
// Remplir les points anatomiques avec votre estimateur.
tracker.Update(ref packet, (action, inputId) => Debug.Log(action));
```

Conservez le tracker entre les images, réutilisez les tableaux du paquet et faites
progresser timestamps/séquences. Libérez-le dans `OnDisable` ou le nettoyage de
son propriétaire. Le pont expose `ImportJson`, `Active`, `Reset` et
`TryCoordinate` avec buffer réutilisable. Le moteur C++ assure la reconnaissance.
Le package runtime ne contient ni estimateur caméra, ni HUD, ni reconnaissance
synthétique.

La source canonique reste `bindings/dotnet/MigTracker.cs` ; le générateur la copie
dans le package. Aucun second pont n'est maintenu ici. Les
[démos Unity](../../examples/unity/README.fr.md) restent séparées.

[Distribution](../../docs/getting-started/packages.fr.md) · [ABI C](../../docs/reference/c-abi.fr.md).
