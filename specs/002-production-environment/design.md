# UI Design: Production Environment

**Branch**: `colau/speckit-sdd-orchestrator-b79f9d` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Roadmap entry**: RM-2: Production environment

**Canvas**: not applicable | **Canvas version**: —

**Status**: Not applicable

**Frozen**: 

**Authority**: `docs/tracklite-spec.md` decides behavior, permissions and copy. This file and the canvas decide layout only.

This slice adds or changes no screen, overlay, email or user-visible text in the app: it covers atomic (symlink, zero-downtime) deploy and rollback, backups, the external uptime check, server config, log rotation and HTTPS (OPS-002 to OPS-006, SEC-005, NFR-009); no maintenance page is used, the deploy and rollback messages ("a deploy is running", "a rollback is running", "interrupted", "nothing to roll back to") are command-line output on the owner's machine, not app UI, and the uptime alert email is written by the external check service, not by the app (spec.md Assumptions).
