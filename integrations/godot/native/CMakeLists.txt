cmake_minimum_required(VERSION 3.25)
project(MigGodot LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()
set(GODOT_CPP_DIR "" CACHE PATH "godot-cpp godot-4.3-stable checkout")
if(NOT EXISTS "${GODOT_CPP_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "Set GODOT_CPP_DIR to a godot-cpp godot-4.3-stable checkout.")
endif()
add_subdirectory("${GODOT_CPP_DIR}" godot-cpp)
if(MSVC)
    target_compile_options(godot-cpp PRIVATE /MP8)
endif()
find_package(MIG 1.1 CONFIG QUIET)
if(NOT TARGET MIG::c)
    get_filename_component(repository "${CMAKE_CURRENT_SOURCE_DIR}/../../.." ABSOLUTE)
    if(NOT EXISTS "${repository}/src/c-api/CMakeLists.txt")
        message(FATAL_ERROR "Install the MIG C API SDK or download the complete repository.")
    endif()
    set(MIG_BUILD_CONFIGURATOR OFF CACHE BOOL "" FORCE)
    set(MIG_BUILD_CONTROLLER OFF CACHE BOOL "" FORCE)
    set(MIG_BUILD_NATIVE_RUNTIME OFF CACHE BOOL "" FORCE)
    set(MIG_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(MIG_BUILD_C_API ON CACHE BOOL "" FORCE)
    set(MIG_INSTALL OFF CACHE BOOL "" FORCE)
    if(WIN32)
        set(MIG_NATIVE_DEPS "${repository}/build/native-deps" CACHE PATH "MIG dependencies")
    else()
        set(MIG_NATIVE_DEPS "${repository}/build/native-linux-deps" CACHE PATH "MIG dependencies")
    endif()
    add_subdirectory("${repository}" mig-repository)
endif()
add_library(mig-godot SHARED mig_tracker.cpp register_types.cpp)
target_link_libraries(mig-godot PRIVATE godot::cpp MIG::c)
set_target_properties(mig-godot PROPERTIES PREFIX "" BUILD_RPATH "$ORIGIN")
set(MIG_GODOT_PROJECT "${CMAKE_BINARY_DIR}/project" CACHE PATH "Staged Godot project")
set(MIG_GODOT_ADDON "${MIG_GODOT_PROJECT}/addons/mig")
add_custom_target(mig-godot-project ALL
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/../addons/mig" "${MIG_GODOT_ADDON}"
    COMMAND ${CMAKE_COMMAND} -E make_directory "${MIG_GODOT_ADDON}/bin"
    COMMAND ${CMAKE_COMMAND} -E copy "$<TARGET_FILE:mig-godot>" "${MIG_GODOT_ADDON}/bin/"
    COMMAND ${CMAKE_COMMAND} "-DMIG_C_LIBRARY=$<TARGET_FILE:MIG::c>"
        "-DDESTINATION=${MIG_GODOT_ADDON}/bin" "-DPROJECT=${MIG_GODOT_PROJECT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/stage_runtime.cmake"
    DEPENDS mig-godot)
if(MIG_GODOT_EXAMPLE_SOURCE)
    add_custom_command(TARGET mig-godot-project POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${MIG_GODOT_EXAMPLE_SOURCE}" "${MIG_GODOT_PROJECT}")
    find_program(GODOT_EXECUTABLE NAMES godot godot4)
    if(GODOT_EXECUTABLE)
        enable_testing()
        add_test(NAME godot-import COMMAND "${GODOT_EXECUTABLE}" --headless
            --path "${MIG_GODOT_PROJECT}" --editor --import)
        set_tests_properties(godot-import PROPERTIES FIXTURES_SETUP godot-project TIMEOUT 60
            FAIL_REGULAR_EXPRESSION "SCRIPT ERROR;GDScript bug;Failed to load script")
        add_test(NAME godot-gdscript COMMAND "${GODOT_EXECUTABLE}" --headless
            --path "${MIG_GODOT_PROJECT}" --script res://tests/regression.gd)
        set_tests_properties(godot-gdscript PROPERTIES FIXTURES_REQUIRED godot-project TIMEOUT 60)
    endif()
endif()
