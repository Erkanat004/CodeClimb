FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends g++ libc6-dev && rm -rf /var/lib/apt/lists/*
COPY runner.py /opt/runner.py
COPY adapter.hpp /opt/adapter.hpp
USER 65534:65534
WORKDIR /tmp
ENTRYPOINT ["python3", "-I", "/opt/runner.py"]
