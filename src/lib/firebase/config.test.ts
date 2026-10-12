import { describe, expect, test } from 'bun:test';
import { shouldUseFetchStreams } from './config';

describe('Firestore transport selection', () => {
	test('disables Fetch Streams in desktop Safari and iOS WebKit browsers', () => {
		expect(shouldUseFetchStreams({
			userAgent: 'Mozilla/5.0 (Macintosh) Version/26.5 Safari/626.2.5',
			platform: 'MacIntel',
			maxTouchPoints: 0
		})).toBe(false);
		expect(shouldUseFetchStreams({
			userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
			platform: 'iPhone',
			maxTouchPoints: 5
		})).toBe(false);
		expect(shouldUseFetchStreams({
			userAgent: 'Mozilla/5.0 (Macintosh) Version/26.5 Safari/626.2.5',
			platform: 'MacIntel',
			maxTouchPoints: 5
		})).toBe(false);
	});

	test('keeps Fetch Streams enabled in Chromium', () => {
		expect(shouldUseFetchStreams({
			userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
			platform: 'MacIntel',
			maxTouchPoints: 0
		})).toBe(true);
	});
});
