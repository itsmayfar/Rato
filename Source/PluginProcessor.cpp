#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace rato;

namespace
{
    inline float softClip (float x) noexcept
    {
        const float a = std::abs (x);
        if (a <= 0.8f) return x;
        return std::copysign (0.8f + 0.2f * std::tanh ((a - 0.8f) / 0.2f), x);
    }
}

RatoProcessor::RatoProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "RATO", createLayout()),
      presets (apvts)
{
    for (int i = 0; i < numOscillators; ++i)
        oscPtrs[(size_t) i] = { p (id::osc (i, "wave")), p (id::osc (i, "pitch")), p (id::osc (i, "fine")),
                                p (id::osc (i, "shape")), p (id::osc (i, "level")) };

    presets.loadPreset (0);
}

bool RatoProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::stereo() || out == juce::AudioChannelSet::mono();
}

void RatoProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;
    for (auto& v : voices) v.prepare (sampleRate);
    sustained.fill (false);
    monoStack.clearQuick();
    arpHeld.clearQuick();
    arpPlayingNote = -1;
    arpNextStep = arpNoteOffAt = 0.0;

    juce::dsp::ProcessSpec spec { sampleRate, (juce::uint32) samplesPerBlock, 2 };
    chorus.prepare (spec);
    chorus.setRate (0.7f);
    chorus.setDepth (0.3f);
    chorus.setCentreDelay (8.0f);
    chorus.setFeedback (0.0f);
    reverb.prepare (spec);
    reverbLowCut.prepare (spec);
    reverbLowCut.setType (juce::dsp::StateVariableTPTFilterType::highpass);

    delayBuffer.setSize (2, (int) (sampleRate * 2.5) + 1);
    delayBuffer.clear();
    delayWritePos = 0;
    sendBuffer.setSize (2, samplesPerBlock);
    workBuffer.setSize (2, samplesPerBlock);
    revBuffer.setSize (2, samplesPerBlock);

    cutoffSmoothed.reset (sampleRate, 0.03);
    cutoffSmoothed.setCurrentAndTargetValue (p (id::fltCutoff)->load());
    masterSmoothed.reset (sampleRate, 0.03);
    masterSmoothed.setCurrentAndTargetValue (masterGain (p (id::master)->load()));
}

VoiceParams RatoProcessor::snapshotParams()
{
    VoiceParams vp;
    for (int i = 0; i < numOscillators; ++i)
    {
        const auto& o = oscPtrs[(size_t) i];
        vp.osc[(size_t) i] = { (int) o.wave->load(), o.pitch->load() + o.fine->load(), o.shape->load(), o.level->load() };
    }
    vp.uniVoices = (int) p (id::uniVoices)->load();
    vp.uniDetune = p (id::uniDetune)->load();
    vp.uniWidth  = p (id::uniWidth)->load();

    vp.fltMode   = (int) p (id::fltMode)->load();
    vp.cutoff    = cutoffSmoothed.getCurrentValue();
    vp.reso      = p (id::fltReso)->load();
    vp.drive     = p (id::fltDrive)->load();
    vp.envAmount = p (id::fltEnv)->load();
    vp.keytrack  = p (id::fltKeytrack)->load();

    vp.attack  = envTimeSeconds (p (id::attack)->load());
    vp.decay   = envTimeSeconds (p (id::decay)->load());
    vp.sustain = p (id::sustain)->load();
    vp.release = envTimeSeconds (p (id::release)->load());

    vp.lfoHz     = lfoHz (p (id::lfoRate)->load());
    vp.lfoAmount = juce::jmin (1.0f, p (id::lfoAmount)->load() + 0.5f * modWheel);
    vp.lfoTarget = (int) p (id::lfoTarget)->load();

    vp.glideSeconds = p (id::mono)->load() > 0.5f ? glideSeconds (p (id::glide)->load()) : 0.0f;
    vp.velAmp    = p (id::velAmp)->load();
    vp.velCutoff = p (id::velCutoff)->load();
    vp.pitchBendSemis = pitchBendSemis;
    return vp;
}

// ------------------------------------------------------------------ voices

