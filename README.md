# Got Five!

[![Deploy to GitHub Pages](https://github.com/anicolao/gotfive/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/anicolao/gotfive/actions/workflows/deploy.yml)
[![E2E Tests](https://github.com/anicolao/gotfive/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/anicolao/gotfive/actions/workflows/e2e.yml)

A game of numbers.

## Product Behavior

- Players reveal public tiles and spend them to ask sorting or matching questions about hidden racks.
- The game surface and racks are rendered with Threlte as glossy, rounded 3D lozenges. Drawing, selecting, matching, sorting, and revealing tiles drive 3D lift, spin, and flip motion.
- Semantic HTML controls sit above the WebGL presentation so keyboard, screen-reader, and automated-test interactions retain normal browser behavior.
- Reduced-motion preferences skip transitional movement and render every piece directly in its settled state.
- One responsive, high-DPI canvas renders every rack and table field through a distant, low-FOV camera. The temporary **Inspect 3D** control enables orbit, pan, and zoom gestures over that unified scene without interfering with normal game controls when inspection is off.

## Development Commands
- `bun install`: Install dependencies.
- `bun run dev`: Start development server.
- `bun run build`: Build for production.
- `bun run test:e2e`: Run E2E tests.
- `nix develop`: Enter development environment.
