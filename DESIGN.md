---
# DESIGN.md — Maibach Systems
# Format: github.com/google-labs-code/design.md
# Quelle der Werte: capture/blueprint-home-1440.json + capture/measurements.md
# (forensisch vermessene Referenz-DNA), implementiert in src/styles/tokens.css

colors:
  ink: "#000000"
  inkStrong: "#1C1C1C"
  inkMuted: "rgba(0, 0, 0, 0.56)"
  inkFaint: "rgba(0, 0, 0, 0.48)"
  hairline: "rgba(0, 0, 0, 0.12)"
  hairlineSoft: "rgba(0, 0, 0, 0.05)"
  accent: "#FF4000"
  accentTint: "rgba(255, 64, 0, 0.07)"
  paper: "#FAFAFA"
  paperWarm: "#ECEBE8"
  card: "#FFFFFF"
  cream: "#FDFEF8"
  stage: "#000000"
  onStage: "#FFFFFF"
  onStageMuted: "rgba(255, 255, 255, 0.56)"
  onStageFaint: "rgba(255, 255, 255, 0.48)"
  onStageRow: "rgba(255, 255, 255, 0.12)"
  onStageChip: "rgba(255, 255, 255, 0.08)"

typography:
  display:
    fontFamily: "Bricolage Grotesque"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.05em"
  displayH1:
    fontSize: "58px"
    lineHeight: "63.8px"
    letterSpacing: "-2.9px"
  displayH2:
    fontSize: "44px"
    lineHeight: "48.4px"
    letterSpacing: "-2.28px"
  displayEcho:
    fontSize: "50px"
    lineHeight: "55px"
    letterSpacing: "-2.5px"
    color: "{colors.inkFaint}"
  displayH3:
    fontSize: "32px"
    lineHeight: "38.4px"
    letterSpacing: "-0.96px"
  displayH4:
    fontSize: "24px"
    lineHeight: "28.8px"
    letterSpacing: "-0.72px"
  displayMobile:
    fontSize: "34px"
    lineHeight: "37.4px"
    letterSpacing: "-1.7px"
  ui:
    fontFamily: "Geist"
    fontWeight: 500
  lead:
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.32px"
    lineHeight: "22.4px"
  body:
    fontSize: "16px"
    lineHeight: "20.8px"
  bodySmall:
    fontSize: "14px"
    lineHeight: "19.6px"
  note:
    fontSize: "13px"
    lineHeight: "18.2px"
  nav:
    fontSize: "15px"
    lineHeight: "19.5px"
  micro:
    fontSize: "12px"
    lineHeight: "14.4px"
    textTransform: "uppercase"
  faq:
    fontFamily: "Inter"
  faqQuestion:
    fontSize: "18px"
    fontWeight: 500
    letterSpacing: "-0.72px"
    lineHeight: "25.2px"
  faqAnswer:
    fontSize: "16px"
    fontWeight: 400
    letterSpacing: "-0.64px"
    lineHeight: "22.4px"

dimensions:
  railContent: "1200px"
  railNarrow: "1000px"
  railTabs: "1100px"
  slideWidth: "1143px"
  slidePeek: "141px"
  headerHeight: "64px"
  gutterMobile: "24px"

radii:
  panel: "40px"
  cardLarge: "30px"
  card: "24px"
  cardSmall: "16px"
  faqStage: "26px"
  pill: "200px"
  chip: "4px"
  labelPill: "70px"

elevation:
  panel: "0 1px 2px rgba(0,0,0,0.03), 0 24px 48px -16px rgba(0,0,0,0.12)"
  stage: "0 32px 64px -16px rgba(0,0,0,0.35)"
  pill: "8-Layer-Stack, alle rgba(0,0,0,0.13), Offsets 0.84/1.99/3.63/6.04/9.75/15.96/27.48/50px (smooth shadow)"

motion:
  easeBrand: "cubic-bezier(0.44, 0, 0.56, 1)"
  durationLink: "0.4s"
  easeReveal: "cubic-bezier(0.22, 1, 0.36, 1)"
  durationReveal: "0.8s"
  cardStackScale: 0.854
  faqExpand: "320ms"

