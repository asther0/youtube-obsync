# Obsync Learning Moments

## Decision

Obsync should not compete as a generic summarizer, full web clipper, or video recorder. The strongest product direction is:

> Convert a specific learning moment from web or video into a reviewable Obsidian note with source, evidence, timestamp, transcript, and recall metadata.

In the UI, the word "clip" should mean an enriched reference to a moment, not an exported MP4.

## Why

The user value is not saving more content. The value is preserving the exact moment where something clicked, with enough context to revisit it later.

Existing products already cover adjacent spaces:

- Web clippers save pages and highlights.
- Video note tools generate notes and screenshots.
- Research notebooks ingest full sources.
- Read-it-later systems sync highlights.

Obsync can differentiate by being intentional, local-first, Obsidian-native, and review-oriented.

## Product Thesis

Capture the moment you actually learned something, not the whole internet.

Each saved item should answer:

- What did I learn?
- Where exactly did it come from?
- What evidence helps me trust or remember it?
- When should I review it?
- How do I return to the source?

## Recommended Bets

### 1. Learning Moment Card

Core unit saved to Obsidian.

Required output:

- User note.
- Source URL.
- Source title.
- Timestamp or time range when available.
- Transcript range for YouTube.
- Screenshot or visual evidence.
- Review metadata.
- Recall prompt.
- Application prompt.

Suggested frontmatter:

```yaml
obsync_kind: learning_moment
source_type: youtube
status: pendiente
review_after: 2026-07-30
source: https://...
source_time: https://...
range: 12:43-13:18
captured_at: 2026-07-23T00:00:00.000Z
folder: 20 inbox/obsync/2026-07
```

Suggested Markdown body:

```md
# Title

> [!source]
> Source URL and exact timestamp.

## Apunte

What clicked for me.

## Por que importa

Why this is worth remembering.

## Evidencia

Screenshots, transcript, and source details.

## Repaso

- Recall prompt.
- Application prompt.
```

### 2. Verifiable Video Extract

For YouTube, save the range as a reproducible moment:

- Start time.
- End time.
- Timestamp link.
- Transcript filtered to the range.
- Visual evidence.
- User note.

Do not store or export the video file as the default behavior.

### 3. Moment Filmstrip

Instead of recording MP4 clips, save lightweight visual evidence:

- Frame at extract start.
- Frame at extract end.
- Optional user-selected crop.

This communicates "I captured the moment" without permissions, storage, or copyright complexity.

### 4. Reviewable Inbox

All captures enter:

```text
20 inbox/obsync/YYYY-MM/
20 inbox/obsync/_attachments/YYYY-MM/
```

The user later promotes notes into durable knowledge folders.

## Explicit Non-Goals For MVP

- Do not download YouTube videos.
- Do not scrape media streams.
- Do not promise MP4 clip export as the core product.
- Do not compete with HoverNotes on "AI watches every video frame".
- Do not compete with NotebookLM on full-source research.
- Do not make voice capture a primary bet yet.

## Implementation Backlog

### P0

- Save automatic start and end screenshots for video extracts.
- Make video extract notes use `obsync_kind: learning_moment` or clearly map `video_extract` to learning moments.
- Add recall and application prompts to generated Markdown.
- Ensure source timestamp link is visible near the top of the note.

### P1

- Add a single contextual `+` action menu instead of showing every capture action.
- Add `Guardar momento` for YouTube current timestamp without requiring a range.
- Save selected page text as evidence when available.
- Add pending count or last-saved affordance in the sidebar.

### P2

- Explore tab recording only as a separate experimental mode for demos and walkthroughs.
- Explore multimodal screenshot interpretation if the user explicitly wants AI to inspect diagrams or UI.
- Revisit voice capture after the learning moment flow is strong.

## Demo Narrative

1. Open a tutorial video.
2. Start an extract at the moment an idea becomes useful.
3. Close the extract after the explanation.
4. Obsync saves transcript, timestamp link, note, and visual evidence to Obsidian.
5. Open Obsidian and show a small, reviewable Markdown card.
6. Click the timestamp and return to the exact source moment.
