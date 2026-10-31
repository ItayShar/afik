import AnalyzeAnomalyButton from './AnalyzeAnomalyButton';
import { MAX_CURRENT, MAX_TEMPERATURE, type DeviceAnomaly } from '../services/analyzeService';

export type DeviceInput = { [Key in keyof DeviceAnomaly]?: DeviceAnomaly[Key] | null };

function textOrUnknown(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Unknown';
}

function reading(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function deviationPercent(value: number | undefined, limit: number) {
  if (value === undefined) return 'Unknown';
  const percentage = ((value - limit) / limit) * 100;
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
}

export default function Device({ anomaly }: { anomaly?: DeviceInput | null }) {
  const deviceId = textOrUnknown(anomaly?.deviceId);
  const deviceName = textOrUnknown(anomaly?.deviceName);
  const deviation = textOrUnknown(anomaly?.deviation);
  const current = reading(anomaly?.current);
  const temperature = reading(anomaly?.temperature);
  const analysisInput = current !== undefined && temperature !== undefined
    ? { deviceId, deviceName, deviation, current, temperature }
    : undefined;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Device {deviceId}</h2>
      <dl className="my-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-slate-500">Current</dt>
          <dd className="mt-1 text-2xl font-semibold">{current === undefined ? 'Unknown' : `${current} A`}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Temperature</dt>
          <dd className="mt-1 text-2xl font-semibold">{temperature === undefined ? 'Unknown' : `${temperature} °C`}</dd>
        </div>
        <div className="col-span-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <dt className="font-semibold">Deviation</dt>
          <dd>{deviation}</dd>
          <dt className="mt-3 font-semibold">Deviation from demo limits</dt>
          <dd>Temperature: {deviationPercent(temperature, MAX_TEMPERATURE)} (limit {MAX_TEMPERATURE}°C)</dd>
          <dd>Current: {deviationPercent(current, MAX_CURRENT)} (limit {MAX_CURRENT} A)</dd>
        </div>
      </dl>
      <AnalyzeAnomalyButton anomaly={analysisInput} />
    </article>
  );
}
