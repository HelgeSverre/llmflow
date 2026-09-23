# Opik

Forward what LLMFlow records to a local [Opik](https://www.comet.com/docs/opik), started with
Opik's own launcher.

## Start Opik

Opik's `opik.sh` starts the full stack. Clone Opik anywhere outside this repository:

```bash
git clone https://github.com/comet-ml/opik.git
cd opik
./opik.sh
```

The UI and the API are both served on <http://127.0.0.1:5173> once the script reports that Opik is
ready (a few minutes on the first start, while images download). The local install has no login
and no API keys.

## Point LLMFlow at it

Start LLMFlow with the settings in [`.env.example`](.env.example), for example by copying them
into the project-root `.env`:

```bash
OTLP_EXPORT_TRACES_ENDPOINT=http://127.0.0.1:5173/api/v1/private/otel/v1/traces
OTLP_EXPORT_HEADERS=projectName=llmflow
```

The `projectName` header picks the Opik project, which Opik creates on the first span. Opik
accepts both of LLMFlow's export encodings (JSON and protobuf).

## Check it

Send traffic through LLMFlow (or `bun run demo` from the repository root), then open
<http://127.0.0.1:5173> and the `llmflow` project. Spans arrive with their model, provider, token
usage and cost. A span's conversation ID becomes the Opik thread; Opik does not map LLMFlow's
session ID. To check from the command line:

```bash
curl -s "http://127.0.0.1:5173/api/v1/private/spans?project_name=llmflow&size=5"
```

## Stop

From the Opik clone:

```bash
./opik.sh --stop    # keep the data
./opik.sh --clean   # delete it
```

Checked with Opik 2.2.79 (2026-09-23).
