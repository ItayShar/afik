import { useRef, useState } from 'react';
import { analyzeService, type DeviceAnomaly } from '../services/analyzeService';

export default function AnalyzeAnomalyButton({ anomaly }: { anomaly?: DeviceAnomaly }) {
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const unavailable = !anomaly;
  const analyzed = message !== '';
  const buttonStyle = unavailable || analyzed
    ? 'cursor-not-allowed bg-slate-200 text-slate-500'
    : loading
      ? 'cursor-wait bg-indigo-600 text-white opacity-60'
      : 'cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700';

  async function analyze() {
    if (inFlight.current || !anomaly || analyzed) return;
    inFlight.current = true;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      setMessage(await analyzeService(anomaly));
    } catch {
      setError('Anomaly analyze service is not available, please try again later.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={analyze}
        disabled={loading || unavailable || analyzed}
        aria-busy={loading && !unavailable}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 ${buttonStyle}`}
      >
        {loading && !unavailable ? 'Analyzing anomaly…' : 'Analyze with AI'}
      </button>
      {!anomaly && <p className="mt-3 text-sm text-slate-500">Analysis requires valid current and temperature readings.</p>}
      <p role="status" className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
