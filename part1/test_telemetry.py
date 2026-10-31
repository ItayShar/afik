"""Executable acceptance specification; processing tests are intentionally red."""

import math
from decimal import Decimal, localcontext

import pytest
from pydantic import ValidationError

from telemetry import TelemetryRecord, process_telemetry


def record(**changes):
    return dict(device_id="A", voltage=10.0, current=2.0, temperature=2.0) | changes


def assert_summary(summary, power, samples, health_samples, health):
    assert set(summary) == {
        "total_power", "sample_count", "health_sample_count", "average_health_factor"
    }
    assert summary["total_power"] == pytest.approx(power)
    assert summary["sample_count"] == samples
    assert summary["health_sample_count"] == health_samples
    if health is None:
        assert summary["average_health_factor"] is None
    else:
        assert summary["average_health_factor"] == pytest.approx(health)


def assert_rejections(result, rows, positions):
    assert [issue["index"] for issue in result["rejected_records"]] == positions
    for issue, index in zip(result["rejected_records"], positions):
        with pytest.raises(ValidationError) as exc:
            TelemetryRecord.model_validate(rows[index])
        assert issue == {
            "index": index,
            "errors": exc.value.errors(
                include_url=False, include_context=False, include_input=False
            ),
        }


FIELDS = ("device_id", "voltage", "current", "temperature")
INVALID = [
    pytest.param(record(**{field: None}), (field,), id=f"null-{field}")
    for field in FIELDS
] + [
    pytest.param({k: v for k, v in record().items() if k != field}, (field,),
                 id=f"missing-{field}")
    for field in FIELDS
] + [
    pytest.param(record(device_id=value), ("device_id",), id=f"blank-{i}")
    for i, value in enumerate(("", " ", "\t\r\n"))
] + [
    pytest.param(record(**{field: value}), (field,), id=f"{field}-{value}")
    for field in FIELDS[1:]
    for value in (math.nan, math.inf, -math.inf)
] + [
    pytest.param(record(voltage=-10), (), id="negative-power-voltage"),
    pytest.param(record(current=-2), (), id="negative-power-current"),
    pytest.param(record(voltage=1e308, current=2), (), id="power-overflow"),
]


class TestValidation:
    @pytest.mark.parametrize("row,location", INVALID)
    def test_invalid_record(self, row, location):
        """Every requested invalid case raises ValidationError at the boundary."""
        with pytest.raises(ValidationError) as exc:
            TelemetryRecord.model_validate(row)
        assert location in [error["loc"] for error in exc.value.errors()]

    @pytest.mark.parametrize("changes", [
        {}, {"voltage": 0}, {"current": 0}, {"temperature": -2},
        {"voltage": -10, "current": -2}, {"temperature": -3},
        {"voltage": 1e308, "current": 1, "temperature": -1.5},
    ])
    def test_accepted_measurement(self, changes):
        """Health availability is not a record-validation rule."""
        assert TelemetryRecord.model_validate(record(**changes)).device_id == "A"

    @pytest.mark.parametrize("changes", [
        {"voltage": "10"}, {"current": True}, {"temperature": "2"},
        {"device_id": 123}, {"unexpected": 1},
    ])
    def test_chosen_strict_policy(self, changes):
        """Document the chosen no-coercion/no-extra-fields policy."""
        with pytest.raises(ValidationError):
            TelemetryRecord.model_validate(record(**changes))

    def test_id_is_preserved(self):
        """Nonblank IDs are not silently normalized."""
        assert TelemetryRecord.model_validate(record(device_id=" A ")).device_id == " A "


