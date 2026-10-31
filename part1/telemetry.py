"""Validated telemetry aggregation and per-record issue reporting."""

from math import isfinite
from typing import Any, Literal, Self, TypedDict

from pydantic import BaseModel, ConfigDict, FiniteFloat, ValidationError, field_validator, model_validator


class TelemetryRecord(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    device_id: str
    voltage: FiniteFloat
    current: FiniteFloat
    temperature: FiniteFloat

    @field_validator("device_id")
    @classmethod
    def nonblank_id(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("device_id must not be blank")
        return value

    @model_validator(mode="after")
    def valid_power(self) -> Self:
        power = self.voltage * self.current
        if not isfinite(power):
            raise ValueError("calculated power must be finite")
        if power < 0:
            raise ValueError("calculated power must be nonnegative")
        return self


class DeviceSummary(TypedDict):
    total_power: float
    sample_count: int
    health_sample_count: int
    average_health_factor: float | None


class RejectedRecord(TypedDict):
    index: int
    errors: list[dict[str, Any]]


class UnavailableHealth(TypedDict):
    index: int
    reason: Literal["zero_denominator", "non_finite_health"]


class BatchResult(TypedDict):
    summaries: dict[str, DeviceSummary]
    rejected_records: list[RejectedRecord]
    unavailable_health: list[UnavailableHealth]


def process_telemetry(records: list[dict[str, Any]]) -> BatchResult:
    """Aggregate raw record dictionaries into device summaries and indexed issues.

    Catch individual Pydantic validation errors and exclude rejected records.
    Retain valid power when health is singular/non-finite, averaging only finite
    health samples. Return None for a device with no available health samples.
    Expected O(N) time and O(D + E) additional space for D devices and E reports,
    assuming bounded record/ID sizes. A non-finite aggregate raises OverflowError
    naming the device, zero-based input index, and field; no partial result returns.
    """
    result: BatchResult = {
        "summaries": {}, "rejected_records": [], "unavailable_health": []
    }
    for index, raw_record in enumerate(records):
        try:
            record = TelemetryRecord.model_validate(raw_record)
        except ValidationError as error:
            result["rejected_records"].append({
                "index": index,
                "errors": error.errors(
                    include_url=False, include_context=False, include_input=False
                ),
            })
            continue

        power = record.voltage * record.current
        summary = result["summaries"].get(record.device_id)
        if summary is None:
            summary = {
                "total_power": 0.0, "sample_count": 0,
                "health_sample_count": 0, "average_health_factor": None,
            }
            result["summaries"][record.device_id] = summary
        total_power = summary["total_power"] + power
        if not isfinite(total_power):
            raise OverflowError(
                f"device {record.device_id!r}, input index {index}: total_power is non-finite"
            )
        summary["total_power"] = total_power
        summary["sample_count"] += 1

        if record.temperature == -2.0:
            result["unavailable_health"].append({
                "index": index, "reason": "zero_denominator"
            })
            continue
        health = (power * 0.92) / (record.temperature + 2.0)
        if not isfinite(health):
            result["unavailable_health"].append({
                "index": index, "reason": "non_finite_health"
            })
            continue

        summary["health_sample_count"] += 1
        count = summary["health_sample_count"]
        mean = summary["average_health_factor"]
        # Weighted arithmetic mean avoids an overflowing health sum or difference.
        average_health = (
            health if mean is None else mean * ((count - 1) / count) + health / count
        )
        if not isfinite(average_health):
            raise OverflowError(
                f"device {record.device_id!r}, input index {index}: "
                "average_health_factor is non-finite"
            )
        summary["average_health_factor"] = average_health
    return result
