# ADR 0006: Build a web MVP with OpenAI and browser fallbacks

## Status

Accepted

## Context

Punchline Arena must be working and demoable before the OpenAI Build Week deadline. The product needs voice input, simulated audience prompts, AI analysis, and a visual connection graph.

Adding auth, persistence, advanced voice providers, or complex infrastructure would slow down delivery without proving the core product.

## Decision

The MVP will be a deployable web app, likely Next.js/React, with no login and no database at first.

OpenAI will power audience generation, analysis, cue extraction, and optionally audio transcription or speech synthesis. Browser-native speech APIs may be used as fallbacks to keep the experience working quickly.

The first room will be Open Mic Bar.

## Consequences

The app can be built and tested quickly, then deployed for judges. Session persistence and premium voice providers such as ElevenLabs can be added later if time remains.

The core technical risk becomes real-time-ish voice flow and reliable structured AI output for cues, graph nodes, graph edges, and post-round analysis.
