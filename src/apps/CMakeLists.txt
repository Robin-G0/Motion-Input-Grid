if((MIG_BUILD_CONFIGURATOR OR MIG_BUILD_CONTROLLER) AND
   NOT EXISTS "${MIG_NATIVE_DEPS}/models/pose_landmarker_lite.task")
    message(FATAL_ERROR "Lite pose model missing: rerun tools/bootstrap/bootstrap-native.ps1")
endif()
enable_language(RC)
foreach(app IN ITEMS configurator controller)
    if(app STREQUAL "configurator")
        set(app_target motion-input-grid-studio)
        set(run_target run-motion-input-grid-studio)
    else()
        set(app_target motion-input-grid-controller)
        set(run_target run-motion-input-grid-controller)
    endif()
    string(TOUPPER "${app}" APP_UPPER)
    if(NOT MIG_BUILD_${APP_UPPER})
        continue()
    endif()
    set(app_sources main.cpp platform.cpp runtime.cpp capture.cpp inference.cpp
        keyboard.cpp controls.cpp theme.cpp scrollbars.cpp import_review.cpp)
    if(app STREQUAL "configurator")
        list(APPEND app_sources window.cpp renderer.cpp key_editor.cpp editor.cpp
            editor_navigation.cpp editor_settings.cpp editor_constraints.cpp editor_selection.cpp)
    else()
        list(APPEND app_sources controller_window.cpp controller_profiles.cpp controller_preview.cpp)
    endif()
    configure_file("${CMAKE_SOURCE_DIR}/assets/apps/icon.rc.in"
        "${CMAKE_CURRENT_BINARY_DIR}/${app_target}-icon.rc" @ONLY)
    add_executable(${app_target} WIN32 ${app_sources}
        "${CMAKE_CURRENT_BINARY_DIR}/${app_target}-icon.rc")
    if(app STREQUAL "configurator")
        target_compile_definitions(${app_target} PRIVATE MIG_CONFIGURATOR)
    endif()
    target_link_libraries(${app_target} PRIVATE mig-native mig-format comdlg32 gdi32 user32 dwmapi shell32 comctl32 uxtheme)
    if(app STREQUAL "controller")
        target_link_libraries(${app_target} PRIVATE mig-controller-profiles)
    endif()
    target_compile_options(${app_target} PRIVATE /W4 /utf-8)
    set_target_properties(${app_target} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
        RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
        RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin")
    add_custom_command(TARGET ${app_target} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${MIG_NATIVE_DEPS}/mediapipe-package/mediapipe/tasks/c/libmediapipe.dll"
            "$<TARGET_FILE_DIR:${app_target}>/libmediapipe.dll"
        COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:${app_target}>/models" "$<TARGET_FILE_DIR:${app_target}>/configs"
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${MIG_NATIVE_DEPS}/models/pose_landmarker_full.task" "$<TARGET_FILE_DIR:${app_target}>/models/pose_landmarker_full.task"
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${MIG_NATIVE_DEPS}/models/pose_landmarker_lite.task" "$<TARGET_FILE_DIR:${app_target}>/models/pose_landmarker_lite.task"
        COMMAND ${CMAKE_COMMAND} -E copy_if_different "${CMAKE_SOURCE_DIR}/configs/default.json" "$<TARGET_FILE_DIR:${app_target}>/configs/default.json")
    add_custom_target(${run_target}
        COMMAND "$<TARGET_FILE:${app_target}>"
        DEPENDS ${app_target} USES_TERMINAL)
    if(MIG_BUILD_HANDS)
        add_custom_command(TARGET ${app_target} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different "${MIG_NATIVE_DEPS}/models/hand_landmarker.task"
                "$<TARGET_FILE_DIR:${app_target}>/models/hand_landmarker.task")
    endif()
    if(MIG_INSTALL)
        install(TARGETS ${app_target} RUNTIME DESTINATION bin)
    endif()
endforeach()
if(MIG_INSTALL)
    if(MIG_BUILD_HANDS)
        install(FILES "${MIG_NATIVE_DEPS}/models/hand_landmarker.task" DESTINATION bin/models)
    endif()
    install(FILES "${MIG_NATIVE_DEPS}/mediapipe-package/mediapipe/tasks/c/libmediapipe.dll" DESTINATION bin)
    install(FILES "${MIG_NATIVE_DEPS}/models/pose_landmarker_full.task" DESTINATION bin/models)
    install(FILES "${MIG_NATIVE_DEPS}/models/pose_landmarker_lite.task" DESTINATION bin/models)
    install(FILES "${CMAKE_SOURCE_DIR}/configs/default.json" DESTINATION bin/configs)
    install(FILES "${MIG_NATIVE_DEPS}/mediapipe-package/mediapipe-0.10.35.dist-info/licenses/LICENSE"
        DESTINATION share/mig/licenses RENAME MediaPipe-LICENSE)
    install(FILES "${MIG_NATIVE_DEPS}/nlohmann-LICENSE" DESTINATION share/mig/licenses)
endif()
