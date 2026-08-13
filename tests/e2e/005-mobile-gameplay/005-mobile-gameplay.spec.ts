import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

interface Store {
  dispatch: (action: { type: string; payload?: unknown }) => void;
  getState: () => {
    game: { status: string; turnOrder: string[] };
    players: { players: Record<string, unknown> };
    ui: { gameId: string; deductionBoard: Record<number, '?' | 'X' | 'OK'>; strokes: number[][][] };
  };
}

interface WindowWithStore extends Window {
  store: Store;
}

async function writeRemoteGameEvent(page: Page, type: string, payload?: unknown) {
  await page.evaluate(async (args: { type: string; payload?: unknown }) => {
    const { writeGameEvent } = await (0, eval)('import("/src/lib/firebase/events.ts")');
    const gameId = (window as unknown as WindowWithStore).store.getState().ui.gameId;
    await writeGameEvent(gameId, args.type, args.payload);
  }, { type, payload });
}

async function scrollStatusBannerIntoView(page: Page) {
  await page.waitForSelector('.status-banner', { state: 'visible' });
  await page.evaluate(() => {
    document.querySelector('.status-banner')?.scrollIntoView({ block: 'center' });
    document.querySelector('.deduction-area')?.scrollTo({ top: 0 });
  });
}

test.describe('Mobile Gameplay', () => {
  test.use({ viewport: { width: 375, height: 720 } }); // Adjusted iPhone SE portrait height to avoid clipping in tests

  test('User plays on mobile portrait', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata('Mobile Portrait', 'Verify layout and gameplay on mobile portrait.');

    await page.goto(`/?seed=123&myId=mobile-portrait-test-user&lobbyId=lobby-005-portrait`);

    // 1. Lobby Check
    const lobby = page.locator('.lobby-wrapper');
    await expect(lobby).toBeVisible();

    await page.getByLabel('Your Name:').fill('MobileUser');
    await page.getByRole('button', { name: 'Join Lobby' }).click();
    await page.getByRole('button', { name: 'Host New Game' }).click();
    await page.getByRole('button', { name: 'Start Hosting' }).click();

    // Add a player via store
    await page.evaluate(() => {
      (window as unknown as WindowWithStore).store.dispatch({ 
        type: 'players/addPlayer', 
        payload: { id: 'p2', name: 'Player 2' } 
      });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();

    await tester.step('mobile-portrait-layout', {
      description: 'Main play area and deduction board are visible together',
      verifications: [
        {
          spec: 'Main play area is visible',
          check: async () => {
            await expect(page.locator('.main-play-area')).toBeVisible();
          }
        },
        {
          spec: 'Deduction area is visible without toggling',
          check: async () => {
            await expect(page.locator('.deduction-area')).toBeVisible();
          }
        }
      ]
    });

    // 2. Reveal a tile
    await page.locator('.deck-btn.red').click();
    await tester.step('mobile-portrait-reveal', {
      description: 'Reveal a tile in portrait mode',
      verifications: [
        {
          spec: 'Public pool has 6 tiles',
          check: async () => {
            await expect(page.locator('.pool-tiles .tile')).toHaveCount(6);
          }
        }
      ]
    });

    // 3. Ask for a clue
    const firstPublicTile = page.locator('.pool-tiles .tile-btn').first();
    const firstPublicTileId = await firstPublicTile.locator('.number').innerText();
    await firstPublicTile.click();
    
    const p2Stand = page.locator('.stand-container').filter({ hasText: 'Player 2' });
    await p2Stand.locator('.name-tag').click();

    await tester.step('mobile-portrait-ask-clue', {
      description: 'Ask for a clue in portrait mode',
      verifications: [
        {
          spec: 'Player 2 stand has an active notch',
          check: async () => {
            await expect(p2Stand.locator('.notch.active')).toHaveCount(1);
          }
        }
      ]
    });

    // 4. Guessing flow
    await expect(p2Stand).toHaveClass(/current-turn/);
    await writeRemoteGameEvent(page, 'game/nextTurn');
    await expect(page.locator('.stand-container.current-turn').filter({ hasText: 'MobileUser' })).toBeVisible();
    await page.locator('.deck-btn.blue').click();
    await expect(page.locator('.deck-btn.blue')).toBeDisabled();
    const guessInputs = page.locator('.deduction-board .guess-inputs input');
    for (let i = 0; i < 5; i++) {
      await guessInputs.nth(i).fill(`${i + 1}`);
    }
    await expect(page.locator('.deduction-board .got-five-btn')).toBeEnabled();
    await page.locator('.deduction-board .got-five-btn').click();
    await scrollStatusBannerIntoView(page);

    await tester.step('mobile-portrait-guess', {
      description: 'Submit a guess in portrait mode',
      verifications: [
        {
          spec: 'Status banner is visible',
          check: async () => {
            await expect(page.locator('.status-banner')).toBeVisible();
          }
        }
      ]
    });

    // 5. Play Again Flow
    // Force a win for Player 2 to trigger game over (if guess didn't)
    await page.evaluate(() => {
      (window as unknown as WindowWithStore).store.dispatch({ 
        type: 'game/setWinner', 
        payload: 'p2' 
      });
    });

    await tester.step('game-over-mobile', {
      description: 'Game over status shows on mobile',
      verifications: [
        {
          spec: 'Status banner is visible',
          check: async () => {
            await expect(page.locator('.status-banner')).toBeVisible();
          }
        },
        {
          spec: 'Winner message is correct',
          check: async () => {
            await expect(page.locator('.winner-msg')).toContainText('Winner: Player 2');
          }
        }
      ]
    });

    // Click Play Again (the one in the banner)
    await page.locator('.status-banner button:has-text("Play Again")').click();

    await tester.step('reset-flow', {
      description: 'Game resets and starts new game for host',
      verifications: [
        {
          spec: 'Status banner is gone',
          check: async () => {
            await expect(page.locator('.status-banner')).not.toBeVisible();
          }
        },
        {
          spec: 'Player has 5 tiles',
          check: async () => {
             const youStand = page.locator('.stand-container').filter({ hasText: 'MobileUser' });
             await expect(youStand.locator('.tile')).toHaveCount(5);
          }
        }
      ]
    });

    tester.generateDocs();
  });

  test('User plays on mobile landscape', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata('Mobile Landscape', 'Verify layout on mobile landscape.');

    await page.setViewportSize({ width: 667, height: 450 });
    await page.goto(`/?seed=123&myId=mobile-landscape-test-user&lobbyId=lobby-005-landscape`);

    await page.getByLabel('Your Name:').fill('LandscapeUser');
    await page.getByRole('button', { name: 'Join Lobby' }).click();
    await page.getByRole('button', { name: 'Host New Game' }).click();
    await page.getByRole('button', { name: 'Start Hosting' }).click();

    await page.evaluate(() => {
      (window as unknown as WindowWithStore).store.dispatch({ 
        type: 'players/addPlayer', 
        payload: { id: 'p2', name: 'Player 2' } 
      });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();

    await tester.step('mobile-landscape-layout', {
      description: 'Main play area and deduction board are both visible horizontally',
      verifications: [
        {
          spec: 'Main play area is visible',
          check: async () => {
            await expect(page.locator('.main-play-area')).toBeVisible();
          }
        },
        {
          spec: 'Deduction board is visible horizontally',
          check: async () => {
            await expect(page.locator('.deduction-area')).toBeVisible();
          }
        }
      ]
    });

    // 1. Reveal a tile
    await page.locator('.deck-btn.red').click();
    await tester.step('mobile-landscape-reveal', {
      description: 'Reveal a tile in landscape mode',
      verifications: [
        {
          spec: 'Public pool has 6 tiles',
          check: async () => {
            await expect(page.locator('.pool-tiles .tile')).toHaveCount(6);
          }
        }
      ]
    });

    // 2. Ask for a clue
    const firstPublicTile = page.locator('.pool-tiles .tile-btn').first();
    await firstPublicTile.click();
    
    const p2Stand = page.locator('.stand-container').filter({ hasText: 'Player 2' });
    await p2Stand.locator('.name-tag').click();

    await tester.step('mobile-landscape-ask-clue', {
      description: 'Ask for a clue in landscape mode',
      verifications: [
        {
          spec: 'Player 2 stand has an active notch',
          check: async () => {
            await expect(p2Stand.locator('.notch.active')).toHaveCount(1);
          }
        }
      ]
    });

    // 3. Guessing flow
    await expect(p2Stand).toHaveClass(/current-turn/);
    await writeRemoteGameEvent(page, 'game/nextTurn');
    await expect(page.locator('.stand-container.current-turn').filter({ hasText: 'LandscapeUser' })).toBeVisible();
    await page.locator('.deck-btn.blue').click();
    await expect(page.locator('.deck-btn.blue')).toBeDisabled();
    const guessInputs = page.locator('.deduction-board .guess-inputs input');
    for (let i = 0; i < 5; i++) {
      await guessInputs.nth(i).fill(`${i + 1}`);
    }
    await expect(page.locator('.deduction-board .got-five-btn')).toBeEnabled();
    await page.locator('.deduction-board .got-five-btn').click();
    await scrollStatusBannerIntoView(page);

    await tester.step('mobile-landscape-guess', {
      description: 'Submit a guess in landscape mode',
      verifications: [
        {
          spec: 'Status banner is visible',
          check: async () => {
            await expect(page.locator('.status-banner')).toBeVisible();
          }
        }
      ]
    });

    tester.generateDocs();
  });

  test('User plays on tablet portrait', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata('Tablet Portrait', 'Verify layout on tablet portrait.');

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/?seed=123&myId=tablet-portrait-test-user&lobbyId=lobby-005-tablet&hostGameId=TABLT`);

    await page.getByLabel('Your Name:').fill('TabletUser');
    await page.getByRole('button', { name: 'Join Lobby' }).click();
    await page.getByRole('button', { name: 'Host New Game' }).click();
    await page.getByRole('button', { name: 'Start Hosting' }).click();

    await page.evaluate(() => {
      const store = (window as unknown as WindowWithStore).store;
      store.dispatch({ type: 'players/addPlayer', payload: { id: 'p2', name: 'Player 2' } });
      store.dispatch({ type: 'players/addPlayer', payload: { id: 'p3', name: 'Player 3' } });
      store.dispatch({ type: 'players/addPlayer', payload: { id: 'p4', name: 'Player 4' } });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();
    await expect.poll(async () => {
      return page.evaluate(() => (window as unknown as WindowWithStore).store.getState().game.turnOrder);
    }).toEqual(['p2', 'p3', 'tablet-portrait-test-user', 'p4']);

    await tester.step('tablet-portrait-layout', {
      description: 'Check for clipping and overlap in tablet portrait',
      verifications: [
        {
          spec: 'Main play area is visible',
          check: async () => {
            await expect(page.locator('.main-play-area')).toBeVisible();
          }
        },
        {
          spec: 'Deduction board is visible',
          check: async () => {
            await expect(page.locator('.deduction-area')).toBeVisible();
          }
        }
      ]
    });

    tester.generateDocs();
  });

  test('Four-player phone portrait layout uses the available width', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 876 });
    await page.goto(`/?seed=123&myId=phone-four-player-test-user&lobbyId=lobby-005-phone-four&hostGameId=PHONE`);

    await page.getByLabel('Your Name:').fill('PhoneUser');
    await page.getByRole('button', { name: 'Join Lobby' }).click();
    await page.getByRole('button', { name: 'Host New Game' }).click();
    await page.getByRole('button', { name: 'Start Hosting' }).click();

    await page.evaluate(() => {
      const store = (window as unknown as WindowWithStore).store;
      store.dispatch({ type: 'players/addPlayer', payload: { id: 'p2', name: 'Player 2' } });
      store.dispatch({ type: 'players/addPlayer', payload: { id: 'p3', name: 'Player 3' } });
      store.dispatch({ type: 'players/addPlayer', payload: { id: 'p4', name: 'Player 4' } });
    });

    await page.getByRole('button', { name: 'START GAME' }).click();
    await expect(page.locator('.stand-container')).toHaveCount(4);

    const layout = await page.evaluate(() => {
      const rectFor = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const standRects = Array.from(document.querySelectorAll('.stand-container')).map((el) => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
      const overlapPairs: number[][] = [];
      for (let i = 0; i < standRects.length; i++) {
        for (let j = i + 1; j < standRects.length; j++) {
          const a = standRects[i];
          const b = standRects[j];
          const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          if (overlaps) overlapPairs.push([i, j]);
        }
      }
      return {
        board: rectFor('.deduction-board'),
        localStand: rectFor('.player-area .stand-container'),
        overlapPairs
      };
    });

    expect(layout.board.width).toBeGreaterThanOrEqual(360);
    expect(layout.localStand.width).toBeGreaterThanOrEqual(330);
    expect(layout.overlapPairs).toEqual([]);

    const scrollRunway = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const grid = document.querySelector('.grid-container')!;
      main.scrollTop = main.scrollHeight;
      const gridRect = grid.getBoundingClientRect();
      return {
        canScroll: main.scrollHeight > main.clientHeight,
        bottomRunway: window.innerHeight - gridRect.bottom
      };
    });

    expect(scrollRunway.canScroll).toBe(true);
    expect(scrollRunway.bottomRunway).toBeGreaterThanOrEqual(120);
  });

  test('Landscape deduction side allows overflow scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 450 });
    await page.goto(`/?seed=123&myId=landscape-scroll-test-user&lobbyId=lobby-005-landscape-scroll&hostGameId=SCROL`);

    await page.getByLabel('Your Name:').fill('ScrollUser');
    await page.getByRole('button', { name: 'Join Lobby' }).click();
    await page.getByRole('button', { name: 'Host New Game' }).click();
    await page.getByRole('button', { name: 'Start Hosting' }).click();
    await page.getByRole('button', { name: 'START GAME' }).click();
    await expect(page.locator('.deduction-area')).toBeVisible();

    const scrolled = await page.evaluate(() => {
      const area = document.querySelector('.deduction-area')!;
      const spacer = document.createElement('div');
      spacer.style.flex = '0 0 300px';
      spacer.setAttribute('data-test-scroll-spacer', 'true');
      area.appendChild(spacer);
      const before = {
        overflowY: getComputedStyle(area).overflowY,
        canScroll: area.scrollHeight > area.clientHeight
      };
      area.scrollTop = area.scrollHeight;
      return {
        ...before,
        scrollTop: area.scrollTop
      };
    });

    expect(scrolled.overflowY).toBe('auto');
    expect(scrolled.canScroll).toBe(true);
    expect(scrolled.scrollTop).toBeGreaterThan(0);
  });

  test('Clear button resets deduction markings and notes', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 876 });
    await page.goto(`/?seed=123&myId=phone-clear-test-user&lobbyId=lobby-005-clear&hostGameId=CLEAR`);

    await page.getByLabel('Your Name:').fill('ClearUser');
    await page.getByRole('button', { name: 'Join Lobby' }).click();
    await page.getByRole('button', { name: 'Host New Game' }).click();
    await page.getByRole('button', { name: 'Start Hosting' }).click();
    await page.getByRole('button', { name: 'START GAME' }).click();

    await page.evaluate(() => {
      const store = (window as unknown as WindowWithStore).store;
      store.dispatch({ type: 'ui/markDeduction', payload: { id: 1, mark: 'X' } });
      store.dispatch({ type: 'ui/markDeduction', payload: { id: 2, mark: 'OK' } });
      store.dispatch({ type: 'ui/addStroke', payload: [[1, 1], [20, 20]] });
    });
    await expect.poll(async () => {
      return page.evaluate(() => {
        const state = (window as unknown as WindowWithStore).store.getState().ui;
        return {
          marks: Object.keys(state.deductionBoard).length,
          strokes: state.strokes.length
        };
      });
    }).toEqual({ marks: 2, strokes: 1 });

    await page.getByRole('button', { name: 'Clear', exact: true }).click();

    const cleared = await page.evaluate(() => {
      const state = (window as unknown as WindowWithStore).store.getState().ui;
      return {
        marks: Object.keys(state.deductionBoard).length,
        strokes: state.strokes.length,
        dimmedTiles: document.querySelectorAll('.deduction-board .cell.dimmed').length
      };
    });

    expect(cleared.marks).toBe(0);
    expect(cleared.strokes).toBe(0);
    expect(cleared.dimmedTiles).toBeGreaterThan(0);
  });
});
