#pragma once

#include "Params.h"
#include <juce_audio_processors/juce_audio_processors.h>

namespace rato
{
// Factory presets live in the embedded presets.json; user presets are XML files
// saved in ~/Music/RATO Presets.
class PresetManager
{
public:
    struct Preset
    {
        juce::String name, category;
        juce::var data;
    };

    explicit PresetManager (juce::AudioProcessorValueTreeState& state);

    int getNumPresets() const noexcept                    { return presets.size(); }
    const Preset& getPreset (int index) const             { return presets.getReference (index); }
    const juce::StringArray& getCategories() const noexcept { return categories; }

    int  getCurrentIndex() const noexcept                 { return currentIndex; }
    juce::String getCurrentName() const;
    juce::String getCurrentCategory() const;

    void loadPreset (int index);
    void next();
    void previous();

    static juce::File getUserPresetFolder();
    juce::Array<juce::File> getUserPresets() const;
    bool saveUserPreset (const juce::File& file);
    bool loadUserPreset (const juce::File& file);

    void setCurrentIndexSilently (int index)              { currentIndex = index; userPresetName.clear(); }
    juce::String getUserPresetName() const                { return userPresetName; }

    std::function<void()> onPresetChanged;

private:
    void setParam (const juce::String& id, float realValue);

    juce::AudioProcessorValueTreeState& apvts;
    juce::Array<Preset> presets;
    juce::StringArray categories;
    int currentIndex = 0;
    juce::String userPresetName;
};
} // namespace rato
