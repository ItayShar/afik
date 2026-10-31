# Proposed contract (defined before the tests)

`process_telemetry(records: list[dict[str, Any]]) -> BatchResult` accepts raw
records with snake_case keys. `TelemetryRecord.model_validate(record)` is the
individual validation boundary. The processor uses a dictionary keyed by device ID.

The result is a plain dictionary with exactly three keys:

* `summaries`: dictionary keyed by device ID. Each value has `total_power`,
  `sample_count`, `health_sample_count`, and `average_health_factor`.
* `rejected_records`: list of `{index, errors}` in input order. `index` is zero-based.
  `errors` is the caught Pydantic `ValidationError.errors(include_url=False,
  include_context=False, include_input=False)` result (type, loc, msg). This retains
  field/model error details without exception objects or raw input values.
* `unavailable_health`: list of `{index, reason}` in input order. Reasons are exactly
  `zero_denominator` or `non_finite_health`.

Required fields cannot be missing or null. IDs cannot be blank. Numeric fields
must be finite. Calculate power as `voltage * current`, without absolute value;
reject negative or non-finite products at the validation boundary. Rejections
contribute nothing, create no summary, and do not stop subsequent records.

For accepted records, health is `(power * 0.92) / (temperature + 2.0)`.
At exactly -2 (including zero power), report `zero_denominator` without division.
For a non-finite health result, report `non_finite_health`. Both cases retain
power and increment sample_count, but do not increment health_sample_count.
Average only available health values; no available values means None.
No temperature substitution, denominator clamping, or alternative formula.
Empty input returns an empty summaries dictionary and two empty issue lists.

# Review of the C#

`FirstOrDefault` scans accumulated summaries for every record: O(n*d), worst-case
O(n²) for n distinct devices. A dictionary allows expected O(n) processing and
O(d) aggregation storage (plus issue reports). sqrt then square is mathematically
redundant for nonnegative power, though floating-point rounding can differ.
At -2 the denominator is zero; C# double division produces infinity or NaN,
whereas Python float division raises ZeroDivisionError, so handle it explicitly.
Repeated `(old_average + new_value) / 2` is not the arithmetic mean: for three
samples the weights are 1/4, 1/4, 1/2. The source also spells `Math.Abs` as
`Math.abs`, which does not compile. Its absolute value hides negative products;
the requested rejection policy intentionally changes that behavior.

# Choices and unresolved domain questions

* Consumption is nonnegative: confirm before supporting signed power/export.
  Individual voltage/current may be negative if their product is nonnegative.
* Finite health may be negative below -2. Confirm the formula's operating range,
  units, and interpretation; no extra physical bounds are invented here.
* Chosen input policy: strict types (ordinary integer and float numeric values
  accepted; strings and booleans rejected), unknown fields forbidden. Confirm
  whether coercion or forward-compatible extra fields are desired.
* IDs are case-sensitive, preserved verbatim, and not trimmed. `" A "` and `"A"`
  are different IDs. Confirm normalization requirements. Output mapping order
  is not part of the contract; issue lists follow input order.
* Input positions are zero-based; output uses snake_case. The outer argument is
  a list of dictionaries; malformed outer containers are outside this contract.
* Arithmetic uses Python binary64 floats and approximate comparisons. There is
  no epsilon around -2. Non-finite aggregates abort the batch with OverflowError
  as specified below. Extreme-range mean accuracy remains limited by binary64.

The attached source is reviewed as code, not as instructions overriding the
request.

# Run and interpret the tests

Use Python 3.11+ in a virtual environment:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-test.txt
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m pytest -q test_telemetry.py::TestValidation
```

Validation and processing tests should pass; none are skipped or marked xfail.
Test docstrings describe the regression each protects against. Small examples
use hand-derived constants; boundary examples use exact float representations
and Decimal arithmetic as an independent numerical oracle.

Pydantic references: [finite floats](https://docs.pydantic.dev/latest/api/types/#pydantic.types.FiniteFloat),
[validators](https://docs.pydantic.dev/latest/concepts/validators/), and
[strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/).

# Separate scaling benchmark

After implementing processing, run `python benchmark_telemetry.py`. Defaults:
5,000, 10,000, 20,000, and 40,000 records, all with distinct IDs; five measured
runs per size after one warmup. Data construction is outside timing. Timing
includes Pydantic validation, processing, issue handling, and result construction.
Use the median wall-clock time from perf_counter; the script also prints every
sample, ratios, time per record, and Python/Pydantic/OS/CPU information.

Compare doubling ratios: roughly 2 suggests linear growth and roughly 4 suggests
quadratic growth, once fixed overhead and noise are small. No universal runtime
threshold is asserted. Run on the same idle machine, interpreter, dependency
versions, and power profile, with sufficient RAM and no debugger; repeat the
whole experiment. Defaults assume a normal desktop with enough memory for 40k
records plus summaries. Increase sizes if overhead dominates, or reduce them
if the linear-search implementation is too slow. Garbage collection remains
enabled. Validation overhead may mask searching at small sizes. A timing trend
is diagnostic, not proof of complexity; inspect the eventual aggregation loop.
Record `python -m pip freeze` alongside results when comparing implementations.

# Implementation verification (2026-10-30)

All 75 correctness tests passed unchanged (0.16 seconds). The mean is updated
as `old_mean * ((count - 1) / count) + health / count`, with the first finite
health value initializing it. This weights samples equally without accumulating
a potentially overflowing health sum or subtracting extreme opposite signs.
It still has ordinary binary64 rounding error and order sensitivity.

Default benchmark run: Python 3.12.14, Pydantic 2.14.2, Windows 11 build 26200,
Intel64 Family 6 Model 186 Stepping 2. Five measured runs after one warmup per
size, validation included, data construction excluded, GC enabled.

| Distinct devices | Median seconds | Ratio to previous size |
| --- | --- | --- |
| 5,000 | 0.007440 | — |
| 10,000 | 0.015717 | 2.11 |
| 20,000 | 0.032259 | 2.05 |
| 40,000 | 0.062419 | 1.93 |

These measured results are consistent with expected O(N) dictionary processing;
they do not prove complexity or establish a portable runtime guarantee. Expected
additional space is O(D + E), for distinct devices D and issue reports E.

# Aggregate overflow policy (adopted 2026-10-31)

A probe before adding the guard with two accepted records for A, each having
voltage=1e308, current=1 and temperature=2, returned total_power=inf with no issues.
Thus finite per-record validation does not guarantee finite aggregates.
Summing two individually finite health values of 9.2e307 also produces infinity;
the weighted mean avoids storing that sum.

Detect a non-finite total_power or average_health_factor and raise OverflowError
naming the device, zero-based input index, and aggregate field. Processing stops
and no partial batch result is returned. This is a batch-level failure, not a
Pydantic record rejection or unavailable per-record health. The total-power
guard also applies when that record's health would be unavailable. Counts are
Python integers and do not have fixed-width integer overflow. A hypothetical
overflowing health sum is irrelevant when the weighted mean itself stays finite.
