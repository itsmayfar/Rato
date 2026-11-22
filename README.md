# RATO — by MAYFAR

*Where sound becomes feeling.*

RATO is a 4-oscillator synthesizer for House, Deep House and EDM, with 515 factory presets.
Formats: **VST3**, **Audio Unit (AU)** and **Standalone** for macOS 11+ (Apple Silicon and Intel).

## Engine
- 4 oscillators: Saw, Square, Sine, Triangle, Supersaw, Noise, Wavetable (anti-aliased)
- Unison up to 7 voices with detune and stereo width
- Filter LP24 / HP / BP with resonance, drive, envelope, keytracking and velocity
- Amp envelope, LFO (cutoff, pitch, shape, volume), arpeggiator synced to the host tempo
- Mono mode with glide, sustain pedal, pitch bend, mod wheel
- FX: distortion, chorus, ping-pong delay (tempo-synced), reverb with low cut
- 16-voice polyphony, loudness-matched presets, user presets in `~/Music/RATO Presets`

## Presets
Emotional House 60 · Deep House 60 · Bass 60 · EDM 50 · Pluck 50 · Arp 50 · Pad 40 · Lead 40 · FX 40 · Brass 30 · Keys 20 · Piano 15

## Building
Every push to `main` builds a universal macOS installer with GitHub Actions
(`.github/workflows/build-macos.yml`), validates it with `auval` and `pluginval`,
and publishes the result to the `builds` branch.

Local build on a Mac (Xcode + CMake):

```
cmake -B build -G Xcode -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64"
cmake --build build --config Release
```

Fonts used in the interface (Kaushan Script, Lexend Exa) are licensed under the SIL Open Font License
and are downloaded at build time.

© MAYFAR
