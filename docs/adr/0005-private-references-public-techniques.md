# ADR 0005: Use private references only to extract public-facing techniques

## Status

Accepted

## Context

The project is inspired by fast crowdwork in Latin American comedy, including performers such as Lucho Mellera, Jorge Luna, Ricardo Mendoza, and Hablando Huevadas. Their performances can help identify general techniques, but the hackathon submission must remain original and legally clean.

## Decision

Reference transcripts, notes, or clips may be used locally as a private reference corpus during research. They must stay outside the submitted repository and outside demo assets.

The product will expose only abstracted, original technique patterns such as audience labeling, callback discovery, contradiction detection, escalation, compression, and follow-up question design.

## Consequences

The team can learn from real comedy craft while keeping the public product original. The README can credit cultural inspiration and named references, but the app must not include copied transcripts, jokes, likenesses, or prompts that ask the model to imitate a specific living comedian.

The repository ignores `private-references/` so local research material is not committed accidentally.