components:
  buttonPrimary:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.onStage}"
    rounded: "{radii.pill}"
    minHeight: "50px"
    paddingX: "28px"
    shadow: "{elevation.pill}"
    hover: "Label-Swap (Zweitbotschaft schiebt von unten ein, 0.4s easeBrand)"
  buttonSecondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    rounded: "{radii.pill}"
    minHeight: "39px"
  labelPill:
    backgroundColor: "{colors.accentTint}"
    textColor: "{colors.accent}"
    rounded: "{radii.labelPill}"
    padding: "10px 19px"
    typography: "{typography.nav}"
  chip:
    border: "1px solid {colors.hairline}"
    rounded: "{radii.chip}"
    typography: "{typography.micro}"
    padding: "2px 7px"
  personaPanel:
    backgroundColor: "{colors.card}"
    rounded: "{radii.panel}"
    width: "1068px"
    padding: "50px 46px 50px 40px"
    mediaCard: "540x600, {colors.cream}, rounded {radii.cardLarge}"
  folderCard:
    backgroundColor: "{colors.card}"
    rounded: "{radii.cardLarge}"
    minHeight: "350px"
    tab: "Lasche oben, Bricolage 20px, Radius 14px 14px 0 0, x-Staffelung 150px-Raster"
    stacking: "sticky, begrabene Karten scale {motion.cardStackScale}, Gruppe 2 +28px"
  compareTable:
    accentColumn: "{colors.accent}, weisser Text 13px, Kopfzelle 20px oben gerundet"
    cells: "13px {colors.inkMuted}, Haarlinien-Grid, Zeilen ~67px"
    rowLabel: "Inter 14px/600"
  timeline:
    dot: "8x8, inaktiv {colors.hairline}, aktiv {colors.ink}"
    rail: "2px, {colors.hairlineSoft}, durchgehend Dot zu Dot"
    fill: "Akzent-Gradient mit weichem Kopf (transparent -> 0.88 -> voll), scrollgetrieben"
  faqStage:
    backgroundColor: "{colors.stage}"
    rounded: "{radii.faqStage}"
    padding: "8px"
    row: "984x76, {colors.onStageRow}, rounded {radii.card}, padding 24px, Gap 8px"
    plusButton: "28x28 Kreis, {colors.onStageChip}, rotiert 45deg bei offen"
  requestForm:
    steps: 7
    frame: "{colors.paperWarm}, rounded {radii.panel}, padding 16px"
    progress: "4px Track {colors.paperWarm}, Füllung {colors.accent}"
    choice: "Radio-Karten, checked: Border {colors.accent} + {colors.accentTint}"
---

# Maibach Systems — Design-System

## Overview

Editorial-Direct: Ink auf Papier, EIN warmer Akzent, enge fette Grotesk,
Haarlinien statt Boxen, Proof als Struktur. Die Sprache verkauft an
skeptische Schweizer KMU-Entscheider (45-60): ruhig, konkret, Realtalk —
keine Superlative, keine erfundenen Zahlen. Jede Headline darf einen
Akzent-Schlusspunkt tragen (`<span class="dot">.</span>`). Sprache:
Schweizer Hochdeutsch, Sie-Form, ss statt ß, «»-Guillemets, keine
em/en-dashes. Herkunft aller Werte: forensische Vermessung der
Referenz-DNA (capture/), keine Augenmass-Werte.

## Colors

Drei Farbwelten: **Papier** (paper/paperWarm/card/cream) trägt den
Inhalt, **Ink** in vier Abstufungen (voll, strong, 56%, 48%) trägt die
Typo-Hierarchie, **Stage** (schwarz) trägt FAQ, Footer und Buttons.
Der Akzent #FF4000 ist exklusiv für: Schlusspunkte, Links,
Sektions-Label-Pills (auf 7%-Tint), Akzent-Spalte der Vergleichstabelle,
Timeline-Füllung, «Mit Maibach»-Chips und Formular-Zustände. Akzent nie
als Flächenfarbe für Text-Hintergründe ausserhalb dieser Rollen.
Single Token Source: `src/styles/tokens.css` — ausserhalb davon kein
hardcodiertes Hex.

## Typography

Drei Familien, drei Rollen (alle SIL OFL, lokal unter /public/fonts):

1. **Bricolage Grotesque 500** — alles Display. Tracking −5% (gross)
   bzw. −3% (H3/H4), Zeilenhöhe 1.1/1.2. Mobile-Stufe einheitlich 34px.
2. **Geist** — UI und Fliesstext. Lead 16/600, Body 16/500, Small
   14/500, Note 13/500, Nav 15/500, Microlabels 12 Uppercase.
3. **Inter** — ausschliesslich FAQ (Fragen 18/500/−4%, Antworten
   16/400/−4%) und Tabellen-Zeilenlabels (14/600).

Muted-Text (56%) ist der Standard für erklärende Absätze; Voll-Ink nur
für Aussagen mit Gewicht («Mit Maibach»-Antworten, Leads).

## Layout

