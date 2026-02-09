# NODECOIN

A distributed P2P strategy game where each player runs a node and plays through their AI agent (Claude Code, Cursor, etc.) via [MCP](https://modelcontextprotocol.io). Build a settlement, train armies, research technologies, trade with others, and conquer the world.

## Quick Start

```bash
# Add to Claude Code (requires Node.js >= 20)
claude mcp add nodecoin -- npx nodecoin --name "MyCastle"

# Then just talk to Claude: "Check my game status", "Build a farm", "Recruit 5 soldiers"
```

### From Source

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9
pnpm install && pnpm build
claude mcp add --transport stdio nodecoin -- node packages/mcp/dist/cli.js --name "MyCastle"
```

## How It Works

Each player runs their own NODECOIN node. The node exposes 34 game tools via MCP that your AI agent calls to play the game. Nodes discover each other via P2P networking, sync world state, and resolve cross-player actions (trades, combat, diplomacy) through a signed blockchain.

```
Player A (Claude Code) <--MCP--> Node A <--P2P--> Node B <--MCP--> Player B (Cursor)
```

## Game Features

- **Economy**: 6 resource types, 15+ buildings, population growth, biome bonuses
- **Research**: 20+ technologies across multiple eras
- **Military**: 7 unit types with rock-paper-scissors counters, NPC and PvP combat
- **Trade**: Create/accept trade offers with resource escrow, cross-node settlement
- **Diplomacy**: Alliances, war/peace declarations, espionage
- **Exploration**: Discover and claim zones on the world map
- **Prestige**: Ascend to reset with bonuses, legacy multiplier
- **Anti-Cheat**: Every action is signed and hash-chained in a per-player blockchain

## Multi-Player Setup

### Local (2+ nodes with Claude Code)

```bash
# Node 1 - fixed port
claude mcp add nodecoin1 -- npx nodecoin \
  --name "Ironforge" --biome mountain --port 9000 --data-dir /tmp/node1

# Node 2 - connects to Node 1
claude mcp add nodecoin2 -- npx nodecoin \
  --name "Verdantia" --biome forest --port 9001 \
  --bootstrap "/ip4/127.0.0.1/tcp/9000" --data-dir /tmp/node2
```

Then talk to Claude: "Use nodecoin1 to build a farm", "Use nodecoin2 to check rankings".

### Docker (3 nodes)

```bash
docker compose up --build
```

Starts 3 interconnected nodes (Ironforge, Verdantia, Sandhold) with auto-discovery.

### Remote (across the internet)

```bash
# On a VPS with public IP
npx nodecoin --name "Hub" --port 9000

# Anyone can connect
npx nodecoin --name "MyCastle" --bootstrap "/ip4/<VPS_IP>/tcp/9000"
```

## CLI Options

```
nodecoin [options]

  -n, --name <name>        Settlement name (default: "Adventurer")
  --id <id>                Player ID (default: random UUID)
  -b, --biome <biome>      plains, forest, mountain, desert, coast, volcanic
  -d, --data-dir <path>    Data directory (default: ~/.nodecoin)
  -p, --port <port>        P2P listen port (default: random)
  --bootstrap <addrs>      Bootstrap peers (comma-separated multiaddrs)
  --no-p2p                 Disable P2P networking
  -h, --help               Show help
  -v, --version            Show version
```

All options are also available as environment variables (`NODECOIN_PLAYER_NAME`, `NODECOIN_BIOME`, etc.).

## Architecture

```
packages/
  engine/    - Pure game logic, zero side effects, deterministic
  network/   - Wallet, persistence, P2P (libp2p), Automerge sync, blockchain
  mcp/       - MCP server, game controller, 34 tools
```

- **Engine** is pure: same inputs = same outputs, no I/O, no randomness (seeded RNG)
- **Network** handles all side effects: SQLite, TCP, cryptography
- **MCP** wires everything together and exposes it as tools

## Available Tools (34)

| Category | Tools |
|----------|-------|
| **Status** | `game_status`, `game_inventory`, `game_map`, `game_rankings`, `game_node_status` |
| **Building** | `game_build`, `game_upgrade`, `game_demolish`, `game_buildings_available` |
| **Research** | `game_research`, `game_research_available` |
| **Military** | `game_recruit`, `game_strategy`, `game_army`, `game_attack`, `game_pvp_attack` |
| **Prestige** | `game_prestige`, `game_ascend` |
| **Exploration** | `game_explore`, `game_claim` |
| **Trade** | `game_market`, `game_trade_create`, `game_trade_accept`, `game_trade_cancel`, `game_trade_list` |
| **Alliance** | `game_alliance_create`, `game_alliance_join`, `game_alliance_leave`, `game_alliance_info` |
| **Diplomacy** | `game_diplomacy`, `game_diplomacy_status`, `game_spy`, `game_spy_reports` |
| **Blockchain** | `game_chain_status`, `game_chain_verify`, `game_chain_inspect` |

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all 751 tests
pnpm lint             # Lint
```

## Tech Stack

- TypeScript 5.x (ESM)
- pnpm workspaces
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) for MCP
- [libp2p](https://libp2p.io) for P2P networking (TCP + Noise + Yamux + GossipSub + mDNS + Kademlia DHT + Circuit Relay + DCUtR)
- [Automerge](https://automerge.org) for CRDT state sync
- [@noble/ed25519](https://github.com/paulmillr/noble-curves) for cryptographic signing
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for persistence
- [vitest](https://vitest.dev) for testing

## License

MIT
