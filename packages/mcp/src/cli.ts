#!/usr/bin/env node

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    name: { type: 'string', short: 'n', description: 'Settlement name' },
    id: { type: 'string', description: 'Player ID (default: random UUID)' },
    biome: { type: 'string', short: 'b', description: 'Starting biome' },
    seed: { type: 'string', description: 'RNG seed' },
    'data-dir': { type: 'string', short: 'd', description: 'Data directory' },
    port: { type: 'string', short: 'p', description: 'P2P listen port' },
    bootstrap: { type: 'string', description: 'Bootstrap peers (comma-separated multiaddrs)' },
    'no-p2p': { type: 'boolean', description: 'Disable P2P networking' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  strict: true,
  allowPositionals: false,
});

if (values.version) {
  console.log('nodecoin v0.1.0');
  process.exit(0);
}

if (values.help) {
  console.log(`
nodecoin - P2P Strategy Game via MCP

USAGE
  nodecoin [options]
  npx nodecoin [options]

OPTIONS
  -n, --name <name>        Settlement name (default: "Adventurer")
  --id <id>                Player ID (default: random UUID)
  -b, --biome <biome>      Starting biome: plains, forest, mountain,
                           desert, coast, volcanic (default: plains)
  --seed <seed>            RNG seed for determinism
  -d, --data-dir <path>    Data directory (default: ~/.nodecoin)
  -p, --port <port>        P2P listen port (default: random)
  --bootstrap <addrs>      Bootstrap peers (comma-separated multiaddrs)
  --no-p2p                 Disable P2P networking
  -h, --help               Show this help
  -v, --version            Show version

EXAMPLES
  # Single player
  nodecoin --name "Ironforge" --biome mountain

  # Two local nodes
  nodecoin --name "Ironforge" --port 9000 --data-dir /tmp/node1
  nodecoin --name "Verdantia" --port 9001 --bootstrap "/ip4/127.0.0.1/tcp/9000" --data-dir /tmp/node2

  # Add to Claude Code
  claude mcp add nodecoin -- npx nodecoin --name "MyCastle"

  # Connect to a public network
  nodecoin --name "MyCastle" --bootstrap "/ip4/YOUR_VPS_IP/tcp/9000"

GAME
  Once running, interact through your AI agent (Claude Code, Cursor, etc).
  The node exposes 34 MCP tools: build, recruit, research, trade, attack, etc.
`);
  process.exit(0);
}

// Map CLI flags to env vars (only set if provided, so defaults in index.ts apply)
if (values.name) process.env.NODECOIN_PLAYER_NAME = values.name;
if (values.id) process.env.NODECOIN_PLAYER_ID = values.id;
if (values.biome) process.env.NODECOIN_BIOME = values.biome;
if (values.seed) process.env.NODECOIN_SEED = values.seed;
if (values['data-dir']) process.env.NODECOIN_DATA_DIR = values['data-dir'];
if (values.port) process.env.NODECOIN_P2P_PORT = values.port;
if (values.bootstrap) process.env.NODECOIN_BOOTSTRAP_PEERS = values.bootstrap;
if (values['no-p2p']) process.env.NODECOIN_P2P_ENABLED = 'false';

// Import and run the main server
await import('./index.js');
