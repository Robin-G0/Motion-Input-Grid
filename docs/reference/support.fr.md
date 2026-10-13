# Support et maturité

[English](support.md) | [Français](support.fr.md)

Cette page est la matrice canonique de MIG 1.0.2, schéma JSON 2 et C ABI 1.
La maturité concerne les interfaces, pas la précision d’une webcam. Les tests
synthétiques et les images vides ne prouvent pas une compatibilité matérielle.

Sur Debian, MIG Studio, MIG Input et certains exemples natifs sont encore
en cours de développement et de test et peuvent ne pas fonctionner entièrement.
Les vérifications ci-dessous couvrent uniquement les cas indiqués. Le package
Debian `.deb` fournit le SDK et l'ABI C, pas ces applications de bureau.

| Composant | Maturité | Preuves | Cibles | Périmètre / limite |
| --- | --- | --- | --- | --- |
| Moteur / SDK C++ | Stable | Tested | Windows x64, Linux x64/ARM64 | CTest, consommateur CMake installé ; ARM64 émulé |
| C ABI 1 / schéma 2 | Stable | Tested | Mêmes SDK | Layout des paquets, imports stricts, reconnaissance et cycle de vie |
| Python ctypes | Beta | Tested | Windows x64, Linux x64/ARM64 | Wheels autonomes installées ; Linux glibc 2.35+ |
| JavaScript / WASM | Beta | Tested | Navigateurs de bureau modernes | Installation npm, vrai WASM et tests navigateur/cycle de vie synthétiques |
| Binding .NET | Beta | Tested | Windows/Linux x64 | Pont géré et C ABI extraite ; tests éditeur séparés |
| vcpkg | Beta | Tested | Windows/Linux x64 | Installation de l'overlay généré et consommateur externe |
| Debian / outils APT | Beta | Tested | amd64 ; package arm64 généré | Installation amd64 ; dépôt signé de test et téléchargement |
| Capture / applications natives | Beta | Tested | Windows/Linux x64 | Images vides et tests UI/synthétiques ; caméra/clavier réels non testés |
| Add-on Godot | Preview | Tested | Godot 4.3, Windows x64, Linux x64/ARM64 | Import en projet neuf et cycle de vie GDScript ; exports de jeux non validés |
| UPM Unity | Preview | Untested en éditeur | Windows/Linux x64 | Payload natif/.NET testé ; builds éditeur/player non exécutés |
| Plugin Unreal | Preview | Untested en éditeur | Payloads Windows x64, Linux x64/ARM64 | Payload C ABI testé ; compilation module/jeu non exécutés |
| Structure visage | Experimental | Untested | Sources portables | Aucun estimateur visage ni produit de reconnaissance supporté |
| Caméras, touches OS, ARM64 physique | — | Untested | Selon cible | Tests matériels/manuels nécessaires |
| macOS, plugins mobiles | Planned | Untested | Aucun binaire distribué | Aucun support déclaré |

## Définitions

- **Stable** : contrats publics couverts par tests de régression et consommateurs installés.
- **Beta** : interface utilisable, validations automatisées, vérifications de déploiement restantes.
- **Preview** : intégration à évaluer ; versions d’éditeur, exports et installations
  doivent être testés plus largement avant stabilisation.
- **Experimental** : fonctionnalité incomplète ou exploratoire sans garantie de support.
- **Tested** : la vérification indiquée a réellement été exécutée dans son environnement.
- **Untested** : la vérification concernée n’a pas été exécutée.
- **Expected to work** : compatibilité supposée, distincte d’une preuve de test.
- **Planned** : support non livré ; la roadmap n’est pas une promesse.

Windows natif nécessite un runtime Visual C++ compatible. Linux cible glibc 2.35+ ;
les touches natives utilisent X11/XTest, pas l’injection Wayland. L’estimateur
MediaPipe fourni cible x64. Le SDK ARM64 reçoit les landmarks de l’application ;
aucun runtime caméra Linux ARM64 ni binaire Windows ARM64 n’est fourni. Les paquets
éditeur ne contiennent pas de fournisseur caméra.

Voir le [démarrage](../getting-started/bootstrap.fr.md), l’[architecture](../architecture/overview.fr.md)
et le [contenu des paquets](../getting-started/packages.fr.md). Les validations
matérielles doivent couvrir webcams intégrées/USB, résolutions et cadences,
CPU/GPU, démarrage/arrêt, observations périmées/perdues et relâchement des touches.
