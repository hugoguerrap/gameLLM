# NODECOIN - P2P Strategy Game via MCP

## Project Overview
A distributed P2P strategy game where each player runs a node and plays through their AI agent (Claude Code, Cursor, etc.) via MCP. The game simulates a world with resource production, building, combat, trading, research, and exploration.

## Architecture
- **Monorepo** with pnpm workspaces: `packages/engine`, `packages/network`, `packages/mcp`
- **@nodecoin/engine**: Pure game logic, zero side effects, deterministic. Only dependency: prando (seeded RNG)
- **@nodecoin/network**: Wallet (Ed25519), transactions, SQLite persistence, token mining, P2P networking (libp2p + GossipSub), Automerge state sync, command blockchain
- **@nodecoin/mcp**: MCP server exposing game tools via StdioTransport

## Key Commands
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm test:coverage    # Run tests with coverage
pnpm lint             # Lint all packages
pnpm -F @nodecoin/engine test   # Test single package
```

## Tech Stack
- TypeScript 5.x with ESM modules
- pnpm workspaces (monorepo)
- @modelcontextprotocol/sdk for MCP server
- zod for validation
- @noble/ed25519 + @noble/hashes for cryptography
- better-sqlite3 for persistence
- prando for deterministic RNG
- vitest for testing

## Game Formulas
```
production = base * level * (1 + tech_bonus) * legacy_mult * biome_mod
building_cost = base_cost * 1.15^current_level
food_for_growth = 15 + 8*(pop-1) + (pop-1)^1.5
combat_damage = 30 * 2^(strength_diff/17) * random(0.75, 1.25)
survivors = sqrt(winner² - loser²)
tx_fee = amount * 0.03
```

## Running the MCP Server
```bash
# Build everything first
pnpm -r build

# Run directly
node packages/mcp/dist/index.js

# Or add to Claude Code
claude mcp add --transport stdio nodecoin -- node packages/mcp/dist/index.js
```

### Environment Variables
- `NODECOIN_PLAYER_NAME` - Settlement name (default: "Adventurer")
- `NODECOIN_PLAYER_ID` - Unique player ID (default: random UUID)
- `NODECOIN_BIOME` - Starting biome: plains/forest/mountain/desert/coast/volcanic (default: plains)
- `NODECOIN_SEED` - RNG seed for determinism (default: player ID)
- `NODECOIN_DATA_DIR` - Data directory for SQLite DB (default: ~/.nodecoin)
- `NODECOIN_P2P_ENABLED` - Enable/disable P2P networking (default: "true")
- `NODECOIN_P2P_PORT` - TCP port for libp2p (default: "0" = random)
- `NODECOIN_BOOTSTRAP_PEERS` - Comma-separated multiaddr bootstrap peers (default: "")

### MCP Tools Available (34 tools)

**Status & Info:**
- `game_status` - View settlement overview
- `game_inventory` - Detailed resource/army inventory
- `game_map` - View world map
- `game_rankings` - Settlement statistics
- `game_node_status` - Node/server info

**Building:**
- `game_build` / `game_upgrade` / `game_demolish` - Building management
- `game_buildings_available` - List buildable buildings

**Research:**
- `game_research` / `game_research_available` - Technology research

**Military:**
- `game_recruit` / `game_strategy` / `game_army` - Military management
- `game_attack` - Attack NPC targets (bandits/raiders/dragon)
- `game_pvp_attack` - Attack another player (PvP combat)

**Prestige:**
- `game_prestige` / `game_ascend` - Prestige system and ascension

**Exploration:**
- `game_explore` / `game_claim` - World exploration

**Trade & Economy:**
- `game_market` - View market and open trades
- `game_trade_create` - Create a trade offer (resources escrowed)
- `game_trade_accept` - Accept an open trade offer
- `game_trade_cancel` - Cancel your trade offer (refund)
- `game_trade_list` - List all your trade offers

**Alliance & Diplomacy:**
- `game_alliance_create` - Found a new alliance
- `game_alliance_join` - Join an existing alliance
- `game_alliance_leave` - Leave/disband alliance
- `game_alliance_info` - View alliance details
- `game_diplomacy` - Set diplomatic stance (neutral/allied/war/peace)
- `game_diplomacy_status` - View all diplomatic relations

**Espionage:**
- `game_spy` - Send spy to gather intelligence
- `game_spy_reports` - View collected spy reports

**Blockchain (Anti-Cheat):**
- `game_chain_status` - View command chain length, head/genesis hashes
- `game_chain_verify` - Verify chain integrity (hashes, signatures, indices)
- `game_chain_inspect` - Inspect recent blocks with full details

## Conventions
- All game state mutations go through Command pattern
- Tick engine is deterministic: same seed = same result
- MCP tools return { content: [{ type: "text", text: "..." }] }
- Logging goes to stderr (stdout is JSON-RPC for MCP)
- ESM imports use .js extensions
- Tests use vitest with 80% coverage threshold
