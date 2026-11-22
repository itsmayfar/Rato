#include "PresetManager.h"
#include "BinaryData.h"

namespace rato
{
namespace
{
    float num (const juce::var& v, float fallback)
    {
        return (v.isDouble() || v.isInt() || v.isInt64() || v.isBool()) ? (float) (double) v : fallback;
    }
}

PresetManager::PresetManager (juce::AudioProcessorValueTreeState& state) : apvts (state)
{
    auto json = juce::JSON::parse (juce::String::fromUTF8 (BinaryData::presets_json, BinaryData::presets_jsonSize));

    if (auto* list = json["presets"].getArray())
    {
        for (auto& p : *list)
        {
            Preset preset { p["name"].toString(), p["category"].toString(), p };
            presets.add (preset);
            categories.addIfNotAlreadyThere (preset.category);
        }
    }
}

juce::String PresetManager::getCurrentName() const
{
    if (userPresetName.isNotEmpty()) return userPresetName;
    return juce::isPositiveAndBelow (currentIndex, presets.size()) ? presets[currentIndex].name : juce::String ("Init");
}

juce::String PresetManager::getCurrentCategory() const
{
    if (userPresetName.isNotEmpty()) return "User";
    return juce::isPositiveAndBelow (currentIndex, presets.size()) ? presets[currentIndex].category : juce::String();
}

void PresetManager::setParam (const juce::String& paramId, float realValue)
{
    if (auto* param = apvts.getParameter (paramId))
        param->setValueNotifyingHost (param->convertTo0to1 (realValue));
}

void PresetManager::loadPreset (int index)
{
    if (! juce::isPositiveAndBelow (index, presets.size()))
        return;

    currentIndex = index;
    userPresetName.clear();
    const auto& d = presets.getReference (index).data;

    if (auto* oscs = d["oscillators"].getArray())
    {
        for (int i = 0; i < numOscillators; ++i)
        {
            const auto o = i < oscs->size() ? oscs->getReference (i) : juce::var();
            setParam (id::osc (i, "wave"),  (float) juce::jmax (0, waveNames.indexOf (o["wave"].toString())));
            setParam (id::osc (i, "pitch"), num (o["pitch"], 0.0f));
            setParam (id::osc (i, "fine"),  num (o["fine"], 0.0f));
            setParam (id::osc (i, "shape"), num (o["shape"], 0.3f));
            setParam (id::osc (i, "level"), num (o["level"], 0.0f));
        }
    }

    const auto uni = d["unison"];
    setParam (id::uniVoices, num (uni["voices"], 1.0f));
    setParam (id::uniDetune, num (uni["detune"], 0.1f));
    setParam (id::uniWidth,  num (uni["width"], 0.4f));

    const auto f = d["filter"];
    setParam (id::fltMode,     (float) juce::jmax (0, filterModes.indexOf (f["mode"].toString())));
    setParam (id::fltCutoff,   num (f["cutoff"], 0.7f));
    setParam (id::fltReso,     num (f["resonance"], 0.2f));
    setParam (id::fltDrive,    num (f["drive"], 0.0f));
    setParam (id::fltEnv,      num (f["envAmount"], 0.3f));
    setParam (id::fltKeytrack, num (f["keytrack"], 0.5f));

    const auto e = d["ampEnvelope"];
    setParam (id::attack,  num (e["attack"], 0.05f));
    setParam (id::decay,   num (e["decay"], 0.4f));
    setParam (id::sustain, num (e["sustain"], 0.7f));
    setParam (id::release, num (e["release"], 0.4f));

    const auto l = d["lfo"];
    setParam (id::lfoRate,   num (l["rate"], 0.4f));
    setParam (id::lfoAmount, num (l["amount"], 0.0f));
    setParam (id::lfoTarget, (float) juce::jmax (0, lfoTargets.indexOf (l["target"].toString())));

    const auto a = d["arp"];
    setParam (id::arpOn,      (bool) a["enabled"] ? 1.0f : 0.0f);
    setParam (id::arpRate,    (float) juce::jmax (0, arpRates.indexOf (a["rate"].toString())));
    setParam (id::arpOctaves, num (a["octaves"], 1.0f));

    setParam (id::mono,  (bool) d["mono"] ? 1.0f : 0.0f);
    setParam (id::glide, num (d["glide"], 0.0f));

    const auto v = d["velocity"];
    setParam (id::velAmp,    num (v["toAmp"], 0.4f));
    setParam (id::velCutoff, num (v["toCutoff"], 0.2f));

    const auto fx = d["fx"];
    setParam (id::fxReverb, num (fx["reverb"], 0.2f));
    setParam (id::fxSize,   num (fx["reverbSize"], 0.6f));
    setParam (id::fxDelay,  num (fx["delay"], 0.1f));
    setParam (id::fxChorus, num (fx["chorus"], 0.1f));
    setParam (id::fxDist,   num (fx["distortion"], 0.0f));
    setParam (id::fxMix,    num (fx["mix"], 0.5f));
    setParam (id::fxLowCut, num (fx["lowCut"], 120.0f));

    setParam (id::master, num (d["master"], 0.7f));

    if (onPresetChanged) onPresetChanged();
}

void PresetManager::next()     { loadPreset ((currentIndex + 1) % presets.size()); }
void PresetManager::previous() { loadPreset ((currentIndex + presets.size() - 1) % presets.size()); }

juce::File PresetManager::getUserPresetFolder()
{
    return juce::File::getSpecialLocation (juce::File::userMusicDirectory).getChildFile ("RATO Presets");
}

juce::Array<juce::File> PresetManager::getUserPresets() const
{
    auto files = getUserPresetFolder().findChildFiles (juce::File::findFiles, false, "*.ratopreset");
    files.sort();
    return files;
}

bool PresetManager::saveUserPreset (const juce::File& file)
{
    auto state = apvts.copyState();
    if (auto xml = state.createXml())
    {
        file.getParentDirectory().createDirectory();
        if (xml->writeTo (file))
        {
            userPresetName = file.getFileNameWithoutExtension();
            if (onPresetChanged) onPresetChanged();
            return true;
        }
    }
    return false;
}

bool PresetManager::loadUserPreset (const juce::File& file)
{
    if (auto xml = juce::XmlDocument::parse (file))
    {
        auto tree = juce::ValueTree::fromXml (*xml);
        if (! tree.hasType (apvts.state.getType()))
            return false;

        for (int i = 0; i < tree.getNumChildren(); ++i)
        {
            auto child = tree.getChild (i);
            const auto pid = child.getProperty ("id").toString();
            if (auto* param = apvts.getParameter (pid))
                param->setValueNotifyingHost (param->convertTo0to1 ((float) child.getProperty ("value")));
        }
        userPresetName = file.getFileNameWithoutExtension();
        if (onPresetChanged) onPresetChanged();
        return true;
    }
    return false;
}
} // namespace rato
