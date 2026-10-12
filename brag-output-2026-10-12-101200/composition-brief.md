# Hyperframes Composition Brief: ShipStack

## Objective
Create a short launch-style brag video for ShipStack.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `c:\Users\Divyanshu\Projects\shipStack`
- Primary files read: `frontend/index.html`, `frontend/src/index.css`, `frontend/src/pages/HomePage.jsx`, `frontend/src/components/ArchitectureFlow.jsx`, `README.md`
- Product name: ShipStack
- Tagline / strongest claim: A failed deployment. Not a dead end.
- Key UI or visual moment to recreate: architecture pipeline chips + home diagnosis preview card
- Copy that must appear verbatim:
  - A failed deployment.
  - Not a dead end.
  - ShipStack. Build, deploy, and scale your next idea.
  - Error: OPENAI_API_KEY is not defined
  - ROOT CAUSE IDENTIFIED
  - Missing production configuration
  - Source: Environment configuration guide
  - Ship with confidence, not complexity.

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium infra film
- Interpretation: black canvas, Inter, long holds, soft crossfades; fail→heal is the only spike
- Angle: failed deploy is not a dead end — show the real stack then the real diagnosis card
- Hook: “A failed deployment.” then “Not a dead end.”
- Outro / punchline: ShipStack / Ship with confidence, not complexity.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Invented metrics

## Visual Identity
- Background: `#000000`
- Text: `#f5f5f7`
- Accent: `#00dfd8`, `#c084fc`, `#10b981`, `#ef4444`
- Display font: Inter
- Body font: Inter; JetBrains Mono for logs
- Visual references from the project: architecture node cards, LIVE lock, purple diagnosis panel, cyan source chip

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Dead end — 3.2s — two-line hook
2. Name — 3.4s — ShipStack + hero line
3. Pipeline — 5.6s — Git SQS ECS S3 Proxy Live then Kafka ClickHouse AI RAG
4. Diagnosis — 5.0s — log error then root cause card
5. Outro — 2.8s — wordmark + tagline

## Audio
- Audio role: warm bed / sparse professional accents
- Audio arc: enter quietly → tick through pipeline → error then resolve → fade on logo
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3`
- Music treatment: fade in, sit under, fade from ~18.5s
- Music cue guidance: bundled preset `.agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json` — lock 1–3 of 1.60s, 5.80s, 17.91s
- Audio-reactive treatment: subtle; glow/presence on hero and diagnosis card
- Audio-coupled moments:
  - Scene 1 — slam/hold of two lines
  - Scene 3 — chip sequence
  - Scene 4 — error then diagnosis
  - Scene 5 — logo hit
- SFX selection guidance: low HF-risk interface clicks, drop, one error, one bong/switch
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: music already copied to `brag-output/composition/assets/music/`

## Hyperframes Instructions
Do not run the generic promo interview. Build this brag composition locally in `brag-output/composition/`.

Requirements:
- Show the diagnosis card UI and the pipeline chips from the product.
- Keep all text readable.
- 15–25 seconds (target 20).
- Include music/SFX.
- Treat cue metadata as optional; readability first.
- `npx hyperframes check` must pass before render.
- Local only.
