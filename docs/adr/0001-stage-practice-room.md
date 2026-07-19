# ADR 0001: Use a stage practice room as the primary experience

## Status

Accepted

## Context

The product trains comedic speed for apprentice comedians. The main alternatives were a professional coach dashboard, a generic chat interface, or a live earpiece assistant for real performances.

A live earpiece assistant is visually compelling but fragile as the core product: it depends on low latency, clean audio, performer trust, and the social acceptability of AI-assisted lines during a show. A generic chat or dashboard is easier to build but does not demonstrate the embodied pressure of audience work.

## Decision

The first product experience will be a stage practice room: an illustrated comedy setting with simulated audience members and voice-first interaction. The apprentice comedian practices against audience prompts, while the system tracks callbacks, contradictions, and connections in the background.

## Consequences

This makes the demo more concrete and product-like: judges can see a performer, an audience, a timed interaction, and a connection graph emerging from the session.

The design must prioritize responsiveness, performance atmosphere, and clear training feedback. Live show assistance can exist later as an experimental mode, but it is not the product's core promise.
