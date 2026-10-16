# Add-on Godot Motion Input Grid (MIG)

[English](README.md) | [Français](README.fr.md)

**Télécharger l’intégration :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-integration) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-integration) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-integration).

> [!IMPORTANT]
> **Package runtime en preview, sans fournisseur caméra.** Pour un premier essai,
> préférez les [démos Godot](../../examples/godot/README.fr.md) et leur mode synthétique.
> Validez votre éditeur, le fournisseur réel et les exports : [matrice de support](../../docs/reference/support.fr.md).

Extrayez le ZIP `motion-input-grid-<version>-<plateforme>-godot.zip` adapté à la racine d'un
projet Godot 4.3+. Il contient `addons/mig`, la GDExtension, la bibliothèque C ABI
et les licences. À l'export, gardez les bibliothèques natives hors du PCK.
L'add-on utilise les points fournis par votre estimateur ; il n'ouvre pas de caméra.

```gdscript
var tracker := MigTrackerNative.new()
tracker.open(FileAccess.get_file_as_string("res://profile.json"))
var events := tracker.update(timestamp_ms, sequence, aspect, body, hands, hand_count, world_mask)
for index in range(events):
    print(tracker.event_action(index), tracker.event_id(index))
tracker.close()
```

Réutilisez les buffers de 264 floats pour le corps et 252 pour les mains.
Sérialisez les appels sur le thread propriétaire, vérifiez les résultats négatifs
et `get_error()`, puis fermez le tracker à la sortie de son propriétaire.
Les coordonnées restent anatomiques, sans miroir. `active(index)`,
`coordinate(joint, system)`, `reset(recalibrate)` et `import_json(json)` utilisent
l'ABI C existante.

Compilez `native/` avec `GODOT_CPP_DIR` vers godot-cpp `godot-4.3-stable` et
`CMAKE_PREFIX_PATH` vers le SDK C ABI MIG adapté. Le dépôt complet permet aussi
de compiler le SDK comme dépendance. Les sources du pont vivent ici ; les projets
de démonstration restent dans [examples/godot](../../examples/godot/README.fr.md).

[Distribution](../../docs/getting-started/packages.fr.md) · [ABI C](../../docs/reference/c-abi.fr.md).
