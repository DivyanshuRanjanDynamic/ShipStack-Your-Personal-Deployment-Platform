# Brag Plan: ShipStack

## What is this app?
ShipStack is a Vercel-like cloud deployment platform: git push becomes a live URL on ECS, S3, and a reverse proxy, with Kafka → ClickHouse logs and RAG AI diagnosis when the build dies.

## The angle
The product’s own headline is the hook: a failed deploy is not a dead end. Show the real pipeline, then the real diagnosis card — `OPENAI_API_KEY is not defined` turning into ROOT CAUSE IDENTIFIED.

## Hook (first 2-3 seconds)
Black field. White type slams in: **A failed deployment.** Hold. Then the second line in violet: **Not a dead end.**

## Key moments (the middle)
- Pipeline chips land one by one: Git → SQS → ECS → S3 → Live (lock).
- Fork glow from ECS down to Kafka → ClickHouse → AI → RAG.
- Recreate the marketing diagnosis card: red log lines, then purple ROOT CAUSE IDENTIFIED + “Missing production configuration” + cyan source chip.

## Outro / punchline
Wordmark **ShipStack**. Tagline from the hero: **Ship with confidence, not complexity.**

## User flow worth showing
Git push → production build fails on a missing env var → AI diagnosis names the root cause and cites the environment configuration guide.

## Tone
- Preset: polished
- Creative direction: quiet premium infra film — black canvas, cyan/violet diagnosis, no joke-trying
- Interpretation: fewer scenes, longer holds, mixed-case Inter, soft crossfades; energy from the fail→heal punch, not from flashy type

## Format: landscape — 1920x1080
## Duration: 20 seconds

## Visual identity (from the project)
- Background: `#000000`
- Accent: `#00dfd8` cyan, `#c084fc` / `#9333ea` AI violet, `#10b981` live, `#ef4444` log error, `#0070f3` blue
- Text: `#f5f5f7` primary, `#9ea3b0` secondary
- Display font: Inter
- Body font: Inter; logs in JetBrains Mono
- Strongest visual element: the two-track architecture board (deploy + intelligence) and the diagnosis preview card

## Share copy (draft)
A failed deploy used to be a dead end. ShipStack turns the log into a root cause — RAG included.

## Audio direction
- Role: warm bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (~115 BPM)
- Music treatment: start at 0s, volume low-mid, fade in ~0.4s, fade under logo at ~18.5s
- Music cue guidance: preset at `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.md` — tempo ~114.84 BPM. Strong cues to consider: 1.60s (hook line 2), 5.80s (pipeline start), 8.96s / 12.65s (diagnosis), 17.91s (logo). Beat grid ~0.52s; sequential chips every other beat (~1.05s) so labels stay readable.
- Audio-reactive treatment: subtle; cyan/violet glow and card presence breathe with RMS/bass. No waveform bars.
- SFX posture: sparse; motion-matched; professional restraint
- Audio-coupled moments: hook type/slam; chip arrivals; error buzz then diagnosis switch; logo hit
- Restraint rule: no dense casino stacks, no glitch spam, no overlapping SFX

## Storyboard

### Scene 1 — Dead end — 3.2s
Black. Line 1: “A failed deployment.” Line 2 appears under it: “Not a dead end.”
Sequential/interaction: yes — two lines, one after the other
Audio intent: quiet bed, then a soft confirmation on line 2
Audio-coupled idea: slam-in + hold; optional click on second line
Music: warm bed entering
Transition mood: soft crossfade → Scene 2
Reading: line 1 holds ≥1.2s; line 2 holds ≥0.9s

### Scene 2 — Name — 3.4s
“ShipStack.” then the hero line “Build, deploy, and scale your next idea.”
Sequential/interaction: name then subtitle
Audio intent: lift, still restrained
Audio-coupled idea: none required
Music: continues
Transition mood: soft slide → Scene 3

### Scene 3 — Pipeline — 5.6s
Recreate the deploy track as five/six logo chips: Git, SQS, ECS, S3, Proxy, Live. Chips arrive left to right. A dashed orange stem drops from ECS to Kafka → ClickHouse → AI → RAG.
Sequential/interaction: yes — deploy chips one by one, then intelligence chips
Audio intent: ticking progress, then a slightly warmer color on the intelligence fork
Audio-coupled idea: card/chip sounds on each arrival, snapped to every other beat
Music: continues; lock first chip near 5.80s strong cue
Transition mood: soft crossfade → Scene 4

### Scene 4 — Diagnosis — 5.0s
Recreate the home diagnosis card: toolbar “Deployment diagnosis”, log `Error: OPENAI_API_KEY is not defined`, then the purple block ROOT CAUSE IDENTIFIED / Missing production configuration / Source: Environment configuration guide.
Sequential/interaction: yes — log first, then root-cause panel
Audio intent: brief negative, then resolved
Audio-coupled idea: error accent on the red line; switch/bong on root cause
Music: continues
Transition mood: soft crossfade → Scene 5

### Scene 5 — Outro — 2.8s
ShipStack wordmark + “Ship with confidence, not complexity.”
Sequential/interaction: none
Audio intent: settle; music fade
Audio-coupled idea: one logo hit
Music: fade under final hold
Transition mood: hold to black

**Total: 20.0s**

**Music mood for this video:** polished / upbeat-but-quiet
**Audio summary:** A warm business bed under a fail-to-heal cut; sparse UI ticks on the pipeline, one error sting, one resolve hit, fade on the mark.
