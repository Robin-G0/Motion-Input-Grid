# Installer et utiliser le SDK C++

[English](cpp.md) | [Français](cpp.fr.md)

<details>
<summary>Dans cette page</summary>

- [Utiliser un SDK précompilé](#utiliser-un-sdk-précompilé)
- [Compiler et installer depuis les sources](#compiler-et-installer-depuis-les-sources)
- [Lier votre application](#lier-votre-application)
- [Alternatives et résolution des erreurs](#alternatives-et-résolution-des-erreurs)

</details>

Motion Input Grid (MIG) fournit un package CMake pour les applications C++20.
Utilisez un SDK installé ou compilez-le depuis les sources : les deux proposent
les mêmes cibles `MIG::`. La caméra reste séparée du SDK de positions.

## Utiliser un SDK précompilé

**Télécharger le SDK :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk) · [Linux ARM64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk).

Extrayez entièrement le paquet de votre système.
Choisissez votre système et architecture. Windows demande un toolset MSVC
compatible ; les SDK Linux publiés ciblent glibc 2.35+ et GCC 11+.

Repérez le **préfixe du SDK** dans l'archive extraite :

```text
sdk/                         <- CMAKE_PREFIX_PATH pointe ici
  include/
  lib/
    cmake/MIG/MIGConfig.cmake
```

Les archives d'applications natives contiennent aussi un SDK dans `sdk/`.

> [!TIP]
> **Une première action avant d'écrire votre application ?** Lancez le
> [tutoriel de positions](../../examples/sdk-consumer/README.fr.md). Il reconnaît
> une levée de main synthétique, sans caméra ni modèles de suivi.

## Compiler et installer depuis les sources

Installez CMake 3.25+ et un compilateur C++20. Sous Windows, installez Visual
Studio Build Tools avec le développement Desktop en C++. Sous Linux, installez
CMake, GCC et Ninja ou Make. Depuis la racine du dépôt complet :

```sh
cmake --preset sdk-release
cmake --build --preset sdk-release --parallel 2
ctest --preset sdk-release
cmake --install build/sdk-release --config Release --prefix install
```

Le SDK est maintenant dans `install/`. Utilisez son chemin absolu comme préfixe
pour votre application. Cette installation locale ne nécessite pas de droits
administrateur. La première configuration peut télécharger la dépendance JSON
épinglée. Le preset SDK désactive les applications et dépendances caméra : aucun
bootstrap MediaPipe n'est nécessaire. Pour compiler avec la caméra, suivez le
guide [Windows](windows.fr.md) ou [Linux](linux.fr.md).

<details>
<summary>Variante : générer des Makefiles GNU sous Linux</summary>

Utilisez un dossier distinct :

```sh
cmake -S . -B build/sdk-make -G "Unix Makefiles" \
    -DCMAKE_BUILD_TYPE=Release -DMIG_INSTALL=ON \
    -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
    -DMIG_BUILD_NATIVE_RUNTIME=OFF
cmake --build build/sdk-make --parallel 2
ctest --test-dir build/sdk-make --output-on-failure
cmake --install build/sdk-make --prefix install
```

`cmake --build` appelle Make pour ce générateur ; `make -C build/sdk-make -j2`
est équivalent. Le dépôt n'a pas de Makefile manuel à la racine. Ne changez pas
le générateur d'un dossier de build existant.

</details>

## Lier votre application

Dans le `CMakeLists.txt` de votre application :

```cmake
cmake_minimum_required(VERSION 3.25)
project(MyApplication LANGUAGES CXX)

find_package(MIG 1.0 CONFIG REQUIRED)

add_executable(my-application main.cpp)
target_link_libraries(my-application PRIVATE MIG::core MIG::format)
```

Configurez et compilez depuis le dossier de votre application :

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=/chemin/absolu/sdk
cmake --build build --config Release --parallel 2
```

Remplacez le préfixe par le SDK extrait ou votre dossier `install/`. Entourez de
guillemets les chemins contenant des espaces. Visual Studio place l'exécutable
dans `build/Release/` ; les générateurs à configuration unique le placent
généralement dans `build/`.

| Cible | Usage |
| --- | --- |
| `MIG::core` | Reconnaissance depuis les landmarks fournis |
| `MIG::format` | Lecture/écriture de profils JSON ; lie le moteur |
| `MIG::hands`, `MIG::face` | Helpers mains/visage optionnels si inclus dans le SDK |
| `MIG::c` | ABI C partagée pour les intégrations natives et bindings |
| `MIG::native` | Adaptateur caméra, uniquement dans les SDK avec caméra |

Les cibles fournissent les chemins d'inclusion et l'exigence C++20. Ne liez pas
manuellement la dépendance JSON. Faites correspondre architecture, compilateur,
runtime et configuration du SDK avec votre application. Les hôtes utilisant
l'ABI C partagée doivent aussi rendre sa DLL/SO accessible à l'exécution.

Pour un consommateur complet, configurez
[examples/sdk-consumer](../../examples/sdk-consumer/README.fr.md) avec le même
préfixe. Il fournit des observations synthétiques, sans caméra.
La [référence API](../reference/cpp.fr.md) décrit les frames et la reconnaissance.

## Alternatives et résolution des erreurs

Le package Debian local installe le SDK dans `/usr` ; CMake le trouve sans
préfixe personnalisé. vcpkg utilise l'overlay de release et son toolchain CMake.
Consultez la [distribution](packages.fr.md) et le
[port vcpkg](../../ports/motion-input-grid/README.fr.md).

| Symptôme | Vérification |
| --- | --- |
| CMake ne trouve pas MIG | Pointez `CMAKE_PREFIX_PATH` vers le préfixe ci-dessus, ou définissez `MIG_DIR=/chemin/sdk/lib/cmake/MIG`. |
| `MIG::native` est absent | Utilisez un SDK avec caméra ; le SDK de positions ne fournit pas cette cible. |
| MediaPipe est demandé pour compiler les seules positions | Choisissez `sdk-release`, sans applications ni caméra. |
| Erreur de liaison ou de chargement DLL/SO | Faites correspondre architecture, compilateur/runtime et configuration ; rendez les bibliothèques partagées accessibles à l'exécution. |
