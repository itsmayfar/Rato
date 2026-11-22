#pragma once

#include "ParamLayout.h"
#include "SynthVoice.h"
#include "PresetManager.h"
#include <juce_dsp/juce_dsp.h>

class RatoProcessor : public juce::AudioProcessor
{
public:
    RatoProcessor();
    ~RatoProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override  { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 3.0; }

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;
    rato::PresetManager presets;
    juce::MidiKeyboardState keyboardState;

private:
    // ---- voices ----
    void handleMidi (const juce::MidiMessage& m);
    void startNote (int note, float velocity);
    void stopNote (int note);
    void renderVoices (float* left, float* right, int numSamples);
    rato::VoiceParams snapshotParams();

    std::array<rato::Voice, rato::maxVoices> voices;
    std::array<bool, rato::maxVoices> sustained {};
    juce::Array<int> monoStack;
    float monoVelocity = 1.0f;
    bool sustainPedal = false;
    bool wasMono = false;
    float pitchBendSemis = 0.0f, modWheel = 0.0f;
    juce::uint64 noteCounter = 0;
    juce::LinearSmoothedValue<float> cutoffSmoothed, masterSmoothed;

    // ---- arpeggiator ----
    void runArp (juce::MidiBuffer& midi, int numSamples, double bpm);
    juce::Array<int> arpHeld;
    float arpVelocity = 0.8f;
    int arpIndex = 0, arpPlayingNote = -1;
    double arpNextStep = 0.0, arpNoteOffAt = 0.0;
    bool arpWasOn = false;

    // ---- effects ----
    juce::dsp::Chorus<float> chorus;
    juce::dsp::Reverb reverb;
    juce::dsp::StateVariableTPTFilter<float> reverbLowCut;
    juce::AudioBuffer<float> delayBuffer, sendBuffer, workBuffer, revBuffer;
    int delayWritePos = 0;
    double currentSampleRate = 44100.0;

    // cached raw parameter pointers
    struct OscPtrs { std::atomic<float>* wave; std::atomic<float>* pitch; std::atomic<float>* fine; std::atomic<float>* shape; std::atomic<float>* level; };
    std::array<OscPtrs, rato::numOscillators> oscPtrs {};
    std::atomic<float>* p (const juce::String& pid) { return apvts.getRawParameterValue (pid); }

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RatoProcessor)
};
