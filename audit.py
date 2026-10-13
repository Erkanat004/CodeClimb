#!/usr/bin/env python3
"""Read-only CodeClimb audit. Writes Markdown and JSON reports, never touches game data."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "reports"
REQUIRED = {
    "Game and translations": ["app/page.tsx", "app/compete/page.tsx", "lib/i18n.tsx", "lib/challenge-translations.ts", "lib/detailed-hint-translations.ts"],
    "Accounts and administration": ["server/app.mjs", "app/admin/page.tsx", "components/account.tsx", "components/admin-database.tsx"],
    "Databases and migration": ["server/sqlite-repository.mjs", "server/postgres-repository.mjs", "server/pg-migrations/001_initial.sql", "server/database-admin.mjs", "server/database-config.mjs"],
    "Security and deployment": ["Dockerfile", "compose.yaml", "compose.postgres.yaml", "deploy/Caddyfile", "docs/SECURITY.md", ".env.example", ".gitignore"],
    "Automated tests": ["tests/accounts.test.mjs", "tests/postgres.test.mjs", "scripts/check-challenges.mjs", "scripts/check-cpp.mjs"],
}
SENSITIVE = re.compile(r"(^|/)(?:\.env(?:\..*)?|data|reports|node_modules|\.next|\.wrangler)(?:/|$)|\.(?:sqlite|db|pem|p12|pfx|key)$", re.I)
REDACT_URL = re.compile(r"(postgres(?:ql)?://[^:/\s]+:)[^@\s]+(@)", re.I)
REDACT_KEYS = re.compile(r"((?:api[_-]?key|secret|token|password)\s*[:=]\s*)\S+", re.I)


def scrub(value: str) -> str:
    return REDACT_KEYS.sub(r"\1[REDACTED]", REDACT_URL.sub(r"\1[REDACTED]\2", value))


def command(parts: list[str], timeout: int = 900, max_output: int = 2500) -> dict:
    started = time.monotonic()
    executable = shutil.which(parts[0])
    if not executable:
        return {"status": "fail", "detail": f"Tool unavailable: {parts[0]}", "seconds": 0}
    try:
        process = subprocess.run([executable, *parts[1:]], cwd=ROOT, capture_output=True, text=True,
                                 encoding="utf-8", errors="replace", timeout=timeout, check=False)
        output = scrub((process.stdout + "\n" + process.stderr).strip())
        return {"status": "pass" if process.returncode == 0 else "fail", "detail": output[-max_output:],
                "exit_code": process.returncode, "seconds": round(time.monotonic() - started, 1)}
    except subprocess.TimeoutExpired:
        return {"status": "fail", "detail": f"Timed out after {timeout} seconds", "seconds": timeout}
    except OSError as error:
        return {"status": "fail", "detail": scrub(str(error)), "seconds": round(time.monotonic() - started, 1)}


def structure() -> dict:
    missing = [item for group in REQUIRED.values() for item in group if not (ROOT / item).is_file()]
    return {"status": "fail" if missing else "pass", "detail": "Missing: " + ", ".join(missing) if missing else "All required application, database, security and test files exist."}


def git_hygiene() -> dict:
    result = command(["git", "-c", f"safe.directory={ROOT.as_posix()}", "ls-files", "-z"], 30)
    if result["status"] != "pass":
        return result
    # command() intentionally truncates text, so read filenames separately without logging their contents.
    try:
        files = subprocess.run([shutil.which("git"), "-c", f"safe.directory={ROOT.as_posix()}",
                                "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
        flagged = [name for name in files.decode("utf-8", "replace").split("\0") if name and name != ".env.example" and SENSITIVE.search(name.replace("\\", "/"))]
    except (OSError, subprocess.CalledProcessError) as error:
        return {"status": "fail", "detail": scrub(str(error))}
    return {"status": "fail" if flagged else "pass", "detail": "Tracked sensitive paths: " + ", ".join(flagged) if flagged else "No tracked credentials, runtime data or build outputs."}


def http_check(base: str) -> dict:
    from urllib.parse import urlparse
    parsed = urlparse(base)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password:
        return {"status": "fail", "detail": "--url must be a plain HTTP(S) origin without credentials."}
    results = []
    for path in ("/", "/compete", "/admin"):
        try:
            with urllib.request.urlopen(urllib.request.Request(base.rstrip("/") + path, headers={"User-Agent": "CodeClimbAudit/1"}), timeout=10) as response:
                results.append(f"{path}: HTTP {response.status}")
                if response.status != 200:
                    return {"status": "fail", "detail": "; ".join(results)}
        except (urllib.error.URLError, TimeoutError) as error:
            return {"status": "fail", "detail": scrub(f"{path}: {error}")}
    return {"status": "pass", "detail": "; ".join(results)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true", help="Skip builds and challenge execution; keep static and account/database tests")
    parser.add_argument("--url", help="Optional running site origin for unauthenticated HTTP smoke checks")
    args = parser.parse_args()
    checks: dict[str, dict] = {"Required project parts": structure(), "Git hygiene": git_hygiene()}
    steps = [
        ("Git whitespace", ["git", "-c", f"safe.directory={ROOT.as_posix()}", "diff", "--check"]),
        ("TypeScript", ["npx", "tsc", "--noEmit"]),
        ("ESLint", ["npm", "run", "lint"]),
        ("Account and progress tests", ["npm", "run", "test:accounts"]),
        ("PostgreSQL and migration tests", ["npm", "run", "test:postgres"]),
    ]
    if not args.quick:
        steps += [
            ("Python challenge checks", ["npm", "run", "test:python"]),
            ("C++ challenge checks", ["npm", "run", "test:cpp"]),
            ("Local web build", ["npm", "run", "build"]),
            ("Network web build", ["npm", "run", "build:network"]),
        ]
    for label, parts in steps:
        print(f"Checking {label}...", flush=True)
        checks[label] = command(parts)
    print("Checking production dependencies...", flush=True)
    dependency = command(["npm", "audit", "--omit=dev", "--json"], 120, 1_000_000)
    try:
        parsed = json.loads(dependency["detail"])
        counts = parsed.get("metadata", {}).get("vulnerabilities", {})
        dependency["detail"] = "Production dependency vulnerabilities: " + ", ".join(f"{key}={value}" for key, value in counts.items())
    except (ValueError, AttributeError):
        dependency["detail"] = (dependency["detail"] or "No audit output.")[-2500:]
    checks["Production dependency audit"] = dependency
    if args.url:
        checks["HTTP smoke"] = http_check(args.url)
    manual = ["Real PostgreSQL server and concurrency under load", "Docker Compose on the target host", "SMTP/Resend delivery and domain approval", "Competition judge with Linux runsc", "Real ad-provider callbacks", "Production DNS, HTTPS and backups"]
    result = {"generated_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "quick": args.quick, "checks": checks,
              "manual_verification_needed": manual, "summary": {state: sum(item["status"] == state for item in checks.values()) for state in ("pass", "fail")}}
    OUT.mkdir(exist_ok=True)
    (OUT / "audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# CodeClimb audit report", "", f"Generated (UTC): {result['generated_utc']}", "", "| Area | Result | Time |", "|---|---|---:|"]
    for label, item in checks.items():
        lines.append(f"| {label} | {item['status'].upper()} | {item.get('seconds', 0)}s |")
    lines += ["", "## Findings", ""]
    for label, item in checks.items():
        lines += [f"### {label}", "", f"Status: {item['status'].upper()}", "", "```text", item["detail"] or "No diagnostic output.", "```", ""]
    lines += ["## Requires real-environment verification", ""] + [f"- {item}" for item in manual]
    (OUT / "audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Report: {OUT / 'audit.md'} | pass={result['summary']['pass']} fail={result['summary']['fail']}")
    return 1 if result["summary"]["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
