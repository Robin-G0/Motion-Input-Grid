cmake_minimum_required(VERSION 3.25)

include(cmake/MIGVersion.cmake)
project(MotionInputGrid VERSION ${MIG_VERSION} LANGUAGES CXX)

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

option(MIG_BUILD_FACE "Build the optional face-landmark add-on." ON)
option(MIG_BUILD_HANDS "Build the optional hand/finger-sign add-on." ON)
option(MIG_BUILD_FORMAT "Build the JSON motion-format library." ON)
option(MIG_BUILD_CONFIGURATOR "Build MIG Studio, the native profile editor (Win32 or Linux Qt6)." ON)
option(MIG_BUILD_CONTROLLER "Build MIG Input, the native profile runner (Win32 or Linux Qt6)." ON)
option(MIG_BUILD_C_API "Build the shared C ABI for Python and game engines." ${MIG_BUILD_FORMAT})
option(MIG_BUILD_TESTS "Build deterministic engine tests." ON)
option(MIG_BUILD_BENCHMARKS "Build synthetic engine microbenchmarks (not inference benchmarks)." OFF)
option(MIG_ENABLE_ASAN "Instrument first-party code with AddressSanitizer." OFF)
option(MIG_INSTALL "Generate install rules and a CMake package." ON)
option(MIG_BUILD_NATIVE_RUNTIME "Export the native camera/MediaPipe adapter without requiring an app." OFF)
option(MIG_BUILD_WEB "Build the Emscripten JavaScript/WebAssembly integration." OFF)
option(MIG_PACKAGE_SDK "Generate a Debian package for the positions-only SDK." OFF)
if(MIG_BUILD_TESTS)
    enable_testing()
endif()

set(MIG_DEPENDENCY_MODE "AUTO" CACHE STRING
        "How CMake resolves dependencies: AUTO, VCPKG, SYSTEM, or FETCH.")
set_property(CACHE MIG_DEPENDENCY_MODE PROPERTY STRINGS AUTO VCPKG SYSTEM FETCH)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

if(MSVC)
    add_compile_options(/W4 /utf-8 /permissive-)
endif()
if(MIG_ENABLE_ASAN)
    if(MSVC)
        add_compile_options(/fsanitize=address /Zi)
        add_link_options(/INCREMENTAL:NO)
    else()
        add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer)
        add_link_options(-fsanitize=address,undefined)
    endif()
endif()

include(cmake/MIGDependencies.cmake)

if(WIN32 OR EMSCRIPTEN)
    set(MIG_DEFAULT_NATIVE_DEPS "${CMAKE_SOURCE_DIR}/build/native-deps")
else()
    set(MIG_DEFAULT_NATIVE_DEPS "${CMAKE_SOURCE_DIR}/build/native-linux-deps")
endif()
set(MIG_NATIVE_DEPS "${MIG_DEFAULT_NATIVE_DEPS}" CACHE PATH "Downloaded native MediaPipe headers, library and models")
if(NOT EMSCRIPTEN AND (MIG_BUILD_NATIVE_RUNTIME OR MIG_BUILD_CONFIGURATOR OR MIG_BUILD_CONTROLLER))
    if(NOT EXISTS "${MIG_NATIVE_DEPS}/include/mediapipe/tasks/c/vision/pose_landmarker/pose_landmarker.h")
        message(FATAL_ERROR "Bootstrap native artifacts first: tools/bootstrap/bootstrap-native.ps1 on Windows, tools/bootstrap/bootstrap-native-linux.py on Linux")
    endif()
    if((MIG_BUILD_CONFIGURATOR OR MIG_BUILD_CONTROLLER) AND NOT MIG_BUILD_FORMAT)
        message(FATAL_ERROR "Native applications require MIG_BUILD_FORMAT=ON")
    endif()
endif()

add_subdirectory(src/core)
set(MIG_INSTALLABLE_TARGETS mig-core)

if(MIG_BUILD_FORMAT)
    mig_require_nlohmann_json()
    add_subdirectory(src/format)
    if(NOT EMSCRIPTEN AND (MIG_BUILD_CONTROLLER OR MIG_BUILD_TESTS))
        add_subdirectory(src/controller)
    endif()
    list(APPEND MIG_INSTALLABLE_TARGETS mig-format)
endif()

if(MIG_BUILD_FACE)
    add_subdirectory(src/face)
    list(APPEND MIG_INSTALLABLE_TARGETS mig-face)
endif()

if(MIG_BUILD_HANDS)
    add_subdirectory(src/hands)
    list(APPEND MIG_INSTALLABLE_TARGETS mig-hands)
endif()

if(NOT EMSCRIPTEN AND (MIG_BUILD_NATIVE_RUNTIME OR MIG_BUILD_CONFIGURATOR OR MIG_BUILD_CONTROLLER))
    add_subdirectory(src/native)
    list(APPEND MIG_INSTALLABLE_TARGETS mig-native)
    if(WIN32)
        add_subdirectory(src/apps)
    elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND (MIG_BUILD_CONFIGURATOR OR MIG_BUILD_CONTROLLER))
        add_subdirectory(src/linux-apps)
    endif()
endif()
if(MIG_BUILD_C_API AND NOT EMSCRIPTEN)
    if(NOT MIG_BUILD_FORMAT)
        message(FATAL_ERROR "MIG_BUILD_C_API requires MIG_BUILD_FORMAT=ON")
    endif()
    add_subdirectory(src/c-api)
    list(APPEND MIG_INSTALLABLE_TARGETS mig-c)
endif()
if(MIG_BUILD_WEB)
    if(NOT EMSCRIPTEN OR NOT MIG_BUILD_FORMAT OR NOT MIG_BUILD_HANDS)
        message(FATAL_ERROR "MIG_BUILD_WEB requires Emscripten, MIG_BUILD_FORMAT and MIG_BUILD_HANDS")
    endif()
    add_subdirectory(src/web)
endif()

if(MIG_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

if(MIG_INSTALL)
    set(MIG_JSON_LICENSE "${MIG_NATIVE_DEPS}/nlohmann-LICENSE" CACHE FILEPATH "JSON dependency license")
    install(FILES LICENSE DESTINATION "${CMAKE_INSTALL_DATADIR}/licenses/mig")
    if(EXISTS "${MIG_JSON_LICENSE}" AND MIG_BUILD_FORMAT)
        install(FILES "${MIG_JSON_LICENSE}" RENAME nlohmann-LICENSE
            DESTINATION "${CMAKE_INSTALL_DATADIR}/licenses/mig")
    endif()
    install(TARGETS ${MIG_INSTALLABLE_TARGETS}
        EXPORT MIGTargets
        ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
        LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}"
        RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}"
        INCLUDES DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}")

    install(EXPORT MIGTargets
        FILE MIGTargets.cmake
        NAMESPACE MIG::
        DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/MIG")

    configure_package_config_file(
        cmake/MIGConfig.cmake.in
        "${CMAKE_CURRENT_BINARY_DIR}/MIGConfig.cmake"
        INSTALL_DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/MIG")
    write_basic_package_version_file(
        "${CMAKE_CURRENT_BINARY_DIR}/MIGConfigVersion.cmake"
        VERSION "${PROJECT_VERSION}"
        COMPATIBILITY SameMajorVersion)
    install(FILES
        "${CMAKE_CURRENT_BINARY_DIR}/MIGConfig.cmake"
        "${CMAKE_CURRENT_BINARY_DIR}/MIGConfigVersion.cmake"
        DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/MIG")
endif()

if(MIG_PACKAGE_SDK)
    include(cmake/MIGPackaging.cmake)
endif()
