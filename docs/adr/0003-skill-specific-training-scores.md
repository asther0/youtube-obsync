# ADR 0003: Evaluate trainable skills instead of funniness

## Status

Accepted

## Context

The simulator needs to help apprentice comedians improve. A generic "funny score" would be subjective, brittle, and likely to feel arbitrary.

The product is stronger if it evaluates behaviors that performers can deliberately practice.

## Decision

The product will score practice responses by trainable dimensions:

- Memory: whether the response uses a previous detail.
- Specificity: whether it reacts to concrete material instead of generic phrasing.
- Tension: whether it notices contradiction, contrast, or social pressure.
- Brevity: whether it is short enough to fit live timing.
- Follow-up potential: whether it opens more material.
- Performer ownership: whether it preserves the performer's authorship instead of sounding AI-written.

## Consequences

The feedback becomes more credible and actionable. The demo can show measurable improvement without claiming to objectively know what is funny.

The scoring prompts and UI must explain why a response received a score, not just display numbers.
