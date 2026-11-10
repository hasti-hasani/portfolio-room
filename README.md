# Portfolio Studio

A walk-through 3D studio (three.js) built with Vite. Live at https://hasti-hasani.github.io/portfolio-room/

## Commands

```
npm install        # once
npm run dev        # local site with live reload: http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the build: http://localhost:4173
npm run lint
```

Pushing to `main` builds and publishes the site automatically (`.github/workflows/deploy.yml`).

## Where things are

- `src/content.js`: all the text, links and images. Edit this file to change the content.
- `public/assets/`: photos, textures, models, sounds and music, served as they are.
- `src/world/`: one file per part of the room (desk, bookshelf, rack, lounge…).
- `src/systems/`: walking, clicking, sound, music, day and night, the render loop, performance.
- `src/ui/`: the side panel, the 3D garment viewer, and the plain 2D fallback page.
- `src/core/`: renderer, loaders, materials and shared building helpers.

Add `?stats` to the address to see the frame rate and draw calls.
`_source/` (not published) keeps the original files of compressed assets.
