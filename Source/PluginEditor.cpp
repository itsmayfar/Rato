#include "PluginEditor.h"
#include "BinaryData.h"

namespace rato::ui
{
// ============================================================== fonts

namespace
{
    juce::Typeface::Ptr loadTypeface (const char* filenamePart)
    {
        for (int i = 0; i < BinaryData::namedResourceListSize; ++i)
        {
            if (juce::String (BinaryData::originalFilenames[i]).containsIgnoreCase (filenamePart))
            {
                int size = 0;
                if (auto* data = BinaryData::getNamedResource (BinaryData::namedResourceList[i], size))
                    return juce::Typeface::createSystemTypefaceFor (data, (size_t) size);
            }
        }
        return nullptr;
    }

    juce::Font fontFrom (const juce::Typeface::Ptr& tf, float height, bool bold = false)
    {
        auto options = juce::FontOptions (height, bold ? juce::Font::bold : juce::Font::plain);
        if (tf != nullptr)
            options = options.withTypeface (tf);
        return juce::Font (options);
    }

    juce::Image loadLogo()
    {
        return juce::ImageCache::getFromMemory (BinaryData::mayfar_logo_png, BinaryData::mayfar_logo_pngSize);
    }
}

juce::Font scriptFont (float height) { static auto tf = loadTypeface ("Kaushan"); return fontFrom (tf, height); }
juce::Font brandFont (float height)  { static auto tf = loadTypeface ("Lexend");  return fontFrom (tf, height); }
juce::Font uiFont (float height, bool bold) { return juce::Font (juce::FontOptions (height, bold ? juce::Font::bold : juce::Font::plain)); }

// ============================================================== look and feel

LookAndFeel::LookAndFeel()
{
    setColour (juce::PopupMenu::backgroundColourId, colour::panel);
    setColour (juce::PopupMenu::textColourId, colour::text);
    setColour (juce::PopupMenu::highlightedBackgroundColourId, colour::red);
    setColour (juce::PopupMenu::highlightedTextColourId, colour::white);
    setColour (juce::PopupMenu::headerTextColourId, colour::dim);
    setColour (juce::ComboBox::textColourId, colour::white);
    setColour (juce::TextButton::textColourOffId, colour::text);
    setColour (juce::TextButton::textColourOnId, colour::white);
    setColour (juce::ToggleButton::textColourId, colour::text);
    setColour (juce::BubbleComponent::backgroundColourId, colour::bg);
    setColour (juce::BubbleComponent::outlineColourId, colour::red);
    setColour (juce::TooltipWindow::textColourId, colour::white);
}

void LookAndFeel::drawRotarySlider (juce::Graphics& g, int x, int y, int w, int h, float pos,
                                    float start, float end, juce::Slider& s)
{
    const auto bounds = juce::Rectangle<float> ((float) x, (float) y, (float) w, (float) h);
    const float radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) * 0.5f - 3.0f;
    const auto c = bounds.getCentre();
    const float angle = start + pos * (end - start);
    const bool whiteAccent = (bool) s.getProperties()["whiteAccent"];
    const bool bipolar = (bool) s.getProperties()["bipolar"];
    const auto arcColour = whiteAccent ? colour::white : colour::red;
    const auto pointerColour = whiteAccent ? colour::red : colour::white;

