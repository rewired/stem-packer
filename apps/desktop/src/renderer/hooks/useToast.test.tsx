import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the toast visible for at least ten seconds', () => {
    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('hello');
    });

    expect(timeoutSpy).toHaveBeenCalled();
    const call = timeoutSpy.mock.calls.at(-1);
    expect(call?.[1]).toBeGreaterThanOrEqual(10_000);

    timeoutSpy.mockRestore();
  });
});
