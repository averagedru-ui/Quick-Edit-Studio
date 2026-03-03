# CLUTCH Studio

## Overview
CLUTCH Studio is a web-based high-performance video editor designed to transform long-form gaming VODs into vertical or horizontal content (TikTok/Shorts/Reels/YouTube) using a synchronized multi-viewport "Spatial Glass" interface.

## Architecture
- **Frontend-only app** — all processing happens in the browser
- React + TypeScript + Tailwind CSS
- Canvas API for real-time video compositing (9:16 vertical + 16:9 horizontal)
- Web Audio API connected (GainNode + StereoPannerNode on active layer, persisted on video element to survive HMR)
- In-memory state with JSON export pipeline
- Dark-mode only "Spatial Glass" UI theme

## Key Features
1. **Splash Screen** — Typing animation with progress bar
2. **Spatial Monitor** — Dual-mode canvas preview (9:16 vertical / 16:9 horizontal) with real-time layer compositing
3. **Preview Mode Toggle** — Switch between vertical and horizontal output format via button on canvas
4. **Layer Matrix** — 5 default layers (Background, Gameplay, Camera, HUD 1/2) with visibility/lock toggles
5. **HUD Cropper** — Source crop (sX, sY, sW, sH) and target transform (tX, tY, Scale, Rot) controls
6. **Pro Audio Mixer** — Gain, 3-Band EQ, Stereo Pan, Mute/Solo per layer
7. **Snippet Deck** — Mark IN/OUT points to collect video clips
8. **Export Portal** — JSON manifest export for rendering farm handoff

## File Structure
- `client/src/lib/store.tsx` — React Context state management (layers, snippets, playback, previewMode)
- `client/src/components/splash-screen.tsx` — Animated splash/loading screen
- `client/src/components/spatial-monitor.tsx` — Canvas-based preview + playback controls + Web Audio
- `client/src/components/layer-matrix.tsx` — Layer management panel
- `client/src/components/control-panels.tsx` — Transform, Audio Mixer, Snippet Deck panels
- `client/src/components/export-portal.tsx` — JSON export overlay dialog
- `client/src/pages/editor.tsx` — Main editor page layout (responsive desktop/mobile)

## Design System
- **Background**: Deep Carbon (#0c0c10)
- **Accent**: Neon Lime (#bef264)
- **Surfaces**: Semi-transparent white (rgba(255,255,255,0.015-0.03)) with backdrop-blur
- **Typography**: Inter (sans) + JetBrains Mono (mono for timecodes/data)
- **Custom slider**: .neon-slider class in index.css

## Tech Stack
- React 18 with TypeScript
- Tailwind CSS with custom dark theme
- Vite for dev/build
- Canvas 2D API for video compositing
- Web Audio API for live audio preview
- Blob URLs for local video handling
- No database needed — pure client-side app

## Mobile Support
- Responsive layout using md: breakpoint
- Mobile: Video fills most of screen, collapsible control panel with pull-up handle
- Desktop: 3-column layout (layers | monitor | controls)
- Bottom tab bar: Layers, Transform, Audio, Clips (tapping auto-expands panel)
- Touch-friendly controls throughout
