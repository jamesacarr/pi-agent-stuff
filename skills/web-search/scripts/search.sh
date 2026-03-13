#!/bin/bash
# Tavily Search API script
# Usage: ./search.sh '{"query": "your search query", ...}'
# Requires: TAVILY_API_KEY environment variable

set -e

JSON_INPUT="$1"

if [ -z "$JSON_INPUT" ]; then
    echo "Usage: ./search.sh '<json>'"
    echo ""
    echo "Required:"
    echo "  query: string - Search query (keep under 400 chars)"
    echo ""
    echo "Optional:"
    echo "  search_depth: \"ultra-fast\", \"fast\", \"basic\" (default), \"advanced\""
    echo "  topic: \"general\" (default)"
    echo "  max_results: 1-20 (default: 10)"
    echo "  time_range: \"day\", \"week\", \"month\", \"year\""
    echo "  start_date: \"YYYY-MM-DD\""
    echo "  end_date: \"YYYY-MM-DD\""
    echo "  include_domains: [\"domain1.com\", \"domain2.com\"]"
    echo "  exclude_domains: [\"domain1.com\", \"domain2.com\"]"
    echo "  country: country name (general topic only)"
    echo "  include_raw_content: true/false"
    echo "  include_images: true/false"
    echo "  include_image_descriptions: true/false"
    echo "  include_favicon: true/false"
    echo ""
    echo "Example:"
    echo "  ./search.sh '{\"query\": \"latest AI trends\", \"time_range\": \"week\"}'"
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

# Check for required query field
if ! echo "$JSON_INPUT" | jq -e '.query' >/dev/null 2>&1; then
    echo "Error: 'query' field is required"
    exit 1
fi

# Build MCP JSON-RPC request
MCP_REQUEST=$(jq -n --argjson args "$JSON_INPUT" '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "tavily_search",
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
