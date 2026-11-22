#pragma once

#include "Params.h"
#include <juce_audio_processors/juce_audio_processors.h>

namespace rato
{
inline juce::AudioProcessorValueTreeState::ParameterLayout createLayout()
{
    using namespace juce;
    AudioProcessorValueTreeState::ParameterLayout layout;
    int version = 1;

    using Fmt = std::function<String (float, int)>;
    const Fmt percent = [] (float v, int) { return String (roundToInt (v * 100.0f)) + "%"; };
    const Fmt seconds = [] (float v, int)
    {
        const float s = envTimeSeconds (v);
        return s < 1.0f ? String (roundToInt (s * 1000.0f)) + " ms" : String (s, 2) + " s";
    };
    const Fmt hertz = [] (float v, int)
    {
        const float f = cutoffHz (v);
        return f < 1000.0f ? String (roundToInt (f)) + " Hz" : String (f / 1000.0f, 1) + " kHz";
    };
    const Fmt lfoFmt = [] (float v, int) { return String (lfoHz (v), 2) + " Hz"; };
    const Fmt glideFmt = [] (float v, int) { return String (roundToInt (glideSeconds (v) * 1000.0f)) + " ms"; };

    auto unit = [&] (const String& pid, const String& name, float def, Fmt fmt = {})
    {
        layout.add (std::make_unique<AudioParameterFloat> (ParameterID { pid, version }, name,
                                                           NormalisableRange<float> (0.0f, 1.0f), def,
                                                           AudioParameterFloatAttributes().withStringFromValueFunction (fmt ? fmt : percent)));
    };

    for (int i = 0; i < numOscillators; ++i)
    {
        auto n = "Osc " + String (i + 1) + " ";
        layout.add (std::make_unique<AudioParameterChoice> (ParameterID { id::osc (i, "wave"), version }, n + "Wave", waveNames, i == 0 ? Supersaw : Saw));
        layout.add (std::make_unique<AudioParameterInt> (ParameterID { id::osc (i, "pitch"), version }, n + "Pitch", -24, 24, 0));
        layout.add (std::make_unique<AudioParameterFloat> (ParameterID { id::osc (i, "fine"), version }, n + "Fine",
                                                           NormalisableRange<float> (-1.0f, 1.0f), 0.0f,
                                                           AudioParameterFloatAttributes().withStringFromValueFunction ([] (float v, int) { return String (roundToInt (v * 100.0f)) + " ct"; })));
        unit (id::osc (i, "shape"), n + "Shape", 0.3f);
        unit (id::osc (i, "level"), n + "Level", i == 0 ? 0.8f : 0.0f);
    }

    layout.add (std::make_unique<AudioParameterInt> (ParameterID { id::uniVoices, version }, "Unison Voices", 1, maxUnison, 1));
    unit (id::uniDetune, "Unison Detune", 0.15f);
    unit (id::uniWidth,  "Unison Width",  0.5f);

    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { id::fltMode, version }, "Filter Mode", filterModes, LP24));
    unit (id::fltCutoff,   "Cutoff",          0.7f, hertz);
    unit (id::fltReso,     "Resonance",       0.2f);
    unit (id::fltDrive,    "Drive",           0.1f);
    unit (id::fltEnv,      "Filter Env",      0.3f);
    unit (id::fltKeytrack, "Keytrack",        0.5f);

    unit (id::attack,  "Attack",  0.05f, seconds);
    unit (id::decay,   "Decay",   0.4f, seconds);
    unit (id::sustain, "Sustain", 0.7f);
    unit (id::release, "Release", 0.4f, seconds);

    unit (id::lfoRate,   "LFO Rate",   0.4f, lfoFmt);
    unit (id::lfoAmount, "LFO Amount", 0.0f);
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { id::lfoTarget, version }, "LFO Target", lfoTargets, ToCutoff));

    layout.add (std::make_unique<AudioParameterBool> (ParameterID { id::arpOn, version }, "Arp", false));
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { id::arpRate, version }, "Arp Rate", arpRates, 1));
    layout.add (std::make_unique<AudioParameterInt> (ParameterID { id::arpOctaves, version }, "Arp Octaves", 1, 3, 1));

    layout.add (std::make_unique<AudioParameterBool> (ParameterID { id::mono, version }, "Mono", false));
    unit (id::glide, "Glide", 0.0f, glideFmt);
    unit (id::velAmp,    "Velocity > Amp",    0.4f);
    unit (id::velCutoff, "Velocity > Cutoff", 0.2f);

    unit (id::fxReverb, "Reverb",      0.25f);
    unit (id::fxSize,   "Reverb Size", 0.6f);
    unit (id::fxDelay,  "Delay",       0.15f);
    unit (id::fxChorus, "Chorus",      0.2f);
    unit (id::fxDist,   "Distortion",  0.0f);
    unit (id::fxMix,    "FX Mix",      0.5f);
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { id::fxLowCut, version }, "FX Low Cut",
                                                       NormalisableRange<float> (0.0f, 500.0f, 1.0f), 120.0f,
                                                       AudioParameterFloatAttributes().withStringFromValueFunction ([] (float v, int) { return v < 1.0f ? String ("Off") : String (roundToInt (v)) + " Hz"; })));
    unit (id::master, "Master", 0.7f);

    return layout;
}
} // namespace rato