Drei Rails, alle zentriert: 1200px (Haupt), 1000px (Statement, FAQ,
Roadmap, Timeline-Kopf), 1100px (Persona-Tabs). Mobile-Gutter 24px.
Header fix 64px. Sektions-Köpfe: Label-Pill + zentrierte H2, optional
Intro mit flankierenden vertikalen Haarlinien. Hero-Geometrie bei 1440:
H1-Spalte bei x=185 (450px), Callout-Spalte 375px rechts, CTA exakt
zentriert, Stage-Slides 1143px mit 141px-Peek an beiden Kanten.
Drei-Zeilen-Dramaturgie für Statements: Akzent 44 / Ink 44 / Faint 50.

## Elevation & Depth

Drei Schatten, keine weiteren: **panel** (Karten, weich, fast
unsichtbar), **stage** (Video-Stage, dramatisch), **pill** (Buttons:
gemessener 8-Layer-smooth-shadow). Tiefe entsteht primär über
Stacking-Mechanik (Karten-Stack, Laschen) und Flächenwechsel
(Papier→Karte→Stage), nicht über Schatten-Eskalation.

## Shapes

Formgrammatik: Voll-Pills (200px) für Buttons und CTAs, 70px-Pills für
Sektions-Labels, 40px-Panels für grosse Bühnen, 30px für Karten-Bühnen
und FAQ-Container, 24px für Karten und FAQ-Rows, 16px für Medien,
4-5px-Chips für Microlabels. Ordner-Laschen: 14px oben gerundet, unten
offen, ragen 38px über ihren Karten-Body. Haarlinien (1px, 12%-Ink)
trennen statt Rahmen zu bauen; 2px-Varianten als linke Marker an
Today/With-Blöcken.

## Components

Siehe YAML-Frontmatter für exakte Werte. Verhaltensregeln:

- **buttonPrimary (Swap-Pill):** trägt IMMER zwei Labels — Default und
  Hover-Zweitbotschaft (kündigt das Ziel an). Overflow hidden,
  translateY-Swap, 0.4s easeBrand.
- **folderCard-Stack:** Scroll-Zustandsmaschine. Karten werden sticky
  (Bodies deckungsgleich, Gruppen-Offset 28px), Laschen bleiben durch
  x-Staffelung sichtbar, begrabene Karten skalieren auf 0.854
  (transform-origin top). Reduced-Motion: statischer Fluss.
- **timeline:** Dots sind Zustände (grau→schwarz), die Füllung läuft
  scrollgetrieben mit weichem Gradient-Kopf durch eine durchgehende
  Basis-Linie. Kein Segment endet im Leeren.
- **personaTabs:** Microlabel-Tabs (aktiv: Ink + 2px Akzent-Underline;
  inaktiv: 48%-Ink + Haarlinie). Tab-Wechsel = Panel-Inhaltswechsel mit
  350ms Fade/Slide — nie nur Styling-Wechsel.
- **faqStage:** native details/summary, animierte Höhe 320ms, Plus
  rotiert 45°. Antwortbreite max 936px.
- **requestForm:** 7 Schritte, Schritt 1 = Kontakt, danach je genau eine
  Frage. Validierung pro Schritt, Fortschrittsbalken, Inline-Bestätigung.
- **Scroll-Reveals:** opacity 0→1 + translateY 30px→0, 0.8s easeReveal,
  Stagger 0.1s-Schritte. Sticky-Headline: Zeichen-Reveal (Opacity 0.16→1
  pro Zeichen, scrollgetrieben).

## Do's and Don'ts

**Do:**
- Jede Zahl im Layout aus capture/ belegen oder am Original nachmessen.
- Platzhalter für fehlendes Material: `data-placeholder` + masshaltiger
  Slot + dezentes «folgt»-Badge; jede proof-ID in
  source-material/planning/proof-needs.md registrieren.
- `prefers-reduced-motion` für JEDE Bewegung respektieren.
- CTAs benennen den nächsten Schritt («Kostenlose Analyse starten»),
  Hover verrät die Hürdenfreiheit («7 Fragen, 2 Minuten»).
- Texte nach Marketing-Thesis-Logik bauen (docs/baulig-pass.md).

**Don't:**
- Keine toten Klick-Affordanzen (disabled Play-Buttons, Links ins
  Leere) — lieber ehrlicher Hinweis ohne Klick-Versprechen.
- Keine erfundenen Zahlen, Zitate, Logos oder Garantien.
- Kein Hex ausserhalb von tokens.css, keine neuen Schatten, keine
  neuen Radien, keine zusätzlichen Akzentfarben.
- Keine neuen Sektions-Typen erfinden — die Formgrammatik der Referenz
  ist abschliessend, bis der Inhaber anderes entscheidet.
- `height: -webkit-fill-available` nie für Overlays (kollabiert in
  Chromium); immer `calc(100dvh - Headerhöhe)`.
- Keine em/en-dashes und kein ß in sichtbaren Texten.
