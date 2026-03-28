## OpenClaw Setup

1. Install Docker Desktop
2. Clone OpenClaw:
   git clone https://github.com/openclaw/openclaw.git
   cd openclaw

3. Run setup:
   export OPENCLAW_IMAGE="ghcr.io/openclaw/openclaw:latest"
   ./scripts/docker/setup.sh

4. Verify:
   curl http://localhost:18789/healthz