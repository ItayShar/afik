FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements-test.txt .
RUN python -m pip install --no-cache-dir -r requirements-test.txt

COPY telemetry.py main.py test_telemetry.py ./

CMD ["python", "main.py"]
