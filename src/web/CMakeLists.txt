add_executable(mig-web bindings.cpp)
target_link_libraries(mig-web PRIVATE mig-core mig-format mig-hands)
target_compile_options(mig-web PRIVATE -fexceptions)
target_compile_options(mig-core PRIVATE -fexceptions)
target_compile_options(mig-format PRIVATE -fexceptions)
target_link_options(mig-web PRIVATE --bind -fexceptions
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createMIG
    -sALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web,node -sDISABLE_EXCEPTION_CATCHING=0
    # Static embind invokers: no eval/new Function, so extension and strict-CSP
    # pages can load the published runtime unchanged.
    -sDYNAMIC_EXECUTION=0)
set_target_properties(mig-web PROPERTIES OUTPUT_NAME mig SUFFIX .mjs
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/web")
if(MIG_INSTALL)
    install(FILES "${CMAKE_BINARY_DIR}/web/mig.mjs" "${CMAKE_BINARY_DIR}/web/mig.wasm"
        DESTINATION web)
endif()
