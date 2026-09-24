---
id: TASK-108
title: 'Session, conversation, service and agent follow the glossary'
status: To Do
assignee: []
created_date: '2026-09-24 01:32'
updated_date: '2026-09-24 01:32'
labels:
  - vocabulary
  - ready-for-agent
milestone: m-1
dependencies: []
references:
  - CONTEXT.md
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTEXT.md: a session is what the service declares with a session ID (no fallback), a conversation is a chat thread inside it, a service is the application (unknown service when unnamed), an agent runs inside a service. Today OTLP ingest falls back to service.instance.id as a session (a whole process becomes one session), the stream parser is called StreamSession, export falls back to service name 'llmflow' instead of unknown_service, proxy /health returns service: 'proxy', and the Sessions list merges agent and service in one 'Agent / Service' column.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Spans without a session ID get no session (no service.instance.id fallback); docs no longer describe the fallback
- [ ] #2 The streaming parser and proxy /health no longer use the words session or service for other meanings
- [ ] #3 Export uses unknown_service when a record names no service
- [ ] #4 The Sessions view shows agent and service in separate columns
<!-- AC:END -->
