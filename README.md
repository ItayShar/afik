# Telemetry Processing and Alerts Dashboard

This project includes a Python telemetry processor (part 1) and a React dashboard (part 3). They run independently; the dashboard uses example data and a local mock analysis service, so no backend server or AI API key is required.

Part 2 contains a MySQL anomaly query and database design notes. Parts 4 and 5 document the AI-assisted development workflow and discuss hardware, security, and product integration considerations.

## Assumptions & Design Choices

1. **Calculated power must be nonnegative.** The project assumes power represents consumption, so records where `voltage * current` is negative are rejected and excluded from the summary. This assumption would need to be revisited if the system supported signed power or energy export.

2. **A temperature of -2 makes only the health factor unavailable.** The health factor formula divides by `temperature + 2`, which is zero at this temperature. For an otherwise valid record, we retain its power in the device's total and increment its sample count, but skip the health factor calculation and report it as unavailable. The record does not contribute to the health sample count or average; if no health samples are available, the average is `None`.

## Prerequisites

- Git.
- Python 3.11 or newer for part 1, or Docker with Linux container support.
- Node.js 22.12+ within the 22.x release line, or Node.js 24.x, with npm for part 3. These versions satisfy the project's Vite and Vitest requirements.

### Install prerequisites on macOS

Install [Homebrew](https://brew.sh/) if it is not already available, then run:

```sh
brew install git python node@24
export PATH="$(brew --prefix node@24)/bin:$PATH"
```

The [Node.js 24 Homebrew package](https://formulae.brew.sh/formula/node@24) includes npm. Add the `export PATH` line to `~/.zshrc` to keep this Node.js version available in new zsh terminals (or `~/.bashrc` if using Bash).

### Install prerequisites on Linux

On Ubuntu 24.04 or Debian 12, install Git, Python, and virtual environment support:

```sh
sudo apt update
sudo apt install git python3 python3-venv python3-pip
```

For other distributions, use their package manager to install Git and Python 3.11+ with virtual environment support.

Install nvm using its [official installation instructions](https://github.com/nvm-sh/nvm#installing-and-updating), reopen your terminal, then install Node.js and npm:

```sh
nvm install 24
nvm use 24
```

### Verify the tools on macOS or Linux

```sh
git --version
python3 --version
node --version
npm --version
```

Then clone the repository and follow the macOS/Linux instructions for part 1 and the cross-platform instructions for part 3 below.

## Clone the repository

Replace `YOUR_REPOSITORY_URL` with this repository's HTTPS or SSH clone URL. No remote URL was configured in the checkout when this README was written.

```sh
git clone YOUR_REPOSITORY_URL afik
cd afik
```

All sections below start from the repository root. Use a separate terminal for each part, or return to the root with `cd ..` before switching parts.

## Part 1: Python telemetry processing

The processor validates telemetry records and produces per-device power totals, average health factors, and validation reports. `main.py` prints examples of valid records, rejected records, unavailable health values, and aggregate overflow handling.

### Run with Docker (Windows, macOS, or Linux)

Install and start Docker (Docker Desktop using Linux containers on Windows).
After cloning, run these commands from the repository root in PowerShell, Bash,
or zsh. Python and a local virtual environment are not required:

```sh
docker build -t afik-telemetry ./part1
docker run --rm afik-telemetry
```

The image uses Python 3.12, installs the dependencies, and runs the five examples
in `main.py`. It prints results and exits; no ports or volume mounts are needed.
The final example catches and prints the expected aggregate `OverflowError`.
Local virtual environments and caches are excluded from the build context.

Run the correctness tests using the same image:

```sh
docker run --rm afik-telemetry python -m pytest -q -p no:cacheprovider
```

Rebuild the image after changing the Python files or requirements. This image
runs part 1 only; follow the separate instructions below for the dashboard.

### Install and run on Windows (PowerShell)

```powershell
cd part1
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe main.py
```

Ensure the Python selected by `py -3` is version 3.11 or newer. These commands use the virtual environment directly, so activation is not required.

Run the tests from the same directory:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

### Install and run on macOS or Linux

```sh
cd part1
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements-test.txt
./.venv/bin/python main.py
```

Ensure `python3` is version 3.11 or newer. Run the tests from the same directory:

```sh
./.venv/bin/python -m pytest -q
```

The demo runs in the terminal and exits; it does not start a web server. Its final example intentionally demonstrates an `OverflowError`, which the demo catches and prints.

## Part 2: SQL anomaly detection and database design

This part compares each device's average power in the last 24 hours with its average over earlier readings. The query returns device IDs whose recent average is at least 1.25 times their historical average. Devices without valid readings in both periods are excluded.

- [2.1_get_anomaly_telemetry.sql](part2/2.1_get_anomaly_telemetry.sql): the MySQL query, calculating power as `voltage * current`.
- [2.2_indexing.md](part2/2.2_indexing.md): a covering index on device ID, timestamp, voltage, and current, with its rationale and reported measurements.
- [2.3_scaling.md](part2/2.3_scaling.md): a proposed design using daily partitions and per-device historical summaries to reduce repeated scans of historical data, including consistency and retention considerations.

### Run the query

Use an existing MySQL database containing a populated `device_telemetry_logs` table with `device_id`, `recorded_at`, `voltage`, and `current` columns. This repository does not include database provisioning, a table-creation script, or seed data.

With the MySQL command-line client installed, run this from the repository root, replacing the connection placeholders:

```sh
mysql --host=YOUR_HOST --user=YOUR_USER --password YOUR_DATABASE
```

Enter the password when prompted, then execute the following inside the MySQL client:

```sql
SOURCE part2/2.1_get_anomaly_telemetry.sql;
```

Alternatively, open the SQL file in a MySQL GUI connected to the target database and execute it there. The indexing and scaling documents are design references; their schema changes and summary-maintenance logic are not applied automatically.

## Part 3: React telemetry dashboard

### Install and run on Windows, macOS, or Linux

From the repository root, install the locked dependencies and start the development server. These commands work in PowerShell, Bash, and zsh:

```sh
cd part3
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`. Press `Ctrl+C` to stop the server. If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` in these commands.

The dashboard displays ten example devices. Its analysis button calls `src/services/analyzeService.ts`, which simulates a delayed response locally rather than contacting an AI provider.

Run tests from `part3`:

```sh
npm test
```

Check TypeScript and create a production build:

```sh
npm run build
```

The build is written to `part3/dist`. Preview that build locally:

```sh
npm run preview
```

Open the URL printed by the preview server. Preview is for checking the built application locally, not for production hosting.

## Part 4: AI-assisted development workflow

This part records how AI was used during development and how its output was reviewed:

- [ai-workflow.md](part4/ai-workflow.md): the combined chat transcripts for parts 1, 2, and 3, separated into labeled parts.
- [4.2_ai_mistakes.md](part4/4.2_ai_mistakes.md): examples of AI mistakes and corrections, including validation order and React component structure.
- [4.3_ai_validation.md](part4/4.3_ai_validation.md): the validation approach, including reviewing tests and edge cases for part 1 and checking dashboard functionality incrementally for part 3.

These are Markdown documents. Read them in a text editor or Markdown preview; no installation or execution is required. The workflow transcript records development history, while the setup instructions above describe the current runnable project.

## Part 5: Hardware, API security, and product integration

This part contains theoretical answers about extending the system:

- [5.1_Low_Level.md](part5/5.1_Low_Level.md): considerations for resource-constrained hardware without an FPU, including scaled integers, memory usage, and computation cost.
- [5.2_API.md](part5/5.2_API.md): securing an AI analysis endpoint through secret isolation, minimal permissions and data, restricted free text, system-role guardrails, and rate limiting.
- [5.3_Integration.md](part5/5.3_Integration.md): questions for a Product Manager before introducing AI-recommended maintenance actions, covering goals, approval, operational impact, evidence, execution safeguards, and recovery.

These are Markdown documents and require no installation. They describe design considerations rather than implemented hardware support, a live AI backend, or automated station control.
