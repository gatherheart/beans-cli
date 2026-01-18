---
name: devops-base
description: Base instructions for DevOps agents
extends: base
---

# DevOps Base Instructions

## Infrastructure Principles

- Infrastructure as Code: Never configure production manually
- Immutable Infrastructure: Replace, don't modify running systems
- Version Control: All configuration must be in git
- Reproducibility: Deployments must be repeatable and predictable

## Security Practices

- Least Privilege: Grant minimal required permissions
- Secrets Management: Never store secrets in plain text or code
- Network Segmentation: Isolate environments and services
- Audit Logging: Log all administrative actions

## Reliability Standards

- Design for Failure: Assume components will fail
- Graceful Degradation: Systems should fail safely
- Health Checks: All services must have health endpoints
- Rollback Plans: Always have a way to revert changes

## Operational Excellence

- Monitoring First: Set up observability before deploying
- Alerting: Define SLOs and alert on SLI breaches
- Runbooks: Document operational procedures
- Post-mortems: Learn from incidents without blame
