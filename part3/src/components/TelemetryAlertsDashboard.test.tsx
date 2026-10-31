import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import TelemetryAlertsDashboard from './TelemetryAlertsDashboard';

afterEach(cleanup);
const devices = Array.from({ length: 10 }, (_, index) => ({
  deviceId: String(index + 1), deviceName: 'Pump', current: 12, temperature: 82, deviation: 'High temperature',
}));
const displayedIds = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

it('shows three devices and wraps in both directions', () => {
  render(<TelemetryAlertsDashboard devices={devices} />);
  expect(displayedIds()).toEqual(['Device 1', 'Device 2', 'Device 3']);
  fireEvent.click(screen.getByRole('button', { name: 'Previous device' }));
  expect(screen.getByTestId('carousel-track').style.transform).toBe('translateX(0)');
  fireEvent(screen.getByTestId('carousel-track'), Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'transform' }));
  expect(displayedIds()).toEqual(['Device 10', 'Device 1', 'Device 2']);
  fireEvent.click(screen.getByRole('button', { name: 'Next device' }));
  expect(screen.getByTestId('carousel-track').style.transform).toBe('translateX(-33.333333%)');
  fireEvent(screen.getByTestId('carousel-track'), Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'transform' }));
  expect(displayedIds()).toEqual(['Device 1', 'Device 2', 'Device 3']);
  for (let index = 0; index < 10; index++) {
    fireEvent.click(screen.getByRole('button', { name: 'Next device' }));
    fireEvent(screen.getByTestId('carousel-track'), Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'transform' }));
  }
  expect(displayedIds()).toEqual(['Device 1', 'Device 2', 'Device 3']);
});

it.each([0, 1, 2, 3])('disables navigation for %i devices without duplicating cards', (count) => {
  render(<TelemetryAlertsDashboard devices={devices.slice(0, count)} />);
  const previous = screen.getByRole('button', { name: 'Previous device' }) as HTMLButtonElement;
  const next = screen.getByRole('button', { name: 'Next device' }) as HTMLButtonElement;
  expect(previous.disabled).toBe(true);
  expect(next.disabled).toBe(true);
  fireEvent.click(next);
  expect(screen.queryAllByRole('article')).toHaveLength(count);
});
