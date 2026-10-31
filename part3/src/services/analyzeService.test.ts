import { afterEach, expect, it, vi } from 'vitest';
import { analyzeService, setAnalyzeServiceUnavailable } from './analyzeService';

afterEach(() => { vi.useRealTimers(); setAnalyzeServiceUnavailable(false); });
const device = { deviceId: 'DEV-001', deviceName: 'Pump', deviation: 'Demo anomaly' };

it('simulates an outage and recovers when the toggle is turned off', async () => {
  vi.useFakeTimers();
  setAnalyzeServiceUnavailable(true);
  const failure = expect(analyzeService({ ...device, temperature: 80, current: 18 }))
    .rejects.toThrow('Anomaly analyze service is not available, please try again later.');
  await vi.runAllTimersAsync();
  await failure;
  setAnalyzeServiceUnavailable(false);
  const response = analyzeService({ ...device, temperature: 80, current: 18 });
  await vi.runAllTimersAsync();
  expect(await response).toContain('Temperature is high');
});

it.each([
  { temperature: 66, current: 12, hot: true, overloaded: false },
  { temperature: 65, current: 13, hot: false, overloaded: true },
  { temperature: 80, current: 18, hot: true, overloaded: true },
  { temperature: 65, current: 12, hot: false, overloaded: false },
  { temperature: 25, current: 5, hot: false, overloaded: false },
])('returns actions for temperature $temperature and current $current', async ({ temperature, current, hot, overloaded }) => {
  vi.useFakeTimers();
  const response = analyzeService({ ...device, temperature, current });
  await vi.runAllTimersAsync();
  const message = await response;
  expect(message).toContain(device.deviceId);
  expect(message.includes('Temperature is high')).toBe(hot);
  expect(message.includes('Current is high')).toBe(overloaded);
  if (hot) expect(message).toContain('check for obstructed ventilation');
  if (overloaded) expect(message).toContain('Reduce the connected workload');
  if (!hot && !overloaded) expect(message).toContain('verify the sensor readings before dismissing the alert');
});

it('rejects missing IDs and invalid sensor readings', async () => {
  await expect(analyzeService({ ...device, deviceId: ' ', temperature: 25, current: 5 })).rejects.toThrow('device ID');
  await expect(analyzeService({ ...device, temperature: NaN, current: 5 })).rejects.toThrow('finite numbers');
  await expect(analyzeService({ ...device, temperature: 25, current: Infinity })).rejects.toThrow('finite numbers');
});
