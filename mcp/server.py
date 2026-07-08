#!/usr/bin/env python3
"""
MCP server for Context Hub.
Hermes connects via stdio to discover and call these tools.
"""
import json, os, urllib.request, urllib.error
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

CTXHUB_URL = os.environ.get("CTXHUB_URL", "http://127.0.0.1:8720")
CTXHUB_TOKEN = os.environ.get("CTXHUB_TOKEN", "")

if not CTXHUB_TOKEN:
    # Try reading from .token file
    token_path = os.path.join(os.path.dirname(__file__), "..", ".token")
    try:
        with open(token_path) as f:
            CTXHUB_TOKEN = f.read().strip()
    except FileNotFoundError:
        pass

server = Server("context-hub")

def _api_call(method, path, body=None):
    url = f"{CTXHUB_URL}{path}"
    headers = {
        "Authorization": f"Bearer {CTXHUB_TOKEN}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = resp.read().decode()
            return json.loads(result) if result else {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        return {"error": f"HTTP {e.code}: {error_body}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="context_write",
            description="Write an entry to Context Hub. Valid types: decision (needs title+problem+decision), task (needs name+priority), state (needs agent+status), note (needs content). Returns the new entry ID.",
            inputSchema={
                "type": "object",
                "required": ["type", "body"],
                "properties": {
                    "type": {"type": "string", "enum": ["decision", "task", "state", "note"]},
                    "body": {"type": "object", "description": "Content matching the type schema"},
                    "provenance": {"type": "string", "description": "e.g. agent:hermes, human:cris"}
                }
            }
        ),
        Tool(
            name="context_read",
            description="Read a context entry by its numeric ID. Returns the full entry with body parsed.",
            inputSchema={
                "type": "object",
                "required": ["id"],
                "properties": {
                    "id": {"type": "integer", "description": "Entry ID"}
                }
            }
        ),
        Tool(
            name="context_search",
            description="Search context entries. Optional filters: type, active (true/false), q (text search in body). Returns up to 50 results.",
            inputSchema={
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["decision", "task", "state", "note"]},
                    "active": {"type": "boolean"},
                    "q": {"type": "string", "description": "Text to search in entry body"}
                }
            }
        ),
        Tool(
            name="context_budget",
            description="Get current spending stats: today's spend, total spend, and call count.",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="router_decide",
            description="Evaluate a task and return model routing in SHADOW MODE (records decision, does not execute). Task needs title and type (feature-critical|feature|bugfix|refactor|design|image|other). Optionally pass execute=true to override shadow mode.",
            inputSchema={
                "type": "object",
                "required": ["task"],
                "properties": {
                    "task": {
                        "type": "object",
                        "required": ["title", "type"],
                        "properties": {
                            "title": {"type": "string"},
                            "type": {"type": "string", "enum": ["feature-critical", "feature", "bugfix", "refactor", "design", "image", "other"]},
                            "criticality": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                            "description": {"type": "string"}
                        }
                    },
                    "execute": {"type": "boolean"}
                }
            }
        ),
        Tool(
            name="router_enqueue",
            description="Enqueue a task for execution. Auto-selects maker/verifier based on task type. Shadow mode — recorded, not executed. Returns job ID.",
            inputSchema={
                "type": "object",
                "required": ["task"],
                "properties": {
                    "task": {
                        "type": "object",
                        "required": ["title", "type"],
                        "properties": {
                            "title": {"type": "string"},
                            "type": {"type": "string", "enum": ["feature-critical", "feature", "bugfix", "refactor", "design", "image", "other"]},
                            "criticality": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                            "description": {"type": "string"}
                        }
                    }
                }
            }
        ),
        Tool(
            name="router_jobs",
            description="List recent jobs or check status of a specific job by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "description": "Job ID to check (omit to list all)"},
                    "status": {"type": "string", "enum": ["pending", "making", "gating", "verifying", "done", "failed", "escalated", "needs_human"]}
                }
            }
        ),
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "context_write":
        payload = {
            "type": arguments["type"],
            "body": arguments["body"],
            "provenance": arguments.get("provenance", "agent:hermes")
        }
        result = _api_call("POST", "/context", payload)

    elif name == "context_read":
        result = _api_call("GET", f"/context/{arguments['id']}")

    elif name == "context_search":
        params = []
        for key in ("type", "active", "q"):
            val = arguments.get(key)
            if val is not None:
                if key == "active":
                    val = "true" if val else "false"
                params.append(f"{key}={urllib.request.quote(str(val))}")
        qs = "&".join(params)
        result = _api_call("GET", f"/context?{qs}")

    elif name == "context_budget":
        result = _api_call("GET", "/budget")

    elif name == "router_decide":
        payload = {"task": arguments["task"], "execute": arguments.get("execute", False)}
        result = _api_call("POST", "/router/decide", payload)

    elif name == "router_enqueue":
        payload = {"task": arguments["task"]}
        result = _api_call("POST", "/jobs", payload)

    elif name == "router_jobs":
        if arguments.get("id"):
            result = _api_call("GET", f"/jobs/{arguments['id']}")
        else:
            params = ""
            if arguments.get("status"):
                params = f"?status={arguments['status']}"
            result = _api_call("GET", f"/jobs{params}")

    else:
        result = {"error": f"Unknown tool: {name}"}

    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
