import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AnalyzeAnomalyButton from './components/AnalyzeAnomalyButton';
import TelemetryAlertsDashboard from './components/TelemetryAlertsDashboard';
import { analyzeService } from './services/analyzeService';

vi.mock('./services/analyzeService', async (importOriginal) => ({
  ...await importOriginal<typeof import('./services/analyzeService')>(),
  analyzeService: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const anomaly = { deviceId: 'DEV-001', deviceName: 'Pump', current: 12, temperature: 82, deviation: 'High temperature' };

it('sends device data, disables duplicate requests, and shows the response', async () => {
  let resolve!: (message: string) => void;
  vi.mocked(analyzeService).mockReturnValue(new Promise<string>((done) => { resolve = done; }));
  render(<AnalyzeAnomalyButton anomaly={anomaly} />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  expect(analyzeService).toHaveBeenCalledWith(anomaly);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(analyzeService).toHaveBeenCalledTimes(1);
  resolve('Simulated analysis result');
  await screen.findByText('Simulated analysis result');
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(button.className).toContain('bg-slate-200');
  fireEvent.click(button);
  expect(analyzeService).toHaveBeenCalledTimes(1);
});

it('keeps a visible result disabled and resets after the card leaves and returns', async () => {
  vi.mocked(analyzeService).mockResolvedValue('Analysis complete');
  const devices = Array.from({ length: 4 }, (_, index) => ({ ...anomaly, deviceId: `DEV-${index}` }));
  render(<TelemetryAlertsDashboard devices={devices} />);
  const deviceButton = () => within(screen.getByRole('heading', { name: 'Device DEV-1' }).closest('article')!).getByRole('button') as HTMLButtonElement;
  const navigate = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name }));
    fireEvent(screen.getByTestId('carousel-track'), Object.assign(new Event('transitionend', { bubbles: true }), { propertyName: 'transform' }));
  };
  fireEvent.click(deviceButton());
  await screen.findByText('Analysis complete');
  navigate('Next device');
  expect(deviceButton().disabled).toBe(true);
  expect(screen.getByText('Analysis complete')).toBeTruthy();
  navigate('Next device');
  expect(screen.queryByText('Analysis complete')).toBeNull();
  navigate('Previous device');
  expect(deviceButton().disabled).toBe(false);
  fireEvent.click(deviceButton());
  await screen.findByText('Analysis complete');
  expect(analyzeService).toHaveBeenCalledTimes(2);
});

it('allows retry after a failed request', async () => {
  vi.mocked(analyzeService).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce('Recovered');
  render(<AnalyzeAnomalyButton anomaly={anomaly} />);
  fireEvent.click(screen.getByRole('button'));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toBe('Anomaly analyze service is not available, please try again later.');
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button'));
  await screen.findByText('Recovered');
  expect(screen.queryByRole('alert')).toBeNull();
});
