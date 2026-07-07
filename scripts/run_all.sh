#!/usr/bin/env bash
# Boot the full Athanor stack: swarm, x402 gateway, pixel office, bridge, mission control.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/5] swarm orchestrator on :8080"
( cd "$ROOT/apps/swarm-orchestrator" && python3 -m uvicorn main:app --host 0.0.0.0 --port 8080 ) &

echo "==> [2/5] x402 data-mesh gateway on :4021"
( cd "$ROOT/apps/data-mesh-gateway" && node src/server.js ) &

echo "==> [3/5] pixel office on :3100"
( cd "$ROOT/apps/office" && PIXEL_AGENTS_PORT=3100 node dist/cli.js ) &

echo "==> [4/5] mission control dashboard on :3200"
( cd "$ROOT/apps/office" && node mission-control/serve.cjs ) &

# let the office write its discovery file before the bridge starts
sleep 4
echo "==> [5/5] athanor bridge (swarm -> office)"
( cd "$ROOT/apps/office" && node athanor-bridge.mjs ) &

echo ""
echo "======================================================"
echo " ATHANOR IS LIVE"
echo "   Mission Control   http://localhost:3200   <- OPEN THIS"
echo "   Pixel Office      http://localhost:3100"
echo "   Swarm API         http://localhost:8080/health"
echo "   x402 Gateway      http://localhost:4021/health"
echo "======================================================"
echo ""
echo " The three agents spawn in the office and act out each deliberation."
echo " Trigger one from the dashboard (NEW PROPOSAL) or:"
echo "   curl -XPOST localhost:8080/swarm/deliberate -H \"content-type: application/json\" -d {}"
echo ""
echo " Press Ctrl+C to stop all."
wait