    juce::Path track;
    track.addCentredArc (c.x, c.y, radius, radius, 0.0f, start, end, true);
    g.setColour (colour::border);
    g.strokePath (track, juce::PathStrokeType (3.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    const float from = bipolar ? (start + end) * 0.5f : start;
    if (std::abs (angle - from) > 0.01f)
    {
        juce::Path value;
        value.addCentredArc (c.x, c.y, radius, radius, 0.0f, juce::jmin (from, angle), juce::jmax (from, angle), true);
        g.setColour (s.isEnabled() ? arcColour : colour::dim);
        g.strokePath (value, juce::PathStrokeType (3.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    }

    const float inner = radius * 0.72f;
    g.setColour (colour::knobFace);
    g.fillEllipse (c.x - inner, c.y - inner, inner * 2.0f, inner * 2.0f);
    g.setColour (s.isMouseOverOrDragging() ? colour::dim : colour::ring);
    g.drawEllipse (c.x - inner, c.y - inner, inner * 2.0f, inner * 2.0f, 1.0f);

    const auto tip = c.getPointOnCircumference (inner * 0.85f, angle);
    const auto base = c.getPointOnCircumference (inner * 0.2f, angle);
    g.setColour (pointerColour);
    g.drawLine ({ base, tip }, 2.0f);
}

void LookAndFeel::drawComboBox (juce::Graphics& g, int w, int h, bool, int, int, int, int, juce::ComboBox& box)
{
    const auto r = juce::Rectangle<float> (0, 0, (float) w, (float) h).reduced (0.5f);
    g.setColour (colour::bg);
    g.fillRoundedRectangle (r, 5.0f);
    g.setColour (box.isMouseOver() ? colour::dim : colour::ring);
    g.drawRoundedRectangle (r, 5.0f, 1.0f);

    juce::Path arrow;
    const float ax = (float) w - 12.0f, ay = (float) h * 0.5f;
    arrow.addTriangle (ax - 4.0f, ay - 2.0f, ax + 4.0f, ay - 2.0f, ax, ay + 3.0f);
    g.setColour (colour::red);
    g.fillPath (arrow);
}

void LookAndFeel::positionComboBoxText (juce::ComboBox& box, juce::Label& label)
{
    label.setBounds (4, 0, box.getWidth() - 20, box.getHeight());
    label.setFont (getComboBoxFont (box));
    label.setJustificationType (juce::Justification::centredLeft);
}

void LookAndFeel::drawButtonBackground (juce::Graphics& g, juce::Button& b, const juce::Colour&, bool over, bool down)
{
    const auto r = b.getLocalBounds().toFloat().reduced (0.5f);
    if (b.getToggleState())
    {
        g.setColour (colour::red);
        g.fillRoundedRectangle (r, 5.0f);
        return;
    }
    g.setColour (down ? colour::border : colour::bg);
    g.fillRoundedRectangle (r, 5.0f);
    g.setColour (over ? colour::dim : colour::ring);
    g.drawRoundedRectangle (r, 5.0f, 1.0f);
}

void LookAndFeel::drawToggleButton (juce::Graphics& g, juce::ToggleButton& b, bool over, bool)
{
    const float d = 10.0f;
    const float cy = (float) b.getHeight() * 0.5f;
    const juce::Rectangle<float> led (2.0f, cy - d * 0.5f, d, d);

    if (b.getToggleState())
    {
        g.setColour (colour::red);
        g.fillEllipse (led);
    }
    g.setColour (b.getToggleState() ? colour::red : (over ? colour::dim : colour::ring));
    g.drawEllipse (led, 1.2f);

    g.setColour (b.getToggleState() ? colour::white : colour::text);
    g.setFont (uiFont (12.0f));
    g.drawText (b.getButtonText(), juce::Rectangle<float> (d + 8.0f, 0.0f, (float) b.getWidth() - d - 8.0f, (float) b.getHeight()),
                juce::Justification::centredLeft);
}

void LookAndFeel::drawPopupMenuBackground (juce::Graphics& g, int w, int h)
{
    g.fillAll (colour::panel);
    g.setColour (colour::border);
    g.drawRect (0, 0, w, h);
}

void LookAndFeel::drawBubble (juce::Graphics& g, juce::BubbleComponent&, const juce::Point<float>&, const juce::Rectangle<float>& body)
{
    g.setColour (colour::bg);
    g.fillRoundedRectangle (body, 4.0f);
    g.setColour (colour::red);
    g.drawRoundedRectangle (body, 4.0f, 1.0f);
}

// ============================================================== knob

Knob::Knob (juce::AudioProcessorValueTreeState& state, const juce::String& paramId, const juce::String& text, bool accentWhite)
    : caption (text)
{
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::NoTextBox, false, 0, 0);
    slider.getProperties().set ("whiteAccent", accentWhite);
    slider.setMouseDragSensitivity (220);
    addAndMakeVisible (slider);

    attachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment> (state, paramId, slider);

    if (auto* param = state.getParameter (paramId))
    {
        slider.setDoubleClickReturnValue (true, (double) param->convertFrom0to1 (param->getDefaultValue()));
        slider.setTooltip (param->getName (64));
    }
}

void Knob::parentHierarchyChanged()
{
    if (auto* top = getTopLevelComponent(); top != nullptr && top != this)
        slider.setPopupDisplayEnabled (true, true, top, 800);
}

void Knob::resized()
{
    slider.setBounds (getLocalBounds().withTrimmedBottom (16));
}

void Knob::paint (juce::Graphics& g)
{
    g.setColour (colour::text);
    g.setFont (uiFont (11.0f));
    g.drawText (caption, getLocalBounds().removeFromBottom (16), juce::Justification::centred);
}

// ============================================================== displays

Display::Display (juce::AudioProcessorValueTreeState& s, Kind k, int index) : state (s), kind (k), oscIndex (index)
{
    setInterceptsMouseClicks (false, false);
}

void Display::paint (juce::Graphics& g)
{
    auto r = getLocalBounds().toFloat();
    g.setColour (colour::bg);
    g.fillRoundedRectangle (r, 4.0f);
    g.setColour (colour::border);
    g.drawRoundedRectangle (r.reduced (0.5f), 4.0f, 1.0f);

    auto area = r.reduced (6.0f, 5.0f);
    juce::Path path;
    const int points = 120;
    auto toY = [&] (float v) { return area.getCentreY() - v * area.getHeight() * 0.5f; };
    auto toYUnit = [&] (float v) { return area.getBottom() - v * area.getHeight(); };
    juce::Colour stroke = colour::red;

    if (kind == Kind::Oscillator)
    {
        const int wave = (int) value (id::osc (oscIndex, "wave"));
        const float shape = value (id::osc (oscIndex, "shape"));
        const bool on = value (id::osc (oscIndex, "level")) > 0.0001f;
        stroke = on ? ((oscIndex % 2) == 0 ? colour::red : colour::white) : colour::ring;
        juce::Random rnd (7);

        for (int i = 0; i <= points; ++i)
        {
            const float x = (float) i / (float) points;
            const float t = std::fmod (x * 2.0f, 1.0f);
            const float tw = juce::MathConstants<float>::twoPi;
            float v = 0.0f;
            switch (wave)
            {
                case Saw:      v = std::tanh ((2.0f * t - 1.0f) * (1.0f + 3.0f * shape)) / std::tanh (1.0f + 3.0f * shape); break;
                case Supersaw: v = 0.6f * (2.0f * t - 1.0f) + 0.4f * (2.0f * std::fmod (t * 1.02f + 0.3f, 1.0f) - 1.0f); break;
                case Square:   v = t < 0.5f + 0.45f * shape ? 0.85f : -0.85f; break;
                case Sine:     v = std::sin (tw * t + shape * 1.5f * std::sin (tw * t)); break;
                case Triangle: v = 1.0f - 4.0f * std::abs (t - 0.5f); break;
                case Noise:    v = (rnd.nextFloat() * 2.0f - 1.0f) * (0.3f + 0.7f * (1.0f - shape)); break;
                case Wavetable:
                {
                    const float m = shape * 3.0f;
                    const int seg = juce::jmin (2, (int) m);
                    const float f = m - (float) seg;
                    const float sine = std::sin (tw * t), tri = 1.0f - 4.0f * std::abs (t - 0.5f), saw = 2.0f * t - 1.0f, sq = t < 0.5f ? 1.0f : -1.0f;
                    const float a = seg == 0 ? sine : (seg == 1 ? tri : saw);
                    const float b = seg == 0 ? tri  : (seg == 1 ? saw : sq);
                    v = a + f * (b - a);
                    break;
                }
                default: break;
            }
            const auto px = area.getX() + x * area.getWidth();
            const auto py = toY (v * 0.85f);
            if (i == 0) path.startNewSubPath (px, py); else path.lineTo (px, py);
        }
    }
    else if (kind == Kind::Filter)
    {
        const int mode = (int) value (id::fltMode);
        const float fc = cutoffHz (value (id::fltCutoff));
        const float q = 1.0f / juce::jmax (0.06f, 2.0f - 1.94f * value (id::fltReso));
        for (int i = 0; i <= points; ++i)
        {
            const float x = (float) i / (float) points;
            const float f = 20.0f * std::pow (1000.0f, x);
            const float w = f / fc;
            const float den = std::sqrt ((1.0f - w * w) * (1.0f - w * w) + (w / q) * (w / q));
            const float den2 = std::sqrt ((1.0f - w * w) * (1.0f - w * w) + (w * 1.4142f) * (w * 1.4142f));
            float mag;
            if (mode == LP24)     mag = (1.0f / den) * (1.0f / den2);
            else if (mode == HP)  mag = (w * w / den) * (w * w / den2);
            else                  mag = (w / q) / den * (2.0f - 1.94f * value (id::fltReso));
            const float db = juce::jlimit (-36.0f, 18.0f, juce::Decibels::gainToDecibels (mag, -60.0f));
            const auto px = area.getX() + x * area.getWidth();
            const auto py = toYUnit ((db + 36.0f) / 54.0f);
            if (i == 0) path.startNewSubPath (px, py); else path.lineTo (px, py);
        }
    }
    else if (kind == Kind::Envelope)
    {
        stroke = colour::white;
        const float a = envTimeSeconds (value (id::attack)), d = envTimeSeconds (value (id::decay));
        const float s = value (id::sustain), rel = envTimeSeconds (value (id::release));
        const float hold = 0.25f * (a + d + rel) + 0.05f;
        const float total = a + d + hold + rel;
        auto px = [&] (float tSec) { return area.getX() + tSec / total * area.getWidth(); };
        path.startNewSubPath (px (0), toYUnit (0));
        path.lineTo (px (a), toYUnit (1.0f));
        path.quadraticTo (px (a + d * 0.2f), toYUnit (s), px (a + d), toYUnit (s));
        path.lineTo (px (a + d + hold), toYUnit (s));
        path.quadraticTo (px (a + d + hold + rel * 0.2f), toYUnit (0), px (total), toYUnit (0));
    }
    else // LFO
    {
        const float amount = juce::jmax (0.12f, value (id::lfoAmount));
        const float cycles = 1.0f + value (id::lfoRate) * 5.0f;
        for (int i = 0; i <= points; ++i)
        {
            const float x = (float) i / (float) points;
            const auto px = area.getX() + x * area.getWidth();
            const auto py = toY (amount * 0.9f * std::sin (juce::MathConstants<float>::twoPi * cycles * x));
            if (i == 0) path.startNewSubPath (px, py); else path.lineTo (px, py);
        }
    }

    g.saveState();
    g.reduceClipRegion (area.toNearestInt().expanded (1));
    g.setColour (stroke);
    g.strokePath (path, juce::PathStrokeType (1.6f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.restoreState();
}

// ============================================================== preset bar

PresetBar::PresetBar (RatoProcessor& p) : proc (p)
{
    setMouseCursor (juce::MouseCursor::PointingHandCursor);
    refresh();
}

void PresetBar::refresh()
{
    auto& pm = proc.presets;
    const auto name = pm.getCurrentName();
    juce::String info = pm.getCurrentCategory().toUpperCase();
    if (pm.getUserPresetName().isEmpty())
        info << "  -  " << juce::String (pm.getCurrentIndex() + 1).paddedLeft ('0', 3) << " / " << pm.getNumPresets();

    if (name != shownName || info != shownInfo)
    {
        shownName = name;
        shownInfo = info;
        repaint();
    }
}

void PresetBar::paint (juce::Graphics& g)
{
    auto r = getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (juce::Colour (0xff121212));
    g.fillRoundedRectangle (r, 8.0f);
    g.setColour (isMouseOver (true) ? colour::ring : colour::border);
    g.drawRoundedRectangle (r, 8.0f, 1.0f);

    const float cy = r.getCentreY();
    juce::Path left, right;
    left.addTriangle (18.0f, cy, 27.0f, cy - 7.0f, 27.0f, cy + 7.0f);
    right.addTriangle (r.getRight() - 18.0f, cy, r.getRight() - 27.0f, cy - 7.0f, r.getRight() - 27.0f, cy + 7.0f);
    g.setColour (colour::red);
    g.fillPath (left);
    g.fillPath (right);

    auto text = getLocalBounds().reduced (40, 5);
    g.setColour (colour::dim);
    g.setFont (uiFont (10.0f).withExtraKerningFactor (0.15f));
    g.drawText (shownInfo, text.removeFromTop (text.getHeight() / 2 - 2), juce::Justification::centredBottom);
    g.setColour (colour::white);
    g.setFont (uiFont (17.0f, true));
    g.drawFittedText (shownName, text, juce::Justification::centredTop, 1);
}

void PresetBar::mouseUp (const juce::MouseEvent& e)
{
    if (e.x < 40)                       proc.presets.previous();
    else if (e.x > getWidth() - 40)     proc.presets.next();
    else                                showMenu();
    refresh();
}

void PresetBar::showMenu()
{
    auto& pm = proc.presets;
    juce::PopupMenu menu;

    for (const auto& category : pm.getCategories())
    {
        juce::PopupMenu sub;
        for (int i = 0; i < pm.getNumPresets(); ++i)
            if (pm.getPreset (i).category == category)
                sub.addItem (i + 1, pm.getPreset (i).name, true, pm.getUserPresetName().isEmpty() && i == pm.getCurrentIndex());
        menu.addSubMenu (category, sub);
    }

    const auto userFiles = pm.getUserPresets();
    juce::PopupMenu user;
    for (int i = 0; i < userFiles.size(); ++i)
        user.addItem (10000 + i, userFiles[i].getFileNameWithoutExtension());
    menu.addSeparator();
    menu.addSubMenu ("User presets", user, ! userFiles.isEmpty());
    menu.addItem (20001, "Open presets folder");

    menu.setLookAndFeel (&getLookAndFeel());
    juce::Component::SafePointer<PresetBar> safe (this);
    menu.showMenuAsync (juce::PopupMenu::Options().withTargetComponent (this).withMaximumNumColumns (2),
                        [safe, userFiles] (int result)
    {
        if (safe == nullptr || result == 0) return;
        auto& presets = safe->proc.presets;

        if (result >= 20001)
        {
            auto folder = presets.getUserPresetFolder();
            folder.createDirectory();
            folder.revealToUser();
        }
        else if (result >= 10000)
            presets.loadUserPreset (userFiles[result - 10000]);
        else
            presets.loadPreset (result - 1);

        safe->refresh();
    });
}

// ============================================================== main content

Content::Content (RatoProcessor& p)
    : proc (p), apvts (p.apvts), presetBar (p),
      master (apvts, id::master, "Master"),
      filterDisplay (apvts, Display::Kind::Filter),
      envDisplay (apvts, Display::Kind::Envelope),
      lfoDisplay (apvts, Display::Kind::Lfo),
      cutoff (apvts, id::fltCutoff, "Cutoff"), reso (apvts, id::fltReso, "Reso"),
      drive (apvts, id::fltDrive, "Drive"), fenv (apvts, id::fltEnv, "Env"),
      attack (apvts, id::attack, "Attack", true), decay (apvts, id::decay, "Decay", true),
      sustain (apvts, id::sustain, "Sustain", true), release (apvts, id::release, "Release", true),
      lfoRate (apvts, id::lfoRate, "Rate"), lfoAmount (apvts, id::lfoAmount, "Amount", true),
      uniVoices (apvts, id::uniVoices, "Voices"), uniDetune (apvts, id::uniDetune, "Detune", true),
      uniWidth (apvts, id::uniWidth, "Width"),
      glide (apvts, id::glide, "Glide"), arpOctaves (apvts, id::arpOctaves, "Octaves", true),
      velAmp (apvts, id::velAmp, "Vel > Amp"), velCutoff (apvts, id::velCutoff, "Vel > Cut", true),
      keytrack (apvts, id::fltKeytrack, "Keytrack"),
      reverb (apvts, id::fxReverb, "Reverb"), size (apvts, id::fxSize, "Size", true),
      delay (apvts, id::fxDelay, "Delay"), chorusKnob (apvts, id::fxChorus, "Chorus", true),
      dist (apvts, id::fxDist, "Distort"), lowCut (apvts, id::fxLowCut, "Low Cut", true),
      mix (apvts, id::fxMix, "Mix"),
      keyboard (p.keyboardState, juce::MidiKeyboardComponent::horizontalKeyboard)
{
    addAndMakeVisible (presetBar);
    addAndMakeVisible (browseButton);
    addAndMakeVisible (saveButton);
    addAndMakeVisible (master);
    browseButton.onClick = [this] { presetBar.showMenu(); };
    saveButton.onClick = [this] { savePreset(); };

    for (int i = 0; i < numOscillators; ++i)
    {
        auto& o = oscs[(size_t) i];
        const bool white = (i % 2) == 1;
        o.wave = std::make_unique<juce::ComboBox>();
        o.wave->addItemList (waveNames, 1);
        o.waveAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (apvts, id::osc (i, "wave"), *o.wave);
        o.display = std::make_unique<Display> (apvts, Display::Kind::Oscillator, i);
        o.pitch = std::make_unique<Knob> (apvts, id::osc (i, "pitch"), "Pitch", white);
        o.fine  = std::make_unique<Knob> (apvts, id::osc (i, "fine"),  "Fine",  ! white);
        o.shape = std::make_unique<Knob> (apvts, id::osc (i, "shape"), "Shape", white);
        o.level = std::make_unique<Knob> (apvts, id::osc (i, "level"), "Level", ! white);
        o.pitch->slider.getProperties().set ("bipolar", true);
        o.fine->slider.getProperties().set ("bipolar", true);
        for (juce::Component* c : { (juce::Component*) o.wave.get(), (juce::Component*) o.display.get(),
                                    (juce::Component*) o.pitch.get(), (juce::Component*) o.fine.get(),
                                    (juce::Component*) o.shape.get(), (juce::Component*) o.level.get() })
            addAndMakeVisible (c);
    }

    for (int i = 0; i < 3; ++i)
    {
        auto& b = filterButtons[(size_t) i];
        b.setButtonText (filterModes[i]);
        b.setClickingTogglesState (false);
        b.onClick = [this, i]
        {
            if (auto* param = apvts.getParameter (id::fltMode))
                param->setValueNotifyingHost (param->convertTo0to1 ((float) i));
        };
        addAndMakeVisible (b);
    }

    lfoTarget.addItemList (lfoTargets, 1);
    lfoTargetAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (apvts, id::lfoTarget, lfoTarget);
    arpRate.addItemList (arpRates, 1);
    arpRateAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (apvts, id::arpRate, arpRate);
    monoAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (apvts, id::mono, monoButton);
    arpAttachment  = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (apvts, id::arpOn, arpButton);

    for (juce::Component* c : std::initializer_list<juce::Component*> {
             &filterDisplay, &envDisplay, &lfoDisplay, &cutoff, &reso, &drive, &fenv, &keytrack,
             &attack, &decay, &sustain, &release, &lfoRate, &lfoAmount, &lfoTarget,
             &uniVoices, &uniDetune, &uniWidth, &monoButton, &glide, &arpButton, &arpRate, &arpOctaves,
             &velAmp, &velCutoff, &reverb, &size, &delay, &chorusKnob, &dist, &lowCut, &mix, &keyboard })
        addAndMakeVisible (c);

    keyboard.setColour (juce::MidiKeyboardComponent::whiteNoteColourId, colour::white);
    keyboard.setColour (juce::MidiKeyboardComponent::blackNoteColourId, colour::bg);
    keyboard.setColour (juce::MidiKeyboardComponent::keySeparatorLineColourId, juce::Colour (0xff9a9a9a));
    keyboard.setColour (juce::MidiKeyboardComponent::keyDownOverlayColourId, colour::red);
    keyboard.setColour (juce::MidiKeyboardComponent::mouseOverKeyOverlayColourId, colour::red.withAlpha (0.35f));
    keyboard.setColour (juce::MidiKeyboardComponent::shadowColourId, juce::Colours::transparentBlack);
    keyboard.setColour (juce::MidiKeyboardComponent::upDownButtonBackgroundColourId, colour::panel);
    keyboard.setColour (juce::MidiKeyboardComponent::upDownButtonArrowColourId, colour::red);
    keyboard.setWantsKeyboardFocus (false);
    keyboard.setLowestVisibleKey (36);
    keyboard.setOctaveForMiddleC (4);

    logo = loadLogo();
    setSize (baseWidth, baseHeight);
    startTimerHz (30);
}

void Content::timerCallback()
{
    presetBar.refresh();
    const int mode = (int) apvts.getRawParameterValue (id::fltMode)->load();
    for (int i = 0; i < 3; ++i)
        filterButtons[(size_t) i].setToggleState (i == mode, juce::dontSendNotification);

    const bool arpOn = apvts.getRawParameterValue (id::arpOn)->load() > 0.5f;
    arpRate.setEnabled (arpOn);
    arpOctaves.setEnabled (arpOn);
    glide.setEnabled (apvts.getRawParameterValue (id::mono)->load() > 0.5f);

    for (auto& o : oscs) o.display->repaint();
    filterDisplay.repaint();
    envDisplay.repaint();
    lfoDisplay.repaint();
}

void Content::savePreset()
{
    auto folder = PresetManager::getUserPresetFolder();
    folder.createDirectory();
    chooser = std::make_unique<juce::FileChooser> ("Save RATO preset",
                                                   folder.getChildFile (proc.presets.getCurrentName() + ".ratopreset"),
                                                   "*.ratopreset");
    juce::Component::SafePointer<Content> safe (this);
    chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles
                              | juce::FileBrowserComponent::warnAboutOverwriting,
                          [safe] (const juce::FileChooser& fc)
    {
        if (safe == nullptr) return;
        auto file = fc.getResult();
        if (file == juce::File()) return;
        safe->proc.presets.saveUserPreset (file.withFileExtension ("ratopreset"));
        safe->presetBar.refresh();
    });
}

void Content::panel (juce::Graphics& g, juce::Rectangle<int> r, const juce::String& title) const
{
    g.setColour (colour::panel);
    g.fillRoundedRectangle (r.toFloat(), 8.0f);
    g.setColour (colour::border);
    g.drawRoundedRectangle (r.toFloat().reduced (0.5f), 8.0f, 1.0f);
    g.setColour (colour::red);
    g.setFont (uiFont (13.0f, true).withExtraKerningFactor (0.08f));
    g.drawText (title, r.getX() + 14, r.getY() + 8, 160, 18, juce::Justification::centredLeft);
}

void Content::paint (juce::Graphics& g)
{
    g.fillAll (colour::bg);

    // header
    {
        juce::Graphics::ScopedSaveState s (g);
        g.addTransform (juce::AffineTransform::rotation (-0.07f, 100.0f, 40.0f));
        g.setColour (colour::red);
        g.setFont (scriptFont (52.0f));
        g.drawText ("Rato", 26, 0, 170, 74, juce::Justification::centredLeft);
    }

    auto badge = juce::Rectangle<float> (176.0f, 26.0f, 118.0f, 26.0f);
    g.setColour (colour::red);
    g.fillRoundedRectangle (badge, 6.0f);
    g.setColour (colour::white);
    g.setFont (uiFont (11.0f, true).withExtraKerningFactor (0.08f));
    g.drawText (juce::String (proc.presets.getNumPresets()) + " PRESETS", badge, juce::Justification::centred);

    g.setColour (colour::border);
    g.drawHorizontalLine (78, 16.0f, (float) getWidth() - 16.0f);

    for (int i = 0; i < numOscillators; ++i)
        panel (g, oscBounds[(size_t) i], "OSC " + juce::String (i + 1));
    panel (g, filterBounds, "FILTER");
    panel (g, envBounds, "AMP ENVELOPE");
    panel (g, lfoBounds, "LFO");
    panel (g, uniBounds, "UNISON");
    panel (g, voiceBounds, "VOICE  /  ARP");
    panel (g, fxBounds, "FX");

    // footer: MADE BY + logo + wordmark
    auto f = footerBounds;
    g.setColour (colour::dim);
    g.setFont (uiFont (10.0f).withExtraKerningFactor (0.4f));
    g.drawText ("MADE BY", f.removeFromTop (14), juce::Justification::centred);

    const auto word = juce::String (juce::CharPointer_UTF8 ("M\xce\x9bYF\xce\x9bR"));
    const auto font = brandFont (22.0f).withExtraKerningFactor (0.55f);
    juce::GlyphArrangement ga;
    ga.addLineOfText (font, word, 0.0f, 0.0f);
    const float wordWidth = ga.getBoundingBox (0, -1, true).getWidth();
    const float logoSize = 30.0f;
    const float total = logoSize + 12.0f + wordWidth;
    float x = (float) f.getCentreX() - total * 0.5f;

    if (logo.isValid())
        g.drawImage (logo, juce::Rectangle<float> (x, (float) f.getY() + 2.0f, logoSize * 0.94f, logoSize), juce::RectanglePlacement::centred);
    x += logoSize + 12.0f;
    g.setColour (juce::Colour (0xffe6e6e6));
    g.setFont (font);
    g.drawText (word, juce::Rectangle<float> (x, (float) f.getY(), wordWidth + 20.0f, (float) f.getHeight()), juce::Justification::centredLeft);
}

void Content::resized()
{
    const int margin = 16, gap = 12;
    auto knobRow = [] (juce::Rectangle<int> area, std::initializer_list<juce::Component*> items)
    {
        const int w = area.getWidth() / (int) items.size();
        for (auto* c : items)
            c->setBounds (area.removeFromLeft (w).withSizeKeepingCentre (juce::jmin (w, 62), area.getHeight()));
    };

    // header
    presetBar.setBounds (380, 14, 360, 50);
    browseButton.setBounds (760, 26, 68, 26);
    saveButton.setBounds (836, 26, 58, 26);
    master.setBounds (getWidth() - margin - 70, 6, 62, 66);

    // oscillator row
    const int oscW = (getWidth() - 2 * margin - 3 * gap) / 4;
    for (int i = 0; i < numOscillators; ++i)
    {
        auto r = juce::Rectangle<int> (margin + i * (oscW + gap), 90, oscW, 156);
        oscBounds[(size_t) i] = r;
        auto& o = oscs[(size_t) i];
        auto inner = r.reduced (12, 8);
        auto top = inner.removeFromTop (44);
        o.wave->setBounds (top.getX() + 2, top.getY() + 22, 96, 20);
        o.display->setBounds (top.removeFromRight (oscW - 130).withTrimmedTop (2));
        knobRow (inner.withTrimmedTop (8), { o.pitch.get(), o.fine.get(), o.shape.get(), o.level.get() });
    }

    // second row
    int x = margin;
    const int rowY = 258, rowH = 156;
    filterBounds = { x, rowY, 330, rowH };  x += 330 + gap;
    envBounds    = { x, rowY, 300, rowH };  x += 300 + gap;
    lfoBounds    = { x, rowY, 206, rowH };  x += 206 + gap;
    uniBounds    = { x, rowY, getWidth() - margin - x, rowH };

    {
        auto inner = filterBounds.reduced (12, 8);
        auto top = inner.removeFromTop (20);
        top.removeFromLeft (70);
        for (auto& b : filterButtons) { b.setBounds (top.removeFromLeft (52).reduced (2, 0)); }
        filterDisplay.setBounds (inner.removeFromTop (38).withTrimmedTop (4));
        knobRow (inner.withTrimmedTop (8), { &cutoff, &reso, &drive, &fenv, &keytrack });
    }
    {
        auto inner = envBounds.reduced (12, 8);
        inner.removeFromTop (20);
        envDisplay.setBounds (inner.removeFromTop (38).withTrimmedTop (4));
        knobRow (inner.withTrimmedTop (8), { &attack, &decay, &sustain, &release });
    }
    {
        auto inner = lfoBounds.reduced (12, 8);
        auto top = inner.removeFromTop (20);
        lfoTarget.setBounds (top.removeFromRight (90));
        lfoDisplay.setBounds (inner.removeFromTop (38).withTrimmedTop (4));
        knobRow (inner.withTrimmedTop (8), { &lfoRate, &lfoAmount });
    }
    {
        auto inner = uniBounds.reduced (12, 8);
        inner.removeFromTop (34);
        knobRow (inner.withTrimmedTop (16), { &uniVoices, &uniDetune, &uniWidth });
    }

    // third row
    const int row3Y = rowY + rowH + gap, row3H = 118;
    voiceBounds = { margin, row3Y, 470, row3H };
    fxBounds    = { margin + 470 + gap, row3Y, getWidth() - 2 * margin - 470 - gap, row3H };
    {
        auto inner = voiceBounds.reduced (12, 8);
        inner.removeFromTop (22);
        auto toggles = inner.removeFromLeft (110);
        monoButton.setBounds (toggles.removeFromTop (26));
        arpButton.setBounds (toggles.removeFromTop (26));
        arpRate.setBounds (toggles.removeFromTop (26).reduced (0, 3).withWidth (90));
        knobRow (inner, { &glide, &arpOctaves, &velAmp, &velCutoff });
    }
    {
        auto inner = fxBounds.reduced (12, 8);
        inner.removeFromTop (22);
        knobRow (inner, { &reverb, &size, &delay, &chorusKnob, &dist, &lowCut, &mix });
    }

    // keyboard + footer
    const int kbY = row3Y + row3H + gap;
    keyboard.setBounds (margin, kbY, getWidth() - 2 * margin, 74);
    const int whiteKeys = 36;
    keyboard.setKeyWidth ((float) keyboard.getWidth() / (float) whiteKeys);
    keyboard.setScrollButtonsVisible (false);
    footerBounds = { margin, kbY + 74 + 8, getWidth() - 2 * margin, getHeight() - (kbY + 74 + 8) - 6 };
}
} // namespace rato::ui

// ============================================================== editor

RatoEditor::RatoEditor (RatoProcessor& p) : AudioProcessorEditor (p), content (p)
{
    setLookAndFeel (&lnf);
    addAndMakeVisible (content);

    using C = rato::ui::Content;
    setResizable (true, true);
    setResizeLimits (C::baseWidth / 2, C::baseHeight / 2, C::baseWidth * 2, C::baseHeight * 2);
    if (auto* c = getConstrainer())
        c->setFixedAspectRatio ((double) C::baseWidth / (double) C::baseHeight);
    setSize (1000, (int) std::round (1000.0 * C::baseHeight / C::baseWidth));
}

RatoEditor::~RatoEditor()
{
    setLookAndFeel (nullptr);
}

void RatoEditor::resized()
{
    using C = rato::ui::Content;
    const float scale = (float) getWidth() / (float) C::baseWidth;
    content.setTransform (juce::AffineTransform::scale (scale));
    content.setBounds (0, 0, C::baseWidth, C::baseHeight);
}
