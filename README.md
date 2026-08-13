# Got Five!

[![Deploy to GitHub Pages](https://github.com/anicolao/gotfive/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/anicolao/gotfive/actions/workflows/deploy.yml)
[![E2E Tests](https://github.com/anicolao/gotfive/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/anicolao/gotfive/actions/workflows/e2e.yml)

A game of numbers.

## Product Behavior

- Players reveal public tiles and spend them to ask sorting or matching questions about hidden racks.
- The game surface and racks are rendered with Threlte as glossy, rounded 3D lozenges. Each numbered tile keeps one physical scene identity as it rises and flips from a deck into the public line, then flies and shrinks into sorting or matching clues.
- Racks anchor every 3D tile to its measured slot, preserving centered sorting lanes between tiles and at both ends; the clue lozenge itself shows the sorted position. Deck counts are rendered on the 3D pile, and selecting a public tile is indicated by its lift rather than a DOM outline.
- Semantic HTML controls sit above the WebGL presentation so keyboard, screen-reader, and automated-test interactions retain normal browser behavior.
- Reduced-motion preferences skip transitional movement and render every piece directly in its settled state.
- One responsive, high-DPI canvas renders every rack and table field through a distant, low-FOV camera. The temporary **Inspect 3D** control enables orbit, pan, and zoom gestures over that unified scene without interfering with normal game controls when inspection is off.

## Development Commands
- `bun install`: Install dependencies.
- `bun run dev`: Start development server.
- `bun run build`: Build for production.
- `bun run test:e2e`: Run E2E tests.
- `nix develop`: Enter development environment.
