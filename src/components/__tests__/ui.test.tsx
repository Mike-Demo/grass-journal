import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiBadge, SaveIndicator } from '../ui';

describe('SaveIndicator', () => {
  it.each([
    ['saving', 'Saving…'],
    ['saved', 'Saved on this device'],
    ['error', 'Save failed'],
    ['idle', 'Not saved yet'],
  ] as const)('announces state "%s" via live region', (state, text) => {
    render(<SaveIndicator state={state} />);
    const el = screen.getByTestId('save-indicator');
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el.textContent).toContain(text);
  });
});

describe('AiBadge', () => {
  it('labels AI output as AI-generated with its model', () => {
    render(<AiBadge model="qwen2.5-0.5b-instruct" />);
    const badge = screen.getByLabelText(/AI-generated content, model qwen2\.5/i);
    expect(badge.textContent).toContain('AI-generated');
    expect(badge.textContent).toContain('editable');
  });
});