void RatoProcessor::startNote (int note, float velocity)
{
    const bool mono = p (id::mono)->load() > 0.5f;

    if (mono)
    {
        monoStack.removeFirstMatchingValue (note);
        monoStack.add (note);
        const bool legato = monoStack.size() > 1 && voices[0].isActive() && ! voices[0].isReleasing();
        monoVelocity = velocity;
        sustained[0] = false;
        voices[0].noteOn (note, velocity, legato, ++noteCounter);
        return;
    }

    int target = -1;

    for (int i = 0; i < maxVoices && target < 0; ++i)      // same note already sounding: reuse it
        if (voices[(size_t) i].isActive() && voices[(size_t) i].getNote() == note)
            target = i;

    for (int i = 0; i < maxVoices && target < 0; ++i)      // a free voice
        if (! voices[(size_t) i].isActive())
            target = i;

    if (target < 0)                                         // steal: oldest releasing, then oldest
    {
        juce::uint64 oldest = std::numeric_limits<juce::uint64>::max();
        for (int pass = 0; pass < 2 && target < 0; ++pass)
            for (int i = 0; i < maxVoices; ++i)
            {
                auto& v = voices[(size_t) i];
                if ((pass == 1 || v.isReleasing()) && v.getOrder() < oldest)
                {
                    oldest = v.getOrder();
                    target = i;
                }
            }
    }

    sustained[(size_t) target] = false;
    voices[(size_t) target].noteOn (note, velocity, false, ++noteCounter);
}

void RatoProcessor::stopNote (int note)
{
    const bool mono = p (id::mono)->load() > 0.5f;

    if (mono)
    {
        monoStack.removeFirstMatchingValue (note);
        if (! monoStack.isEmpty())
        {
            if (voices[0].getNote() != monoStack.getLast())
                voices[0].noteOn (monoStack.getLast(), monoVelocity, true, ++noteCounter);
        }
        else if (voices[0].getNote() == note)
        {
            if (sustainPedal) sustained[0] = true;
            else voices[0].noteOff();
        }
        return;
    }

    for (int i = 0; i < maxVoices; ++i)
    {
        auto& v = voices[(size_t) i];
        if (v.isActive() && ! v.isReleasing() && v.getNote() == note)
        {
            if (sustainPedal) sustained[(size_t) i] = true;
            else v.noteOff();
        }
    }
}

void RatoProcessor::handleMidi (const juce::MidiMessage& m)
{
    if (m.isNoteOn())
        startNote (m.getNoteNumber(), m.getFloatVelocity());
    else if (m.isNoteOff())
        stopNote (m.getNoteNumber());
    else if (m.isPitchWheel())
        pitchBendSemis = 2.0f * ((float) m.getPitchWheelValue() - 8192.0f) / 8192.0f;
    else if (m.isControllerOfType (1))
        modWheel = (float) m.getControllerValue() / 127.0f;
    else if (m.isSustainPedalOn())
        sustainPedal = true;
    else if (m.isSustainPedalOff())
    {
        sustainPedal = false;
        for (int i = 0; i < maxVoices; ++i)
            if (sustained[(size_t) i]) { voices[(size_t) i].noteOff(); sustained[(size_t) i] = false; }
    }
    else if (m.isAllNotesOff() || m.isAllSoundOff())
    {
        monoStack.clearQuick();
        sustained.fill (false);
        for (auto& v : voices)
            if (m.isAllSoundOff()) v.kill(); else v.noteOff();
    }
}

void RatoProcessor::renderVoices (float* left, float* right, int numSamples)
{
    int pos = 0;
    while (pos < numSamples)
    {
        const int n = juce::jmin (32, numSamples - pos);
        cutoffSmoothed.skip (n);
        const auto vp = snapshotParams();
        for (auto& v : voices)
            v.render (left + pos, right + pos, n, vp);
        pos += n;
    }
}

// ------------------------------------------------------------------ arpeggiator

