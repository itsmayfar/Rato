#include "SynthVoice.h"

namespace rato
{
namespace
{
    constexpr float twoPi = juce::MathConstants<float>::twoPi;

    inline float polyBlep (float t, float dt) noexcept
    {
        if (t < dt)        { t /= dt;          return t + t - t * t - 1.0f; }
        if (t > 1.0f - dt) { t = (t - 1.0f) / dt; return t * t + t + t + 1.0f; }
        return 0.0f;
    }

    inline float wrap01 (float x) noexcept { return x - std::floor (x); }

    inline float sawWave (float t, float dt) noexcept    { return 2.0f * t - 1.0f - polyBlep (t, dt); }

    inline float pulseWave (float t, float dt, float pw) noexcept
    {
        float v = t < pw ? 1.0f : -1.0f;
        v += polyBlep (t, dt);
        v -= polyBlep (wrap01 (t + 1.0f - pw), dt);
        return v;
    }

    inline float triWave (float t) noexcept   { return 1.0f - 4.0f * std::abs (t - 0.5f); }

    inline float softSat (float x, float amount) noexcept
    {
        if (amount < 0.01f) return x;
        const float d = 1.0f + 3.0f * amount;
        return std::tanh (x * d) / std::tanh (d);
    }
}

void Voice::prepare (double sampleRate)
{
    sr = sampleRate;
    ampEnv.setSampleRate (sampleRate);
    filterEnv.setSampleRate (sampleRate);
    random.setSeedRandomly();
    for (auto& o : phase)
        for (auto& ph : o)
            ph = random.nextFloat();
    kill();
}

void Voice::noteOn (int midiNote, float vel, bool legato, juce::uint64 newOrder)
{
    note = midiNote;
    order = newOrder;
    targetNote = (float) midiNote;

    if (legato && active && gate)
        return; // mono legato: keep envelopes running, just glide to the new pitch

    velocity = vel;
    if (! active)
    {
        currentNote = targetNote;
        for (auto& s : svf) for (auto& st : s) st.reset();
        noiseState.fill (0.0f);
    }
    lfoPhase = 0.0f;
    active = gate = true;
    ampEnv.noteOn();
    filterEnv.noteOn();
}

void Voice::noteOff()
{
    gate = false;
    ampEnv.noteOff();
    filterEnv.noteOff();
}

void Voice::kill()
{
    gate = active = false;
    ampEnv.reset();
    filterEnv.reset();
    for (auto& s : svf) for (auto& st : s) st.reset();
}

void Voice::render (float* left, float* right, int numSamples, const VoiceParams& p)
{
    if (! active)
        return;

    ampEnv.setParameters ({ p.attack, p.decay, p.sustain, p.release });
    filterEnv.setParameters ({ p.attack, juce::jmax (0.02f, p.decay), 0.0f, p.release });

    const float fs = (float) sr;
    const float blockSeconds = (float) numSamples / fs;

    // ---- glide ----
    if (p.glideSeconds > 0.001f)
        currentNote += (targetNote - currentNote) * (1.0f - std::exp (-blockSeconds / p.glideSeconds));
    else
        currentNote = targetNote;

    // ---- LFO (evaluated once per block, it is slow) ----
    lfoPhase = wrap01 (lfoPhase + p.lfoHz * blockSeconds);
    const float lfo = std::sin (twoPi * lfoPhase) * p.lfoAmount;

    const float lfoPitch  = p.lfoTarget == ToPitch  ? lfo * 2.0f : 0.0f;
    const float lfoCut    = p.lfoTarget == ToCutoff ? lfo * 3.0f : 0.0f;
    const float lfoShape  = p.lfoTarget == ToShape  ? lfo * 0.5f : 0.0f;
    const float lfoVolume = p.lfoTarget == ToVolume ? 1.0f - 0.5f * p.lfoAmount * (1.0f + std::sin (twoPi * lfoPhase)) : 1.0f;

    const float baseNote = currentNote + p.pitchBendSemis + lfoPitch;

    // ---- prepare oscillator stacks ----
    struct StackInfo { int count = 0; float inc[maxUnison]; float gainL[maxUnison]; float gainR[maxUnison]; float shape = 0; float level = 0; int wave = 0; };
    StackInfo stacks[numOscillators];

    for (int o = 0; o < numOscillators; ++o)
    {
        auto& s = stacks[o];
        const auto& op = p.osc[(size_t) o];
        s.level = op.level;
        if (op.level <= 0.0001f) { s.count = 0; continue; }

        s.wave = op.wave;
        s.shape = juce::jlimit (0.0f, 1.0f, op.shape + lfoShape);

        int count = p.uniVoices;
        float detuneCents = p.uniDetune * 60.0f;
        float width = p.uniWidth;

        if (op.wave == Supersaw)
        {
            count = maxUnison;
            detuneCents = juce::jmax (detuneCents, 10.0f + 50.0f * s.shape);
            width = juce::jmax (width, 0.6f);
        }
        if (op.wave == Noise)
            count = 1;

        s.count = count;
        const float freq = 440.0f * std::pow (2.0f, (baseNote + op.semis - 69.0f) / 12.0f);
        const float norm = 1.0f / std::sqrt ((float) count);

        for (int k = 0; k < count; ++k)
        {
            const float t = count == 1 ? 0.0f : -1.0f + 2.0f * (float) k / (float) (count - 1);
            const float f = freq * std::pow (2.0f, t * detuneCents / 1200.0f);
            s.inc[k] = juce::jlimit (0.0f, 0.49f, f / fs);
            const float pan = 0.5f + 0.5f * t * width; // 0..1
            s.gainL[k] = norm * std::cos (pan * juce::MathConstants<float>::halfPi) * juce::MathConstants<float>::sqrt2;
            s.gainR[k] = norm * std::sin (pan * juce::MathConstants<float>::halfPi) * juce::MathConstants<float>::sqrt2;
        }
    }

    // ---- filter setup ----
    const float velScale = 1.0f - p.velCutoff * (1.0f - velocity);
    const float baseOct = std::log2 (cutoffHz (p.cutoff))
                        + p.keytrack * ((float) note - 60.0f) / 12.0f
                        + lfoCut
                        + p.velCutoff * (velocity - 1.0f) * 2.0f;
    const float k1 = 2.0f - 1.94f * p.reso;
    const float k2 = 1.4142f;
    const float driveGain = 1.0f + 5.0f * p.drive;
    const float driveComp = 1.0f / (1.0f + 1.5f * p.drive);
    const float ampVel = 1.0f - p.velAmp * (1.0f - velocity);
    const float voiceGain = 0.35f * ampVel * lfoVolume;
    const float maxFc = 0.45f * fs;

    float g = 0.0f;

    for (int i = 0; i < numSamples; ++i)
    {
        float l = 0.0f, r = 0.0f;

        for (int o = 0; o < numOscillators; ++o)
        {
            auto& s = stacks[o];
            if (s.count == 0) continue;

            float ol = 0.0f, orr = 0.0f;

            if (s.wave == Noise)
            {
                const float white = random.nextFloat() * 2.0f - 1.0f;
                const float coeff = 0.05f + 0.95f * (1.0f - s.shape);
                noiseState[(size_t) o] += coeff * (white - noiseState[(size_t) o]);
                ol = orr = noiseState[(size_t) o];
            }
            else
            {
                auto& ph = phase[(size_t) o];
                for (int k = 0; k < s.count; ++k)
                {
                    const float t = ph[(size_t) k];
                    const float dt = s.inc[k];
                    float v = 0.0f;

                    switch (s.wave)
                    {
                        case Saw:
                        case Supersaw: v = sawWave (t, dt); break;
                        case Square:   v = pulseWave (t, dt, 0.5f + 0.45f * s.shape); break;
                        case Sine:     v = std::sin (twoPi * t + s.shape * 1.5f * std::sin (twoPi * t)); break;
                        case Triangle: v = triWave (t); break;
                        case Wavetable:
                        {
                            const float m = s.shape * 3.0f;
                            const int seg = juce::jmin (2, (int) m);
                            const float x = m - (float) seg;
                            float a, b;
                            if (seg == 0)      { a = std::sin (twoPi * t); b = triWave (t); }
                            else if (seg == 1) { a = triWave (t);          b = sawWave (t, dt); }
                            else               { a = sawWave (t, dt);      b = pulseWave (t, dt, 0.5f); }
                            v = a + x * (b - a);
                            break;
                        }
                        default: break;
                    }

                    ol  += v * s.gainL[k];
                    orr += v * s.gainR[k];
                    ph[(size_t) k] = wrap01 (t + dt);
                }

                if (s.wave == Saw || s.wave == Triangle)
                {
                    ol  = softSat (ol, s.shape);
                    orr = softSat (orr, s.shape);
                }
            }

            l += ol * s.level;
            r += orr * s.level;
        }

        // ---- filter (coefficients refreshed every 8 samples) ----
        const float fenv = filterEnv.getNextSample();
        if ((i & 7) == 0)
        {
            const float oct = baseOct + p.envAmount * 7.0f * fenv * velScale;
            const float fc = juce::jlimit (20.0f, maxFc, std::exp2 (oct));
            g = std::tan (juce::MathConstants<float>::pi * fc / fs);
        }

        float in[2] = { std::tanh (l * driveGain) * driveComp, std::tanh (r * driveGain) * driveComp };
        float out[2];

        for (int c = 0; c < 2; ++c)
        {
            float lp, bp, hp;
            svf[c][0].process (in[c], g, k1, lp, bp, hp);
            if (p.fltMode == LP24)      { float lp2, bp2, hp2; svf[c][1].process (lp, g, k2, lp2, bp2, hp2); out[c] = lp2; }
            else if (p.fltMode == HP)   { float lp2, bp2, hp2; svf[c][1].process (hp, g, k2, lp2, bp2, hp2); out[c] = hp2; }
            else                        { out[c] = bp * k1; }
        }

        const float amp = ampEnv.getNextSample() * voiceGain;
        left[i]  += out[0] * amp;
        right[i] += out[1] * amp;
    }

    if (! ampEnv.isActive())
        kill();
}
} // namespace rato
