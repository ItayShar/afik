import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TelemetryAlertsDashboard from './components/TelemetryAlertsDashboard';
import { setAnalyzeServiceUnavailable } from './services/analyzeService';
import './styles.css';

const devices = [
  { temperature: 75, current: 10, deviation: 'Temperature exceeds the upper limit; current remains within range.' },
  { temperature: 55, current: 15, deviation: 'Current exceeds the expected load limit; temperature remains within range.' },
  { temperature: 82, current: 18, deviation: 'Both temperature and current exceed their limits.' },
  { temperature: 68, current: 8, deviation: 'Temperature is slightly above the upper limit.' },
  { temperature: 45, current: 20, deviation: 'Current is substantially above the expected load limit.' },
  { temperature: 91, current: 11, deviation: 'Temperature is substantially above the upper limit despite current being within range.' },
  { temperature: 70, current: 13, deviation: 'Temperature and current are both slightly elevated.' },
  { temperature: 60, current: 14, deviation: 'Current is elevated while temperature remains below its limit.' },
  { temperature: 82, deviation: 'Temperature exceeds the upper limit; current reading is unavailable.' },
  { current: 18, deviation: 'Current exceeds the expected load limit; temperature reading is unavailable.' }
].map((device, index) => ({
  ...device,
  deviceId: `DEV-${String(index + 1).padStart(3, '0')}`,
  deviceName: `Example device ${index + 1}`,
}));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="mx-auto max-w-6xl px-6 py-12">
      <label className="mb-6 flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          onChange={(event) => setAnalyzeServiceUnavailable(event.target.checked)}
          className="h-4 w-4 accent-indigo-600"
        />
        Simulate analysis service being down
      </label>
      <TelemetryAlertsDashboard devices={devices} />
    </main>
  </StrictMode>,
);
