# Exemples desktop Godot 4

[English](README.md) | [Français](README.fr.md)

**Télécharger le projet :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-godot-gdscript-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-godot-gdscript-examples) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-godot-gdscript-examples).

**C# :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-godot-csharp-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-godot-csharp-examples).

Choisissez le dossier correspondant à votre projet :

- [GDScript](gdscript/README.fr.md) : éditeur standard, pont GDExtension natif,
  scènes prêtes à ouvrir pour levage des mains et import de profils.
- [C#](csharp/README.fr.md) : éditeur Godot .NET, pont .NET partagé et composants Node3D.

Les deux utilisent le moteur C++ de MIG via le même ABI C. Elles affichent les
actions, émettent des signaux et acceptent les observations de votre fournisseur
de points. Le mode synthétique montre le levage des poignets sans caméra.
Un import invalide conserve la configuration courante.

Windows et Linux desktop uniquement. Compilez les bibliothèques natives pour
l'architecture de votre éditeur/export. Aucun estimateur ni export web n'est fourni.

[Code](../../docs/getting-started/examples.fr.md) · [Démarrage](../../docs/getting-started/bootstrap.fr.md).

[Package runtime séparé](../../integrations/godot/README.fr.md).

Les archives `*-godot-gdscript-standalone` et `*-godot-csharp-standalone`
sont des projets complets avec leur bridge et ABI natif. Ouvrez leur README
et `project.godot` ; l’éditeur reste externe.
