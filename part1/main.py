"""Run small, printable examples of telemetry aggregation and error handling."""

from pprint import pprint

from telemetry import process_telemetry


def main() -> None:
    examples = [
        ("Empty batch", []),
        (
            "Interleaved devices and arithmetic mean (A: power=140, health=32.2/3)",
            [
                dict(device_id="A", voltage=10, current=2, temperature=2),
                dict(device_id="B", voltage=5, current=2, temperature=0),
                dict(device_id="A", voltage=20, current=2, temperature=2),
                dict(device_id="A", voltage=40, current=2, temperature=2),
            ],
        ),
        (
            "Invalid records are reported; later valid records still contribute",
            [
                dict(device_id="A", voltage=10, current=-2, temperature=2),
                dict(device_id="A", voltage=None, current=2, temperature=2),
                dict(device_id="A", voltage=10, current=2, temperature=2),
            ],
        ),
        (
            "Unavailable health preserves power (A: 2 samples, 1 health sample)",
            [
                dict(device_id="A", voltage=10, current=2, temperature=-2),
                dict(device_id="A", voltage=10, current=2, temperature=2),
                # B has finite power but overflowing health, so its mean is None.
                dict(device_id="B", voltage=1e308, current=1, temperature=-1.5),
            ],
        ),
        (
            "Aggregate overflow aborts the batch without returning a partial result",
            [
                dict(device_id="A", voltage=1e308, current=1, temperature=2),
                dict(device_id="A", voltage=1e308, current=1, temperature=2),
            ],
        ),
    ]

    for title, records in examples:
        print(f"\n--- {title} ---")
        print("Input:")
        pprint(records, sort_dicts=False)
        try:
            result = process_telemetry(records)
        except OverflowError as error:
            print(f"OverflowError: {error}")
        else:
            print("Result:")
            pprint(result, sort_dicts=False)


if __name__ == "__main__":
    main()