void RatoProcessor::runArp (juce::MidiBuffer& midi, int numSamples, double bpm)
{
    const bool on = p (id::arpOn)->load() > 0.5f;
    juce::MidiBuffer out;

    for (const auto meta : midi)
    {
        const auto m = meta.getMessage();
        if (on && m.isNoteOn())       { arpHeld.addIfNotAlreadyThere (m.getNoteNumber()); arpVelocity = m.getFloatVelocity(); }
        else if (on && m.isNoteOff()) { arpHeld.removeFirstMatchingValue (m.getNoteNumber()); }
        else if (! on && (m.isNoteOn() || m.isNoteOff())) out.addEvent (m, meta.samplePosition);
        else out.addEvent (m, meta.samplePosition);
    }

    if (! on)
    {
        if (arpWasOn && arpPlayingNote >= 0)
            out.addEvent (juce::MidiMessage::noteOff (1, arpPlayingNote), 0);
        arpPlayingNote = -1;
        arpHeld.clearQuick();
        arpNextStep = 0.0;
        arpWasOn = false;
        midi.swapWith (out);
        return;
    }
    arpWasOn = true;

    arpHeld.sort();
    const int rate = (int) p (id::arpRate)->load();
    const int octaves = (int) p (id::arpOctaves)->load();
    const double beats = rate == 0 ? 0.5 : (rate == 1 ? 0.25 : 1.0 / 6.0);
    const double stepLen = 60.0 / bpm * beats * currentSampleRate;
    const double gateLen = stepLen * 0.7;

    if (arpHeld.isEmpty() && arpPlayingNote < 0)
    {
        arpIndex = 0;
        arpNextStep = 0.0;
        midi.swapWith (out);
        return;
    }

    for (;;)
    {
        const double offAt = arpPlayingNote >= 0 ? arpNoteOffAt : 1.0e18;
        if (juce::jmin (arpNextStep, offAt) >= (double) numSamples)
            break;

        if (arpPlayingNote >= 0 && offAt <= arpNextStep)
        {
            out.addEvent (juce::MidiMessage::noteOff (1, arpPlayingNote), (int) offAt);
            arpPlayingNote = -1;
            continue;
        }

        if (arpHeld.isEmpty())
        {
            arpIndex = 0;
            arpNextStep = 0.0;
            break;
        }

        const int size = arpHeld.size() * octaves;
        const int idx = arpIndex % size;
        const int note = juce::jmin (127, arpHeld[idx % arpHeld.size()] + 12 * (idx / arpHeld.size()));
        ++arpIndex;

        const int at = (int) arpNextStep;
        if (arpPlayingNote >= 0)
            out.addEvent (juce::MidiMessage::noteOff (1, arpPlayingNote), at);
        out.addEvent (juce::MidiMessage::noteOn (1, note, arpVelocity), at);
        arpPlayingNote = note;
        arpNoteOffAt = arpNextStep + gateLen;
        arpNextStep += stepLen;
    }

    if (! arpHeld.isEmpty() || arpPlayingNote >= 0)
    {
        arpNextStep -= numSamples;
        arpNoteOffAt -= numSamples;
    }
    midi.swapWith (out);
}

// ------------------------------------------------------------------ audio

void RatoProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    const int numSamples = buffer.getNumSamples();
    buffer.clear();

    keyboardState.processNextMidiBuffer (midi, 0, numSamples, true);

    double bpm = 120.0;
    if (auto* ph = getPlayHead())
        if (auto pos = ph->getPosition())
            if (auto b = pos->getBpm())
                bpm = juce::jlimit (30.0, 300.0, *b);

    // switching between mono and poly mid-note would leave hanging voices
    const bool mono = p (id::mono)->load() > 0.5f;
    if (mono != wasMono)
    {
        for (auto& v : voices) v.noteOff();
        monoStack.clearQuick();
        wasMono = mono;
    }

    runArp (midi, numSamples, bpm);

    cutoffSmoothed.setTargetValue (p (id::fltCutoff)->load());

    float* left = buffer.getWritePointer (0);
    float* right = buffer.getNumChannels() > 1 ? buffer.getWritePointer (1) : nullptr;

    for (auto* b : { &workBuffer, &sendBuffer, &revBuffer })
        if (b->getNumSamples() < numSamples)
            b->setSize (2, numSamples, false, false, true);   // only if the host exceeds the announced block size

    juce::AudioBuffer<float> work (workBuffer.getArrayOfWritePointers(), 2, numSamples);
    work.clear();
    float* wl = work.getWritePointer (0);
    float* wr = work.getWritePointer (1);

    int pos = 0;
    for (const auto meta : midi)
    {
        const int evPos = juce::jlimit (0, numSamples, meta.samplePosition);
        if (evPos > pos) { renderVoices (wl + pos, wr + pos, evPos - pos); pos = evPos; }
        handleMidi (meta.getMessage());
    }
    if (pos < numSamples)
        renderVoices (wl + pos, wr + pos, numSamples - pos);

    // ---- distortion ----
    const float dist = p (id::fxDist)->load();
    if (dist > 0.001f)
    {
        const float drive = 1.0f + dist * 8.0f;
        for (int c = 0; c < 2; ++c)
        {
            auto* d = work.getWritePointer (c);
            for (int i = 0; i < numSamples; ++i)
                d[i] += dist * (std::tanh (d[i] * drive) * 0.7f - d[i]);
        }
    }

    // ---- chorus ----
    const float chorusAmt = p (id::fxChorus)->load();
    if (chorusAmt > 0.001f)
    {
        chorus.setMix (0.5f * chorusAmt);
        juce::dsp::AudioBlock<float> block (work);
        chorus.process (juce::dsp::ProcessContextReplacing<float> (block));
    }

    // ---- delay + reverb sends ----
    const float fxMix = p (id::fxMix)->load() * 2.0f;
    const float delayAmt = p (id::fxDelay)->load();
    const float reverbAmt = p (id::fxReverb)->load();

    sendBuffer.clear();

    if (delayAmt > 0.001f)
    {
        const int delaySamples = juce::jlimit (1, delayBuffer.getNumSamples() - 1,
                                               (int) (60.0 / bpm * 0.75 * currentSampleRate));
        const float feedback = 0.25f + 0.45f * delayAmt;
        const int len = delayBuffer.getNumSamples();
        auto* dl = delayBuffer.getWritePointer (0);
        auto* dr = delayBuffer.getWritePointer (1);

        for (int i = 0; i < numSamples; ++i)
        {
            const int readPos = (delayWritePos - delaySamples + len) % len;
            const float outL = dl[readPos], outR = dr[readPos];
            const float in = 0.5f * (wl[i] + wr[i]) * delayAmt;
            dl[delayWritePos] = in + outR * feedback;   // ping-pong
            dr[delayWritePos] = outL * feedback;
            sendBuffer.addSample (0, i, outL * 0.6f);
            sendBuffer.addSample (1, i, outR * 0.6f);
            delayWritePos = (delayWritePos + 1) % len;
        }
    }
    else
    {
        delayBuffer.clear();
    }

    if (reverbAmt > 0.001f)
    {
        juce::AudioBuffer<float> rev (revBuffer.getArrayOfWritePointers(), 2, numSamples);
        rev.copyFrom (0, 0, work, 0, 0, numSamples);
        rev.copyFrom (1, 0, work, 1, 0, numSamples);
        rev.applyGain (reverbAmt);

        reverbLowCut.setCutoffFrequency (juce::jmax (20.0f, p (id::fxLowCut)->load()));
        juce::dsp::AudioBlock<float> rb (rev);
        reverbLowCut.process (juce::dsp::ProcessContextReplacing<float> (rb));

        juce::dsp::Reverb::Parameters rp;
        rp.roomSize = 0.5f + 0.45f * p (id::fxSize)->load();
        rp.damping = 0.45f;
        rp.width = 1.0f;
        rp.wetLevel = 0.8f;
        rp.dryLevel = 0.0f;
        reverb.setParameters (rp);
        reverb.process (juce::dsp::ProcessContextReplacing<float> (rb));

        sendBuffer.addFrom (0, 0, rev, 0, 0, numSamples);
        sendBuffer.addFrom (1, 0, rev, 1, 0, numSamples);
    }

    work.addFrom (0, 0, sendBuffer, 0, 0, numSamples, fxMix);
    work.addFrom (1, 0, sendBuffer, 1, 0, numSamples, fxMix);

    // ---- master + safety clip ----
    masterSmoothed.setTargetValue (masterGain (p (id::master)->load()));
    for (int i = 0; i < numSamples; ++i)
    {
        const float g = masterSmoothed.getNextValue();
        const float l = softClip (wl[i] * g);
        const float r = softClip (wr[i] * g);
        if (right != nullptr) { left[i] = l; right[i] = r; }
        else                  { left[i] = 0.5f * (l + r); }
    }
}

// ------------------------------------------------------------------ programs & state

int RatoProcessor::getNumPrograms()                         { return juce::jmax (1, presets.getNumPresets()); }
int RatoProcessor::getCurrentProgram()                      { return presets.getCurrentIndex(); }
void RatoProcessor::setCurrentProgram (int index)           { presets.loadPreset (index); }
const juce::String RatoProcessor::getProgramName (int index)
{
    return juce::isPositiveAndBelow (index, presets.getNumPresets()) ? presets.getPreset (index).name : juce::String ("Init");
}

void RatoProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("presetIndex", presets.getCurrentIndex(), nullptr);
    state.setProperty ("userPreset", presets.getUserPresetName(), nullptr);
    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void RatoProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
    {
        auto tree = juce::ValueTree::fromXml (*xml);
        if (tree.hasType (apvts.state.getType()))
        {
            presets.setCurrentIndexSilently ((int) tree.getProperty ("presetIndex", 0));
            apvts.replaceState (tree);
            if (presets.onPresetChanged) presets.onPresetChanged();
        }
    }
}

juce::AudioProcessorEditor* RatoProcessor::createEditor() { return new RatoEditor (*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new RatoProcessor(); }
