@echo off
set DST=C:\Users\USER\autonomyhq
start "SWARM" cmd /k "cd /d %DST%\apps\swarm-orchestrator && python -m uvicorn main:app --port 8080"
start "GATEWAY" cmd /k "cd /d %DST%\apps\data-mesh-gateway && node src\server.js"
start "OFFICE" cmd /k "cd /d %DST%\apps\office && node dist\cli.js"
start "RECORDER" cmd /k "cd /d %DST%\deploy-kit && set NODE_URL=https://node.testnet.casper.network/rpc&& node chain-recorder.mjs"
timeout /t 6 /nobreak
start "BRIDGE" cmd /k "cd /d %DST%\apps\office && node athanor-bridge.mjs"
start "DASHBOARD" cmd /k "cd /d %DST%\apps\office && node mission-control\serve.cjs"
timeout /t 3 /nobreak
start http://localhost:3200
