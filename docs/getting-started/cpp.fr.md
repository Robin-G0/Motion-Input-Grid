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

**Télécharger le SDK :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-cpp-sdk) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-cpp-sdk) · [Linux ARM64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-cpp-sdk).

Extrayez entièrement le paquet de votre système.
Choisissez votre système et architecture. Windows demande un toolset MSVC
compatible ; les SDK Linux publiés ciblent glibc 2.35+ et GCC 11+.

Le préfixe d'installation est le dossier contenant `include/` et `lib/`, avec
`lib/cmake/MIG/MIGConfig.cmake` en dessous. Les archives d'applications natives
contiennent aussi un SDK dans `sdk/`. Passez ce préfixe à `CMAKE_PREFIX_PATH`,
plutôt que le fichier archive ou le dossier des sources du dépôt.

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

Pour générer explicitement des Makefiles sous Linux, utilisez un dossier distinct :

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

Si CMake ne trouve pas MIG, localisez `MIGConfig.cmake` et vérifiez le préfixe.
Vous pouvez aussi passer `-DMIG_DIR=/chemin/sdk/lib/cmake/MIG`. Une cible absente
signifie que le SDK choisi n'inclut pas cette fonctionnalité. Une erreur MediaPipe
pendant la compilation signifie que vous avez sélectionné une configuration
application/caméra plutôt que `sdk-release`.
