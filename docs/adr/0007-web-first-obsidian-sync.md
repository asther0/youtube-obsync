# ADR 0007: Build Obsync as a web-first Obsidian sync route

## Status

Accepted

## Context

The project now has two related surfaces: Comedy Graph for comedy-specific video analysis, and Obsync for learners who want to turn selected video ranges into connected Obsidian knowledge.

A Chrome extension sidebar would feel natural on YouTube, but it adds installation, permissions, content script, side panel, and browser packaging risk. The hackathon submission needs a working product experience with real sync, not just a concept.

## Decision

Build Obsync as a second route inside the existing Next.js app, starting at `/obsync`.

The first version is web-first and desktop Chrome/Edge oriented. It should support real Obsidian sync by writing Markdown files into a user-selected vault folder through the browser File System Access API when available.

## Consequences

The product remains demoable as a normal web app while still providing a credible real sync story.

The browser support constraint is explicit: local vault sync depends on desktop Chromium browsers. Other browsers can still use the generated Markdown preview, but they may not support direct folder writes.

A future Chrome extension can become a fast entry point from YouTube, passing the current video URL and timestamp into `/obsync`, instead of becoming the whole product surface.
