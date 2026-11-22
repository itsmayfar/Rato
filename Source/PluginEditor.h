#pragma once

#include "PluginProcessor.h"
#include <juce_audio_utils/juce_audio_utils.h>

namespace rato::ui
{
namespace colour
{
    const juce::Colour bg       { 0xff0b0b0b };
    const juce::Colour panel    { 0xff161616 };
    const juce::Colour border   { 0xff2a2a2a };
    const juce::Colour ring     { 0xff3a3a3a };
    const juce::Colour knobFace { 0xff1c1c1c };
    const juce::Colour red      { 0xffe10600 };
    const juce::Colour white    { 0xffffffff };
    const juce::Colour text     { 0xffcfcfcf };
    const juce::Colour dim      { 0xff8a8a8a };
}

juce::Font scriptFont (float height);
juce::Font brandFont (float height);
juce::Font uiFont (float height, bool bold = false);

class LookAndFeel : public juce::LookAndFeel_V4
{
public:
    LookAndFeel();
    void drawRotarySlider (juce::Graphics&, int x, int y, int w, int h, float pos, float start, float end, juce::Slider&) override;
    void drawComboBox (juce::Graphics&, int w, int h, bool down, int bx, int by, int bw, int bh, juce::ComboBox&) override;
    juce::Font getComboBoxFont (juce::ComboBox&) override { return uiFont (12.0f); }
    void positionComboBoxText (juce::ComboBox&, juce::Label&) override;
    void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour&, bool over, bool down) override;
    juce::Font getTextButtonFont (juce::TextButton&, int) override { return uiFont (12.0f); }
    void drawToggleButton (juce::Graphics&, juce::ToggleButton&, bool over, bool down) override;
    void drawPopupMenuBackground (juce::Graphics&, int w, int h) override;
    juce::Font getPopupMenuFont() override { return uiFont (14.0f); }
    void drawBubble (juce::Graphics&, juce::BubbleComponent&, const juce::Point<float>&, const juce::Rectangle<float>&) override;
    juce::Font getSliderPopupFont (juce::Slider&) override { return uiFont (12.0f); }
};

// A rotary knob with its caption underneath, attached to one parameter.
class Knob : public juce::Component
{
public:
    Knob (juce::AudioProcessorValueTreeState&, const juce::String& paramId, const juce::String& caption,
          bool accentWhite = false);
    void resized() override;
    void paint (juce::Graphics&) override;
    void parentHierarchyChanged() override;
    juce::Slider slider;

private:
    juce::String caption;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attachment;
};

// Small read-only scope that draws what a section is doing.
class Display : public juce::Component
{
public:
    enum class Kind { Oscillator, Filter, Envelope, Lfo };
    Display (juce::AudioProcessorValueTreeState&, Kind, int oscIndex = 0);
    void paint (juce::Graphics&) override;

private:
    juce::AudioProcessorValueTreeState& state;
    Kind kind;
    int oscIndex;
    float value (const juce::String& pid) const { return state.getRawParameterValue (pid)->load(); }
};

class PresetBar : public juce::Component
{
public:
    explicit PresetBar (RatoProcessor&);
    void paint (juce::Graphics&) override;
    void mouseUp (const juce::MouseEvent&) override;
    void showMenu();
    void refresh();

private:
    RatoProcessor& proc;
    juce::String shownName, shownInfo;
};

class Content : public juce::Component, private juce::Timer
{
public:
    explicit Content (RatoProcessor&);
    void paint (juce::Graphics&) override;
    void resized() override;
    static constexpr int baseWidth = 1100, baseHeight = 720;

private:
    void timerCallback() override;
    void savePreset();
    void panel (juce::Graphics&, juce::Rectangle<int>, const juce::String& title) const;

    RatoProcessor& proc;
    juce::AudioProcessorValueTreeState& apvts;

    PresetBar presetBar;
    juce::TextButton browseButton { "Browse" }, saveButton { "Save" };
    Knob master;

    struct OscSection
    {
        std::unique_ptr<juce::ComboBox> wave;
        std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> waveAttachment;
        std::unique_ptr<Display> display;
        std::unique_ptr<Knob> pitch, fine, shape, level;
    };
    std::array<OscSection, numOscillators> oscs;

    Display filterDisplay, envDisplay, lfoDisplay;
    std::array<juce::TextButton, 3> filterButtons;
    Knob cutoff, reso, drive, fenv, attack, decay, sustain, release, lfoRate, lfoAmount;
    juce::ComboBox lfoTarget;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> lfoTargetAttachment;

    Knob uniVoices, uniDetune, uniWidth;
    juce::ToggleButton monoButton { "Mono" }, arpButton { "Arp" };
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> monoAttachment, arpAttachment;
    juce::ComboBox arpRate;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> arpRateAttachment;
    Knob glide, arpOctaves, velAmp, velCutoff, keytrack;
    Knob reverb, size, delay, chorusKnob, dist, lowCut, mix;

    juce::MidiKeyboardComponent keyboard;
    juce::Image logo;
    std::unique_ptr<juce::FileChooser> chooser;

    // section bounds (computed in resized, used by paint)
    std::array<juce::Rectangle<int>, numOscillators> oscBounds;
    juce::Rectangle<int> filterBounds, envBounds, lfoBounds, uniBounds, voiceBounds, fxBounds, footerBounds;
};
} // namespace rato::ui

class RatoEditor : public juce::AudioProcessorEditor
{
public:
    explicit RatoEditor (RatoProcessor&);
    ~RatoEditor() override;
    void resized() override;
    void paint (juce::Graphics& g) override { g.fillAll (rato::ui::colour::bg); }

private:
    rato::ui::LookAndFeel lnf;
    rato::ui::Content content;
};
