#!/bin/bash
# Tavily Extract API script
# Usage: ./extract.sh '{"urls": ["url1", "url2"], ...}'
# Requires: TAVILY_API_KEY environment variable

set -e

JSON_INPUT="$1"

if [ -z "$JSON_INPUT" ]; then
    echo "Usage: ./extract.sh '<json>'"
    echo ""
    echo "Required:"
    echo "  urls: array - List of URLs to extract (max 20)"
    echo ""
    echo "Optional:"
    echo "  extract_depth: \"basic\" (default), \"advanced\" (for JS/complex pages)"
    echo "  query: string - Reranks chunks by relevance to this query"
    echo "  chunks_per_source: 1-5 (default: 3, requires query)"
    echo "  format: \"markdown\" (default), \"text\""
    echo "  include_images: true/false"
    echo "  timeout: 1-60 seconds"
    echo ""
    echo "Example:"
    echo "  ./extract.sh '{\"urls\": [\"https://docs.example.com/api\"], \"query\": \"authentication\"}'"
    exit 1
fi

if [ -z "$TAVILY_API_KEY" ]; then
    echo "Error: TAVILY_API_KEY environment variable is not set"
    exit 1
fi

# Validate JSON
if ! echo "$JSON_INPUT" | jq empty 2>/dev/null; then
    echo "Error: Invalid JSON input"
    exit 1
fi

# Check for required urls field
if ! echo "$JSON_INPUT" | jq -e '.urls' >/dev/null 2>&1; then
    echo "Error: 'urls' field is required"
    exit 1
fi

# Build MCP JSON-RPC request
MCP_REQUEST=$(jq -n --argjson args "$JSON_INPUT" '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "tavily_extract",
        "arguments": $args
    }
}')

# Call Tavily MCP server via HTTPS (SSE response)
RESPONSE=$(curl -s --request POST \
    --url "https://mcp.tavily.com/mcp" \
    --header "Authorization: Bearer $TAVILY_API_KEY" \
    --header 'Content-Type: application/json' \
    --header 'Accept: application/json, text/event-stream' \
    --data "$MCP_REQUEST")

# Parse SSE response and extract the JSON result
JSON_DATA=$(echo "$RESPONSE" | grep '^data:' | sed 's/^data://' | head -1)

if [ -n "$JSON_DATA" ]; then
    echo "$JSON_DATA" | jq '.result.structuredContent // .result.content[0].text // .error // .' 2>/dev/null || echo "$JSON_DATA"
else
    echo "$RESPONSE"
fi
