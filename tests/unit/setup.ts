import {TestBed} from '@angular/core/testing';
import {afterEach, vi} from 'vitest';

afterEach(() => {
  // Destroy fixtures and subscriptions while their test clock is still active.
  TestBed.resetTestingModule();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
