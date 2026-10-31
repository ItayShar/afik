# Telemetry Alerts Dashboard — Part 3

React + TypeScript app, styled with Tailwind CSS through its Vite plugin.

```powershell
cd 'D:\afik\part 3'
npm install
npm run dev
```

`npm run build` checks TypeScript and creates the production build. `npm test` checks the analysis button's request, loading, response, and retry behavior.

`src/main.tsx` renders a TelemetryAlertsDashboard with 10 example devices. The carousel displays up to three cards and moves one device per click, wrapping in either direction. Navigation is disabled for three or fewer devices. All UI components live in `src/components`. The analysis button passes the device's data to `src/services/analyzeService.ts`. This async local mock simulates latency; it does not call an external API.

The analysis uses demo limits of 65°C and 12 A. Values above either limit produce corresponding actions; when both are high, both sets of actions appear. Readings at or below both limits prompt a review of the deviation and sensor history. These demo limits should be replaced with device-specific rated limits before using real telemetry.

Tailwind setup follows https://tailwindcss.com/docs/installation/using-vite.
