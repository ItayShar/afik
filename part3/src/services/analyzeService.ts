export type DeviceAnomaly = {
  deviceId: string;
  deviceName: string;
  current: number;
  temperature: number;
  deviation: string;
};

// Demo limits; replace with each device's rated limits before using real telemetry.
export const MAX_TEMPERATURE = 65;
export const MAX_CURRENT = 12;

let simulateServiceDown = false;

export function setAnalyzeServiceUnavailable(unavailable: boolean) {
  simulateServiceDown = unavailable;
}

export async function analyzeService(anomaly: DeviceAnomaly): Promise<string> {
  if (!anomaly.deviceId.trim()) throw new Error('A device ID is required.');
  if (!Number.isFinite(anomaly.temperature) || !Number.isFinite(anomaly.current)) {
    throw new Error('Temperature and current must be finite numbers.');
  }
  // Simulate service latency locally; no external AI or HTTP endpoint is used.
  const serviceDown = simulateServiceDown;
  await new Promise<void>((resolve) => setTimeout(resolve, 700));
  if (serviceDown) throw new Error('Anomaly analyze service is not available, please try again later.');
  const actions: string[] = [];
  if (anomaly.temperature > MAX_TEMPERATURE) {
    actions.push(`Temperature is high (${anomaly.temperature}°C; demo limit ${MAX_TEMPERATURE}°C). Follow the device's operating procedure to reduce load, then check for obstructed ventilation or cooling-system alerts. Recheck the temperature after the device has cooled; contact maintenance if it remains above the limit.`);
  }
  if (anomaly.current > MAX_CURRENT) {
    actions.push(`Current is high (${anomaly.current} A; demo limit ${MAX_CURRENT} A). Reduce the connected workload according to the device's operating procedure and recheck the current. If it remains above the limit, ask maintenance to inspect for overload or a mechanical obstruction before resuming normal operation.`);
  }
  if (actions.length === 0) {
    actions.push(`Temperature (${anomaly.temperature}°C) and current (${anomaly.current} A) are within the demo limits of ${MAX_TEMPERATURE}°C and ${MAX_CURRENT} A. Review the reported deviation and recent telemetry history, and verify the sensor readings before dismissing the alert.`);
  }
  return `Simulated analysis for ${anomaly.deviceId}: ${actions.join(' ')}`;
}
