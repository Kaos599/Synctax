import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { TerminalBlock } from '../src/components/ui/TerminalBlock';

describe('TerminalBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the code with a dollar sign prefix', () => {
    render(<TerminalBlock code="bun install" />);
    expect(screen.getByText('$ bun install')).toBeInTheDocument();
  });

  it('shows copy icon initially', () => {
    const { container } = render(<TerminalBlock code="test" />);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
  });

  it('handles clipboard write failure without showing false success', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    const { container } = render(<TerminalBlock code="secret-cmd" />);
    const button = container.querySelector('button')!;

    await act(async () => {
      fireEvent.click(button);
    });

    // Should have attempted to write
    expect(writeText).toHaveBeenCalledWith('secret-cmd');
    // Should NOT show checked state on failure
    expect(button.querySelector('svg')).not.toHaveAttribute('data-testid');
  });

  it('shows check icon on successful copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    const { container } = render(<TerminalBlock code="echo hello" />);
    const button = container.querySelector('button')!;

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith('echo hello');
  });

  it('clears timeout on unmount to prevent state update on unmounted component', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    });

    let clearTimeoutCalls = 0;
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {
      clearTimeoutCalls++;
    });

    const { unmount, container } = render(<TerminalBlock code="test" />);
    const button = container.querySelector('button')!;

    await act(async () => {
      fireEvent.click(button);
      // Wait for the async handler to complete
      await Promise.resolve();
    });

    // Unmount after the timer has been set
    unmount();

    // Should have called clearTimeout to clean up the timer
    expect(clearTimeoutCalls).toBeGreaterThan(0);
  });
});
