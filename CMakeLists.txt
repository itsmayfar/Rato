cmake_minimum_required(VERSION 3.22)

project(RATO VERSION 1.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Universal binary (Apple Silicon + Intel) and the oldest macOS we support
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")

# JUCE: use a local checkout if given (-DJUCE_DIR=...), otherwise download it
if(DEFINED JUCE_DIR AND EXISTS "${JUCE_DIR}/CMakeLists.txt")
    add_subdirectory("${JUCE_DIR}" JUCE)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 8.0.4
        GIT_SHALLOW ON)
    FetchContent_MakeAvailable(JUCE)
endif()

if(APPLE)
    set(RATO_FORMATS AU VST3 Standalone)
else()
    set(RATO_FORMATS VST3 Standalone)
endif()

juce_add_plugin(RATO
    COMPANY_NAME "MAYFAR"
    COMPANY_WEBSITE "https://github.com/itsmayfar/Rato"
    BUNDLE_ID "com.mayfar.rato"
    PRODUCT_NAME "RATO"
    PLUGIN_MANUFACTURER_CODE Myfr
    PLUGIN_CODE Rato
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES Instrument Synth
    AU_MAIN_TYPE kAudioUnitType_MusicDevice
    FORMATS ${RATO_FORMATS})

file(GLOB RATO_FONTS "${CMAKE_CURRENT_SOURCE_DIR}/Resources/*.ttf")

juce_add_binary_data(RATOData SOURCES
    Resources/presets.json
    Resources/mayfar_logo.png
    ${RATO_FONTS})

target_sources(RATO PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/SynthVoice.cpp
    Source/PresetManager.cpp)

target_include_directories(RATO PRIVATE Source)

target_compile_definitions(RATO PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(RATO
    PRIVATE
        RATOData
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)
