import { useLayoutEffect, useRef, useState } from 'react';
import Device, { type DeviceInput } from './Device';

export default function TelemetryAlertsDashboard({ devices }: { devices: DeviceInput[] }) {
  const [startIndex, setStartIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const canNavigate = devices.length > 3;
  const start = devices.length ? startIndex % devices.length : 0;
  const visibleDevices = Array.from(
    { length: Math.min(3, devices.length) },
    (_, offset) => devices[(start + offset) % devices.length],
  );
  const trackDevices = direction === -1
    ? [devices[(start - 1 + devices.length) % devices.length], ...visibleDevices]
    : direction === 1
      ? [...visibleDevices, devices[(start + 3) % devices.length]]
      : visibleDevices;

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // Place the incoming card before starting the transition. Reset without
    // animating when the outgoing card is removed at the end of the glide.
    track.style.transition = 'none';
    track.style.transform = direction === -1 ? 'translateX(-33.333333%)' : 'translateX(0)';
    if (!direction) return;
    // Commit the starting position so the browser transitions between two
    // distinct transforms, including consecutive clicks in the same direction.
    track.getBoundingClientRect();
    track.style.removeProperty('transition');
    track.style.transform = direction === 1 ? 'translateX(-33.333333%)' : 'translateX(0)';
  }, [direction]);

  function navigate(direction: number) {
    if (!canNavigate) return;
    setDirection((current) => current || direction);
  }

  function finishGlide() {
    if (!direction) return;
    setStartIndex((index) => (index + direction + devices.length) % devices.length);
    setDirection(0);
  }

  const buttonClass = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400';

  return (
    <section aria-label="Telemetry alerts" aria-roledescription="carousel">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Telemetry Alerts Dashboard</h1>
        <div className="flex gap-3">
          <button type="button" aria-label="Previous device" disabled={!canNavigate} onClick={() => navigate(-1)} className={buttonClass}>← Previous</button>
          <button type="button" aria-label="Next device" disabled={!canNavigate} onClick={() => navigate(1)} className={buttonClass}>Next →</button>
        </div>
      </div>
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="carousel-track"
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === 'transform') finishGlide();
          }}
          data-testid="carousel-track"
        >
          {trackDevices.map((device, index) => {
            const entering = (direction === -1 && index === 0) || (direction === 1 && index === 3);
            return (
              <div key={device.deviceId || `unknown-${index}`} className="carousel-card" aria-hidden={entering || undefined} inert={entering || undefined}>
                <Device anomaly={device} />
              </div>
            );
          })}
        </div>
      </div>
      <p role="status" className="mt-4 text-sm text-slate-500">
        {devices.length ? `Showing devices ${visibleDevices.map((device) => device.deviceId || 'Unknown').join(', ')} of ${devices.length}` : 'No device anomalies to display.'}
      </p>
    </section>
  );
}
