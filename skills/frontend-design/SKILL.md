---
name: frontend-design
description: Influences frontend output towards distinctive, production-grade design. Use when building web components, pages, or applications — any task that produces visible UI.
---

## Design Thinking

Before coding, understand the context and commit to a bold aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme — brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, industrial/utilitarian. Use these for inspiration but design one true to the chosen direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this unforgettable? What's the one thing someone will remember?

Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — uncommitted aesthetics read as generic. The key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:

- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Aesthetics

- **Typography**: Choose distinctive, characterful fonts — unexpected pairings that elevate the design. Pair a display font with a refined body font. Avoid overused defaults (Inter, Roboto, Arial, system fonts) because they signal "no thought was given to this."
- **Colour & Theme**: Commit to a cohesive palette. Use CSS variables for consistency. Dominant colours with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Prioritise CSS-only solutions for HTML; use Motion library for React when available. One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colours. Gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, grain overlays — whatever serves the aesthetic.

Match implementation complexity to the vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist designs need restraint, precision, and careful attention to spacing and typography. Elegance comes from executing the vision well, not from piling on features.

## Anti-Patterns

Every design should feel different. Converging on the same choices across generations is the core failure mode.

| Anti-Pattern | Why It Fails | Instead |
|--------------|-------------|---------|
| Overused font families (Inter, Roboto, Space Grotesk) | Signals "AI-generated" immediately | Pick fonts with character that match the aesthetic direction |
| Purple gradients on white backgrounds | Clichéd AI aesthetic | Commit to a palette that serves the concept |
| Predictable card-grid layouts | Every AI output looks like this | Use asymmetry, overlap, editorial composition |
| Cookie-cutter component patterns | Generic, context-free | Design for the specific purpose and audience |
| Same aesthetic across generations | Reveals lack of creative range | Vary themes, fonts, colour, and layout approach every time |
| Unthinking Tailwind/component library defaults | Produces homogeneous output | Style deliberately — defaults are a starting point, not a destination |
