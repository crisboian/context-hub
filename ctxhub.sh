#!/bin/bash
# Context Hub helper for Claude Code
CTX_URL=http://192.168.99.12:8720
CTX_TOKEN=""

case "$2" in
  write)
    curl -s -X POST "$CTX_URL/context"       -H "Authorization: Bearer $CTX_TOKEN"       -H "Content-Type: application/json"       -d "$3"
    ;;
  read)
    curl -s "$CTX_URL/context/$3" -H "Authorization: Bearer $CTX_TOKEN"
    ;;
  search)
    curl -s "$CTX_URL/context?q=$3" -H "Authorization: Bearer $CTX_TOKEN"
    ;;
  budget)
    curl -s "$CTX_URL/budget" -H "Authorization: Bearer $CTX_TOKEN"
    ;;
  *)
    echo "Usage: ctxhub <token> {write|read|search|budget} [args]"
    ;;
esac
