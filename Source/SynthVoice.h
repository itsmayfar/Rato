#pragma once

#include "Params.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <array>

namespace rato
{
// A snapshot of every engine parameter, taken once per small render block.
struct VoiceParams
{
    struct Osc { int wave = Saw; float semis = 0.0f; float shape = 0.0f; float level = 0.0f; };
    std::array<Osc, numOscillators> osc;

    int   uniVoices = 1;
    float uniDetune = 0.0f, uniWidth = 0.0f;

    int   fltMode = LP24;
    float cutoff = 0.7f, reso = 0.2f, drive = 0.0f, envAmount = 0.0f, keytrack = 0.5f;

    float attack = 0.01f, decay = 0.3f, sustain = 0.7f, release = 0.3f; // seconds / level

    float lfoHz = 1.0f, lfoAmount = 0.0f;
    int   lfoTarget = ToCutoff;

    float glideSeconds = 0.0f;
    float velAmp = 0.4f, velCutoff = 0.2f;
    float pitchBendSemis = 0.0f;
};

class Voice
{
public:
    void prepare (double sampleRate);
    void noteOn (int midiNote, float velocity, bool legato, juce::uint64 order);
    void noteOff();
    void kill();

    bool isActive() const noexcept     { return ampEnv.isActive(); }
    bool isReleasing() const noexcept  { return active && ! gate; }
    int  getNote() const noexcept      { return note; }
    juce::uint64 getOrder() const noexcept { return order; }

    // Adds `numSamples` of output into left/right starting at index 0.
    void render (float* left, float* right, int numSamples, const VoiceParams& p);

private:
    struct Svf
    {
        float ic1 = 0.0f, ic2 = 0.0f;
        void reset() noexcept { ic1 = ic2 = 0.0f; }
        // returns { low, band, high }
        inline void process (float x, float g, float k, float& lp, float& bp, float& hp) noexcept
        {
            const float a1 = 1.0f / (1.0f + g * (g + k));
            const float a2 = g * a1;
            const float a3 = g * a2;
            const float v3 = x - ic2;
            const float v1 = a1 * ic1 + a2 * v3;
            const float v2 = ic2 + a2 * ic1 + a3 * v3;
            ic1 = 2.0f * v1 - ic1;
            ic2 = 2.0f * v2 - ic2;
            lp = v2; bp = v1; hp = x - k * v1 - v2;
        }
    };

    double sr = 44100.0;
    bool active = false, gate = false;
    int note = 60;
    float velocity = 1.0f;
    juce::uint64 order = 0;

    float currentNote = 60.0f, targetNote = 60.0f;

    std::array<std::array<float, maxUnison>, numOscillators> phase {};
    std::array<float, numOscillators> noiseState {};
    float lfoPhase = 0.0f;

    juce::ADSR ampEnv, filterEnv;
    Svf svf[2][2]; // [channel][stage]
    juce::Random random;
};
} // namespace rato
