#!/usr/bin/env python3
import json
import sys


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


if len(sys.argv) != 2:
    fail("Usage: verify-cloud-run-scaling.py <service-json>")

if sys.argv[1] == "-":
    service = json.load(sys.stdin)
else:
    with open(sys.argv[1], encoding="utf-8-sig") as service_file:
        service = json.load(service_file)

template = service.get("spec", {}).get("template", {})
service_annotations = service.get("metadata", {}).get("annotations", {})
template_annotations = template.get("metadata", {}).get("annotations", {})
container_concurrency = template.get("spec", {}).get("containerConcurrency")
labels = {
    **service.get("metadata", {}).get("labels", {}),
    **template.get("metadata", {}).get("labels", {}),
}
min_scale = service_annotations.get(
    "run.googleapis.com/minScale",
    template_annotations.get("autoscaling.knative.dev/minScale", "0"),
)
max_scale = service_annotations.get(
    "run.googleapis.com/maxScale",
    template_annotations.get("autoscaling.knative.dev/maxScale"),
)

if min_scale != "0":
    fail(f"Cloud Run minimum instances must be 0; got {min_scale!r}.")
if max_scale != "3":
    fail(f"Cloud Run maximum instances must be 3; got {max_scale!r}.")
if container_concurrency != 80:
    fail(f"Cloud Run containerConcurrency must be 80; got {container_concurrency!r}.")
if labels.get("owner") != "uinventario":
    fail("Cloud Run owner label must be uinventario.")

print(
    json.dumps(
        {
            "check": "cloud-run-scaling",
            "minInstances": 0,
            "maxInstances": 3,
            "containerConcurrency": 80,
            "owner": "uinventario",
            "status": "passed",
        }
    )
)
