import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import Device, { type DeviceInput } from './Device';

afterEach(cleanup);

it.each([undefined, null, {}])('handles missing device data: %s', (anomaly) => {
  render(<Device anomaly={anomaly} />);
  expect(screen.getByRole('heading').textContent).toBe('Device Unknown');
  expect(screen.getAllByText('Unknown')).toHaveLength(3);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Temperature: Unknown (limit 65°C)')).toBeTruthy();
});

it('treats invalid fields as unknown without rendering invalid values', () => {
  const anomaly = { deviceId: ' ', deviation: {}, current: NaN, temperature: 'hot' } as unknown as DeviceInput;
  render(<Device anomaly={anomaly} />);
  expect(screen.getAllByText('Unknown')).toHaveLength(3);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
});

it('calculates percentages against the limits and preserves zero readings', () => {
  const { rerender } = render(<Device anomaly={{ current: 15, temperature: 78 }} />);
  expect(screen.getByText('Temperature: +20.0% (limit 65°C)')).toBeTruthy();
  expect(screen.getByText('Current: +25.0% (limit 12 A)')).toBeTruthy();
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  rerender(<Device anomaly={{ current: 0, temperature: 65 }} />);
  expect(screen.getByText('0 A')).toBeTruthy();
  expect(screen.getByText('Current: -100.0% (limit 12 A)')).toBeTruthy();
  expect(screen.getByText('Temperature: 0.0% (limit 65°C)')).toBeTruthy();
});
