#pragma once

#include <juce_core/juce_core.h>
#include <cmath>

namespace rato
{
static constexpr int numOscillators = 4;
static constexpr int maxUnison = 7;
static constexpr int maxVoices = 16;

inline const juce::StringArray waveNames { "Saw", "Square", "Sine", "Triangle", "Supersaw", "Noise", "Wavetable" };
inline const juce::StringArray filterModes { "LP24", "HP", "BP" };
inline const juce::StringArray lfoTargets { "Cutoff", "Pitch", "Shape", "Volume" };
inline const juce::StringArray arpRates { "1/8", "1/16", "1/16T" };

enum Wave { Saw = 0, Square, Sine, Triangle, Supersaw, Noise, Wavetable };
enum FilterMode { LP24 = 0, HP, BP };
enum LfoTarget { ToCutoff = 0, ToPitch, ToShape, ToVolume };

namespace id
{
    inline juce::String osc (int i, const char* what) { return "osc" + juce::String (i + 1) + "_" + what; }

    inline const juce::String uniVoices   = "uni_voices";
    inline const juce::String uniDetune   = "uni_detune";
    inline const juce::String uniWidth    = "uni_width";
    inline const juce::String fltMode     = "flt_mode";
    inline const juce::String fltCutoff   = "flt_cutoff";
    inline const juce::String fltReso     = "flt_reso";
    inline const juce::String fltDrive    = "flt_drive";
    inline const juce::String fltEnv      = "flt_env";
    inline const juce::String fltKeytrack = "flt_keytrack";
    inline const juce::String attack      = "env_attack";
    inline const juce::String decay       = "env_decay";
    inline const juce::String sustain     = "env_sustain";
    inline const juce::String release     = "env_release";
    inline const juce::String lfoRate     = "lfo_rate";
    inline const juce::String lfoAmount   = "lfo_amount";
    inline const juce::String lfoTarget   = "lfo_target";
    inline const juce::String arpOn       = "arp_on";
    inline const juce::String arpRate     = "arp_rate";
    inline const juce::String arpOctaves  = "arp_octaves";
    inline const juce::String mono        = "mono";
    inline const juce::String glide       = "glide";
    inline const juce::String velAmp      = "vel_amp";
    inline const juce::String velCutoff   = "vel_cutoff";
    inline const juce::String fxReverb    = "fx_reverb";
    inline const juce::String fxSize      = "fx_size";
    inline const juce::String fxDelay     = "fx_delay";
    inline const juce::String fxChorus    = "fx_chorus";
    inline const juce::String fxDist      = "fx_dist";
    inline const juce::String fxMix       = "fx_mix";
    inline const juce::String fxLowCut    = "fx_lowcut";
    inline const juce::String master      = "master";
}

// ---- value mappings shared by the engine and the GUI ----
inline float envTimeSeconds (float x)    { return 0.001f + 6.0f * std::pow (juce::jlimit (0.0f, 1.0f, x), 2.5f); }
inline float cutoffHz (float x)          { return 20.0f * std::pow (1000.0f, juce::jlimit (0.0f, 1.0f, x)); }
inline float lfoHz (float x)             { return 0.05f * std::pow (400.0f, juce::jlimit (0.0f, 1.0f, x)); }
inline float glideSeconds (float x)      { return 0.5f * x * x; }
inline float masterGain (float x)        { return 2.0f * x * x; }
} // namespace rato