class TestProcessing:
    def test_empty(self):
        """Empty batches have all three empty result containers."""
        assert process_telemetry([]) == {
            "summaries": {}, "rejected_records": [], "unavailable_health": []
        }

    def test_one(self):
        """10 V times 2 A gives 20; 92% of 20 divided by 4 gives 4.6."""
        result = process_telemetry([record()])
        assert set(result) == {"summaries", "rejected_records", "unavailable_health"}
        assert set(result["summaries"]) == {"A"}
        assert_summary(result["summaries"]["A"], 20, 1, 1, 4.6)
        assert result["rejected_records"] == result["unavailable_health"] == []

    @pytest.mark.parametrize("ids,expected", [
        (["A", "B", "C"], {"A": (20, 1, 1, 4.6), "B": (40, 1, 1, 9.2),
                             "C": (80, 1, 1, 18.4)}),
        (["A", "A", "A"], {"A": (140, 3, 3, 32.2 / 3)}),
        (["A", "B", "A"], {"A": (100, 2, 2, 11.5), "B": (40, 1, 1, 9.2)}),
    ], ids=["distinct", "three-unequal-same-id", "interleaved"])
    def test_grouping_and_mean(self, ids, expected):
        """Separate/interleaved groups stay independent; unequal samples expose EMA bug."""
        rows = [record(device_id=device, voltage=voltage)
                for device, voltage in zip(ids, (10, 20, 40))]
        result = process_telemetry(rows)
        assert set(result["summaries"]) == set(expected)
        for device, summary in expected.items():
            assert_summary(result["summaries"][device], *summary)
        assert result["rejected_records"] == result["unavailable_health"] == []

    @pytest.mark.parametrize("row,location", INVALID)
    def test_rejection_and_continuation(self, row, location):
        """Every invalid case is reported and cannot poison the next same-ID sample."""
        rows = [row, record()]
        result = process_telemetry(rows)
        assert_rejections(result, rows, [0])
        assert set(result["summaries"]) == {"A"}
        assert_summary(result["summaries"]["A"], 20, 1, 1, 4.6)
        assert result["unavailable_health"] == []

    @pytest.mark.parametrize("field", ["voltage", "current"])
    def test_zero(self, field):
        """Zero power is a valid health sample, not a missing sample."""
        result = process_telemetry([record(**{field: 0})])
        assert_summary(result["summaries"]["A"], 0, 1, 1, 0)
        assert result["rejected_records"] == result["unavailable_health"] == []

    @pytest.mark.parametrize("voltage,current,temp,power,reason", [
        (10, 2, -2, 20, "zero_denominator"),
        (0, 2, -2, 0, "zero_denominator"),
        (10, 0, -2, 0, "zero_denominator"),
        (1e308, 1, -1.5, 1e308, "non_finite_health"),
    ])
    def test_unavailable_health(self, voltage, current, temp, power, reason):
        """Singular/overflowing health retains power; no health samples means None."""
        result = process_telemetry([record(voltage=voltage, current=current,
                                           temperature=temp)])
        assert_summary(result["summaries"]["A"], power, 1, 0, None)
        assert result["rejected_records"] == []
        assert result["unavailable_health"] == [{"index": 0, "reason": reason}]

    @pytest.mark.parametrize("temperature", [
        math.nextafter(-2.0, math.inf), math.nextafter(-2.0, -math.inf), -3.0,
    ])
    def test_both_sides_of_singularity(self, temperature):
        """No epsilon clamp or temperature restriction; use independent Decimal oracle."""
        with localcontext() as context:
            context.prec = 80
            # Power is independently known to be 20; exact decimal 92% is 18.4.
            expected = float(Decimal("18.4") / (Decimal.from_float(temperature) + 2))
        assert math.isfinite(expected)
        result = process_telemetry([record(temperature=temperature)])
        assert_summary(result["summaries"]["A"], 20, 1, 1, expected)
        assert result["rejected_records"] == result["unavailable_health"] == []

    def test_mixed_batch(self):
        """Only available health enters the mean; rejections affect neither count nor sum."""
        rows = [record(), record(current=-2), record(temperature=-2),
                record(voltage=20), record(device_id="B", voltage=1e308,
                                           current=1, temperature=-1.5),
                record(device_id="C", current=None), record(voltage=40)]
        result = process_telemetry(rows)
        assert set(result["summaries"]) == {"A", "B"}
        assert_summary(result["summaries"]["A"], 160, 4, 3, 32.2 / 3)
        assert_summary(result["summaries"]["B"], 1e308, 1, 0, None)
        assert_rejections(result, rows, [1, 5])
        assert result["unavailable_health"] == [
            {"index": 2, "reason": "zero_denominator"},
            {"index": 4, "reason": "non_finite_health"},
        ]

    def test_only_rejected(self):
        """Rejecting an entire batch reports every position without phantom summaries."""
        rows = [record(current=-1), record(device_id="B", voltage=None), {}]
        result = process_telemetry(rows)
        assert result["summaries"] == {}
        assert result["unavailable_health"] == []
        assert_rejections(result, rows, [0, 1, 2])

    @pytest.mark.parametrize("temperature", [2.0, -2.0, -1.5])
    def test_aggregate_overflow_aborts_batch(self, temperature):
        """Finite powers can overflow their total, even with unavailable health."""
        huge = record(device_id="overflow-device", voltage=1e308, current=1,
                      temperature=temperature)
        rows = [record(), huge, record(current=None), huge, record()]
        with pytest.raises(OverflowError) as exc:
            process_telemetry(rows)
        message = str(exc.value)
        assert "overflow-device" in message
        assert "input index 3" in message
        assert "total_power" in message

    def test_large_finite_health_mean_does_not_require_finite_sum(self):
        """A representable mean is retained even when a naive health sum overflows."""
        temperature = math.nextafter(-2.0, math.inf)
        with localcontext() as context:
            context.prec = 80
            expected = float(Decimal.from_float(4e292) * Decimal("0.92") /
                             (Decimal.from_float(temperature) + 2))
        assert math.isfinite(expected)
        assert not math.isfinite(expected + expected)
        row = record(voltage=4e292, current=1, temperature=temperature)
        result = process_telemetry([row, row])
        assert_summary(result["summaries"]["A"], 8e292, 2, 2, expected)
        assert result["rejected_records"] == result["unavailable_health"] == []
