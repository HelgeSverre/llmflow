# LLMFlow MVP - Simple LLM Observability

A bare-bones LLM observability tool that captures and visualizes OpenAI API calls with zero code changes.

## Quick Start (< 5 minutes)

### Option 1: NPM (Fastest)

```bash
# Clone and install
git clone https://github.com/yourusername/llmflow-mvp.git
cd llmflow-mvp
npm install

# Start the servers
npm start

# That's it! 
# Proxy runs on http://localhost:8080
# Dashboard runs on http://localhost:3000
```

### Option 2: Docker

```bash
# Build and run
docker build -t llmflow-mvp .
docker run -p 8080:8080 -p 3000:3000 llmflow-mvp

# Or use pre-built image (when available)
docker run -p 8080:8080 -p 3000:3000 llmflow/mvp
```

## Usage

1. **Change your OpenAI base URL:**
   ```python
   # Python example
   from openai import OpenAI
   
   client = OpenAI(
       base_url="http://localhost:8080/v1"  # Point to LLMFlow proxy
   )
   
   # Your code remains unchanged
   response = client.chat.completions.create(
       model="gpt-3.5-turbo",
       messages=[{"role": "user", "content": "Hello!"}]
   )
   ```

   ```javascript
   // JavaScript example
   const openai = new OpenAI({
       baseURL: "http://localhost:8080/v1"  // Point to LLMFlow proxy
   });
   ```

2. **View your LLM calls:**
   - Open http://localhost:3000
   - See all your API calls with tokens, costs, and latency
   - Click any request to see full details

## Features

- ✅ **Zero-code integration** - Just change the base URL
- ✅ **Real-time monitoring** - See requests as they happen
- ✅ **Token & cost tracking** - Understand your usage
- ✅ **Request/response capture** - Debug your prompts
- ✅ **Simple dashboard** - Clean, fast interface
- ✅ **SQLite storage** - No database setup needed

## Architecture

```
Your App → LLMFlow Proxy (:8080) → OpenAI API
              ↓
          SQLite DB
              ↓
        Dashboard (:3000)
```

## What's Captured

- Request timestamp and duration
- Model used
- Token counts (prompt, completion, total)
- Estimated costs
- Full request/response bodies
- Error states

## Limitations (MVP)

- OpenAI only (for now)
- No authentication
- No streaming support
- Basic UI (no charts)
- SQLite (not for high traffic)

## Development

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build Docker image
docker build -t llmflow-mvp .
```

## Next Steps

This is a proof-of-concept MVP. Future versions will include:
- Multiple LLM provider support
- Streaming request handling
- Advanced analytics and visualizations
- Authentication and multi-tenancy
- Production-ready database options
- OpenTelemetry compatibility

## License

MIT