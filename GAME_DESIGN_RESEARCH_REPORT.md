# Comprehensive Game Design Research Report
## Viral Idle/Strategy/Crypto Games: Mechanics, Psychology, and Case Studies (2023-2026)

---

## TABLE OF CONTENTS

1. [Most Viral Idle/Incremental/Strategy Games (2023-2026)](#1-most-viral-idleincrementalstrategy-games-2023-2026)
2. [Game Simulation Rules That Create Maximum Engagement](#2-game-simulation-rules-that-create-maximum-engagement)
3. [Realistic Simulation Mechanics in Strategy Games](#3-realistic-simulation-mechanics-in-strategy-games)
4. [What Makes Strategy Games Go VIRAL](#4-what-makes-strategy-games-go-viral)
5. [Blockchain/Crypto Games: Successes and Failures](#5-blockchaincrypto-games-successes-and-failures)

---

## 1. Most Viral Idle/Incremental/Strategy Games (2023-2026)

### 1.1 Idle Games That Went Viral

#### Cookie Clicker (The Archetype)
- **What made it viral**: Orteil spent significant time tuning the balance between upgrades, rewards, and the passive/active effort required. The reward distribution follows an exponential curve: the first 5 minutes shower the player in feel-good moments, then satisfactory moments get scarcer and shift from gratification to achievement.
- **Key mechanics**: Operant conditioning (Skinner box), variable rewards drip-fed at unexpected times, only showing the next few tiers to limit distraction and create curiosity, hundreds of unique items and achievements tapping the desire for completion.
- **Why it worked**: Every past action has a sustained, exponential impact on current progress and future rewards. The game uses the same psychological triggers as slot machines but layers them with strategic depth.

#### Unnamed Space Idle (2023 - present)
- Still one of the most popular incremental games in 2025. Deep but easy-to-learn mechanics combined with a long-form narrative. Demonstrates that idle games benefit from having a story thread.

#### Melvor Idle
- Positioned as "RuneScape but idle." 20+ distinct skill trees, RPG mechanics layered onto idle progression. Success came from tapping into RuneScape nostalgia while removing the friction of active play.

#### DodecaDragons
- Browser-based idle game that was slowly updated over its first year. Demonstrates the "live service" approach to idle games: start simple, layer complexity over time, and build to an endgame state.

#### Legends of IdleOn
- Idle MMO with character class specializations. Multiple characters running simultaneously creates a "parallel progression" system that multiplies engagement hooks.

### 1.2 Browser-Based MMO Strategy Games

#### Travian
- **Build times increased exponentially** as you progressed. Only one building, one resource upgrade, and one military unit could be queued at a time.
- **A complete round lasted nearly a year.** Designed for ~30 minutes of play per session since players could exhaust all available actions.
- **Always-on world**: Required attention throughout the day for defense, fostering communities and alliance diplomacy.

#### OGame
- **Dual playstyle economy**: Miners leveled up mines for production; fleeters engaged in constant warfare. This created natural trade dynamics between playstyles.
- **Area control through colonization**: Limited planets per solar system created strategic positioning and scarcity.

#### Tribal Wars
- Deep alliance warfare where diplomacy and timing mattered more than individual power. The social layer was the primary engagement driver.

#### Common Success Factors
- Free-to-play, worked on any device with internet
- Persistent world design (things happen while you're offline)
- Clever mechanics and deep resource systems compensated for minimal graphics
- Strong community formation through necessity (you needed allies to survive)

### 1.3 Discord Bot Games

#### Dank Memer (8.6M+ servers as of 2023)
- **Economy mechanics**: Global economy where nearly every action earns coins or items. Hundreds of unique items to collect and trade.
- **Engagement hooks**: Robbing friends, taking care of pets, building skills, prestige system, global AND server-wide leaderboards.
- **Server-level engagement**: Built-in server events (bankrobs, split-or-steal, giveaways, raffles). Shared server "pool" of resources where members directly donate. Random events spawn to encourage member engagement.
- **Investment system**: Items fluctuate in value based on supply (more in circulation = lower value), creating a real trading game.
- **XP system**: Every currency command has a chance to give XP, with exponentially increasing level requirements.

#### Wordplay
- Brought Wordle to Discord with single-player and multiplayer modes plus leaderboards. Succeeded by adapting a proven viral mechanic to a platform where sharing is native.

### 1.4 Telegram Mini Games (The 2024 Viral Phenomenon)

#### Notcoin
- **35M+ players**. Simple tap-to-earn mechanic. Points later converted to NOT tokens on TON blockchain.
- Token launched May 2024 at $0.01, rocketed to $1.1B market cap.
- Succeeded because the barrier to entry was literally tapping a screen.

#### Hamster Kombat
- **300M+ players in 5 months** (launched March 2024). Play as hamster CEO of a fictional crypto exchange.
- Invested in marketing, licenses, talent, new products. Combined tapping with management simulation.
- One of the largest airdrops in crypto history (60% of token supply to players).

#### Key Insight on Tap-to-Earn
- By mid-2025, even the developers admitted "the model is probably dead" due to lack of long-term retention. The mechanic drives massive initial adoption but has no staying power without deeper gameplay.

### 1.5 AI/LLM-Based Games

#### Current State (2024-2025)
- **One Trillion and One Nights**: LLM generates entire game worlds including characters, settings, and narrative procedurally based on player input.
- **CivAgent**: LLM-based agent that plays as a digital player within Unciv (open-source Civilization), addressing the problem of finding human opponents.
- **AI People (2024)**: LLM-powered simulations with NPC dialogues, behaviors, and relationships.
- **Inworld's Origins Demo**: AI NPCs that players speak to directly, demonstrating conversational AI in games.
- **lmgame-Bench / Orak (2025)**: Benchmarks for training and evaluating LLM agents on diverse video games.

#### Key Research Findings
- A 2024 survey on LLM-based Game Agents (LLMGAs) covers single-agent and multi-agent systems through a unified reference architecture (arXiv:2404.02039).
- LLMs are being used for procedural content generation and level design, conditioned on favorite levels of specific player types.
- No mainstream game has yet shipped with LLM-driven NPCs at scale, but the technology is actively being integrated.

---

## 2. Game Simulation Rules That Create Maximum Engagement

### 2.1 The Compulsion Loop (Core Hook)

The compulsion loop has three interdependent phases:

1. **Anticipation**: Players form expectations of potential gains
2. **Activity**: Targeted efforts under variable conditions
3. **Reward**: Intermittent payoffs that reinforce the cycle

Origin: B.F. Skinner's operant conditioning chambers. Random rewards and variable time between awards became the key factor in reinforcement learning. Applied to games by John Hopson at Bungie in 2001.

**The critical insight**: Variable ratio reinforcement (random rewards) creates the strongest behavioral response. Fixed-ratio schedules (predictable rewards) create the weakest long-term engagement.

### 2.2 Production/Resource Systems That Keep Players Coming Back

#### The Faucet-Sink Model
- **Faucets** (sources): How players acquire resources (mining, quests, trading, passive generation)
- **Sinks** (drains): How resources leave the economy (upgrades, consumables, decay, taxes)
- **Balance rule**: Sinks should be slightly larger than sources. Too much = painful scarcity and player churn. Too little = resource pooling and lack of motivation to engage.
- **The chain should always be pulled somewhat taut** (Lost Garden).

#### Exponential Cost Design
- Each upgrade costs exponentially more than the previous one
- Costs grow exponentially while production grows linearly or polynomially
- Early in a run, production exceeds costs (feels rewarding)
- Eventually costs become prohibitive (triggers prestige/reset mechanic)
- Formula pattern: `cost(n) = base_cost * growth_rate^n`

#### The Prestige/Reset Mechanic
- Players voluntarily reset progress in exchange for a permanent multiplier
- Popularized by Cookie Clicker, now standard in idle games
- **Why it works psychologically**:
  - Previously time-consuming stages clear much faster after reset (power fantasy)
  - Deciding optimal reset timing adds strategic depth
  - Effectively an "idle game New Game+" that's integrated into the core loop
  - Solves the endgame stagnation problem by making growth manageable again

### 2.3 Optimal Tick Rate

- **NGU Idle**: 1 tick every 0.02 seconds (50 ticks/second) for active play
- **General guidance**: The tick rate depends on whether the player is active or offline:
  - Active play: Higher tick rates (10-50/sec) for responsive feedback
  - Offline calculation: Simulate in bulk on return (calculate elapsed time * production rate)
  - Visual updates: 1-10 per second for number animations and progress bars
- **Important**: Visual feedback tick rate matters more than simulation tick rate. Players need to see numbers going up.

### 2.4 Offline Progression Best Practices

- Players MUST return to find they've earned meaningful rewards (sense of accomplishment)
- Offline earnings should be slightly less efficient than active play (incentivizes engagement without punishing absence)
- Display a clear "while you were away" summary screen
- Use time-capped offline earnings (e.g., max 8-12 hours) to encourage daily check-ins
- Some games offer "catch-up" bonuses (watch an ad to 2x your offline earnings)

### 2.5 Active vs. Passive Gameplay Ratio

**The research consensus: 60% passive / 40% active**

- Best idle games: 60% of progress from idle mechanics, 40% from active engagement
- Idle gamers play **5.3 sessions/day** (vs. 4.6 for hyper-casual), with **8-minute average session length**
- ARPDAU (Average Revenue Per Daily Active User) for idle games is **9x higher** than hyper-casual
- Arcade-idle hybrids achieve ~50% day-1 retention and 25-minute D0 playtime

#### The Three Engagement Phases
1. **Hook phase (0-30 minutes)**: Immediate gratification, tutorial, first upgrades
2. **Habit phase (1-7 days)**: Regular check-ins, daily rewards, unlocking new systems
3. **Hobby phase (weeks-months)**: Deep systems, long-term goals, prestige mechanics, community

### 2.6 The "Hook Loop" for Idle/Strategy Games

The core idle game loop:
```
Active Play -> Earn Resources -> Buy Upgrades -> Production Increases ->
Eventually Stalls -> Prestige Reset -> Start Again Faster -> Discover New Content
```

Key additions that prevent staleness:
- **Achievement counters** showing resource generation rates
- **Progress bars and milestones** so even passive play feels active
- **Events, bosses, contracts, mastery tracks** prevent the "AFK plateau"
- **Everything should increase exponentially** so growth is always noticeable against the new baseline (e.g., production rates rising x1.1 per level-up)

---

## 3. Realistic Simulation Mechanics in Strategy Games

### 3.1 Civilization: Resource Production, Growth, and Decay

#### Production Decay (Civ IV / Beyond the Walls)
- **Buildings/Wonders**: Decay after 50 "idle" turns. Each turn reduces hammers by 1%: `NewHammers = Floor(0.99 * OldHammers)`
- **Units**: Decay after 10 "idle" turns. Each turn reduces hammers by 2%: `NewHammers = Floor(0.98 * OldHammers)`

#### Civilization VII Changes
- If another civilization completes a Wonder first, a portion of invested Production is **refunded**
- Swapping or canceling a project preserves invested Production (can resume later)
- Production gradually decreases in relative value as game progresses, while Gold becomes more viable
- Some buildings retain effects across Ages; others become outdated

#### Growth Model
- Food surplus drives population growth
- Population drives production capacity
- Technology unlocks new resource types and production methods
- Multiple interlocking resource types (Food, Production, Gold, Culture, Science, Faith) prevent any single strategy from dominating

### 3.2 Catan: Resource Scarcity as Tension

#### Core Scarcity Mechanics
- **Probabilistic resource generation**: Two dice determine which tiles produce. Tiles numbered 6 and 8 produce most often; 2 and 12 least often. Players compete for high-probability positions.
- **Gatekeeper resources**: When a resource is scarce, it acts as a gatekeeper. You need it to execute your strategy but can't produce enough. Scarcity makes a resource exponentially more valuable when only one player produces it.
- **The Robber**: When a 7 is rolled, players with 7+ cards lose half, and the robber blocks a tile's production. This creates a "hoarding penalty" mechanic.

#### Trading as a Tension Mechanism
- Players must trade to acquire resources they can't produce
- Trading creates natural negotiation, alliances, and rivalries
- Port trading (4:1 or 2:1) provides an alternative path but at a cost
- The "crux of the game is trade, which creates balance by encouraging players to exchange resources"

#### Multiple Paths to Victory
- Expand (roads + settlements)
- Upgrade (cities)
- Development cards (largest army, hidden victory points)

### 3.3 Dwarf Fortress: Realistic World Simulation

#### Design Philosophy
- Models individual elements rather than entire systems for better simulations
- Handles fields separately (temperature, rainfall, elevation, drainage) and their interplay determines biomes

#### Specific Simulation Systems

**Geology & Terrain**:
- Geologically accurate rock layers (olivine, gabbro at correct depths)
- Topmost layer: sand, clay, soil (for farming)
- Deeper layers: rock with minerals in realistic clusters/layers

**Water & Fluid Dynamics**:
- Every tile holds 0-7 levels of water
- Water simulated like falling sand
- Dynamic weather: wind, humidity, air masses create fronts, clouds, storms, blizzards

**Combat & Body Simulation**:
- Skills, individual body parts, material properties
- Aimed attacks, wrestling, pain, nausea, poison effects
- Damage model based on material science (bronze vs. iron vs. steel)

**Character AI**:
- Individual emotional states, preferences (favorite gems), grudges
- Needs hierarchy (food, drink, sleep, social, creative expression)
- Memories that affect future behavior

**Key Lesson**: Complexity emerges from simple systems interacting, not from complex rules.

### 3.4 EVE Online: Player-Driven Economy

#### Core Architecture
- **Almost everything is player-made**: Ships, ammunition, modules, structures. NPC-produced items are minimal.
- **Full supply chain**: Raw resources -> Refining -> Components -> Final products
- **Regional markets**: Each region has its own market board. Items must be physically transported. This creates logistics gameplay (traders, haulers).

#### Economic Controls
- ISK (currency) enters via NPC bounties and loot sales
- ISK leaves via transaction taxes, repair costs, blueprint costs
- CCP hired a full-time economist (Dr. Eyjolfur Gudmundsson, 2007) to monitor the economy
- Player conflicts directly affect market prices across regions

#### Why It Works
- **Destruction creates demand**: Ships and items are permanently destroyed in PvP, creating constant demand for manufacturing
- **Geographic market fragmentation**: Creates arbitrage opportunities and logistics professions
- **No "auction house"**: Physical item locations prevent instant global trading, adding depth
- **Player-set prices**: Pure supply and demand with no price floors or ceilings

### 3.5 Clash of Clans: Offline Attacks and Shields

#### Shield System
- Shields prevent your village from being attacked
- **Awarded automatically based on attack damage received**:
  - 30% destruction -> 12-hour shield
  - 60% destruction -> 14-hour shield
  - 90% destruction -> 16-hour shield
- Attacking another player **removes your entire shield**, regardless of remaining time
- Shields only work below 5,000 trophies

#### Design Purpose
- Prevents farming and rapid trophy/resource loss
- Creates a strategic decision: "Do I attack now and lose my shield, or wait?"
- The progressive shield duration rewards being fully attacked (counterintuitive but prevents griefing)
- Players who are offline for long periods get naturally protected after their first incoming attack

---

## 4. What Makes Strategy Games Go VIRAL

### 4.1 Social Mechanics That Drive Sharing

- **Guild/Clan/Squad systems** provide identity and belonging, encouraging loyalty
- **Shared goals** within communities drive collective engagement
- Players organize tournaments, share strategies, offer mutual support
- **Referral programs** increase customer acquisition by up to 16% and lifetime value by 25%
- **Social proof**: When players see others playing, the game becomes more socially acceptable

### 4.2 Competition Mechanics

#### Leaderboards and Rankings
- Global and server-wide leaderboards create aspiration and comparison
- Ranked seasons with exclusive rewards drive engagement cycles
- Skill-based matchmaking keeps competition feeling fair
- **The key**: Competition must feel achievable. If the top is unreachable, players disengage.

#### Tournament Systems
- Time-limited competitions create urgency
- Bracket-based tournaments create narrative arcs
- Clan vs. clan wars create collective investment

### 4.3 FOMO (Fear of Missing Out) Mechanics

- **Time-limited events**: Seasonal exclusives, battle passes, rotating content
- **Loss aversion**: Players find losing progress more painful than the joy of gaining (2:1 ratio in behavioral economics)
- **Social leaderboards**: Create competitive FOMO about falling behind
- **Exclusive content**: Items only available during specific windows

#### FOMO Implementation Patterns
- Daily login rewards (escalating over consecutive days)
- Limited-time offers and flash sales
- Seasonal events with exclusive rewards
- "Your friends are playing right now" notifications
- Streak-based rewards that reset on missed days

#### Warning
- Extreme FOMO erodes goodwill and alienates the player base
- Players are increasingly informed and vocal about manipulative design
- Sustainable FOMO creates gentle urgency, not anxiety

### 4.4 Network Effects

#### Direct Network Effects in Games
- More players = shorter queue times and better matchmaking
- More diverse skill levels = more interesting gameplay
- Each new player makes the game more valuable for existing players

#### How to Engineer Network Effects
- If competition involves real people, network effects are natural
- Add multiplayer modes or social features (chat, trading, co-op)
- "Clans" that organize players create stronger feelings of belonging
- Advertise player counts ("10M players and growing") as social proof

#### The Flywheel
```
More Players -> Better Matches -> More Fun -> More Sharing -> More Players
```

### 4.5 Psychology of Viral Games

#### Core Psychological Drivers
1. **Autonomy**: Players feel in control of meaningful choices
2. **Competence**: Clear feedback showing skill improvement
3. **Relatedness**: Connection to other players and shared experiences
4. **Variable rewards**: Unpredictable positive outcomes (dopamine response)
5. **Sunk cost**: Investment of time makes quitting feel like loss
6. **Status**: Visible markers of achievement others can see

#### What Makes Something Shareable
- **Surprising outcomes** that create stories ("You won't believe what happened...")
- **Shared cultural references** (memes, humor)
- **Status signaling** (showing off achievements)
- **Low barrier to try** (browser-based, free-to-play)
- **Clips that are easy to understand** and remember

---

## 5. Blockchain/Crypto Games: Successes and Failures

### 5.1 Axie Infinity - The Cautionary Tale

#### What Worked Initially
- 2.7M daily active users at peak (November 2021)
- Created a real economy in the Philippines and developing nations
- "Scholarship" system allowed asset lending (innovative but exploitative)
- Breeding mechanic created speculative demand

#### What Failed
- **Unsustainable Ponzi economics**: Value depended on constant influx of new players
- **SLP token crashed**: Lost over 99% of peak value in February 2022
- **Shallow gameplay**: Described as "a gimmick game that incentivized grinding for tokens"
- **Exploitative labor**: Sets of three Axies cost $1,000+, leading to wealthy players extracting value from economically disadvantaged workers
- **Security disaster**: $600M Ronin Network hack in March 2022
- **User collapse**: From 2.7M daily users to ~52,659

#### Key Lesson
The game's value proposition was earning, not fun. When token prices collapsed, there was no reason to play. "The model relies on a constant inflow of new players to sustain it" -- textbook unsustainable economics.

#### Current State (2025)
- Holding at ~200,000 daily players. Still leading the market but a fraction of the peak.
- Has tried to pivot toward better gameplay but reputation damage is severe.

### 5.2 Dark Forest - The Technical Achievement

#### What Made It Unique
- **First incomplete-information game on a decentralized system**
- Built on Ethereum with **zkSNARKs** (zero-knowledge proofs)
- All game rules deployed as smart contracts on-chain
- Inspired by Cixin Liu's "The Dark Forest" novel

#### Core Mechanics
- **Cryptographic fog of war**: Players can only see a small area around them. The rest is hidden behind zero-knowledge proofs, preventing cheating without a central server.
- **Energy-based conquest**: Energy is used for both conquest AND travel. Farther destinations mean less energy arrives. This naturally limits rapid expansion.
- **Procedurally generated infinite universe**: Players spawn on a home planet and explore outward.
- **No matchmaking**: Open PvP with a publicly viewable leaderboard and ranked rewards.

#### What Worked
- Blockchain used for genuine gameplay innovation (fog of war without a server), not just monetization
- Community-driven development with plugin APIs
- Competitive seasons similar to League of Legends
- Proved that crypto can add real gameplay value when used for its technical properties

#### What Didn't Scale
- High gas costs on Ethereum limited accessibility
- Complex technical requirements alienated casual players
- Small player base limited network effects

### 5.3 Loot - The Bottom-Up Experiment

#### The Concept
- 8,000 NFTs of plain text listing "randomized adventurer gear" (no art)
- Created by Dom Hofmann (co-founder of Vine)
- No minting fee, no creator royalties
- **$46M in sales in 5 days**, total market cap exceeded $180M

#### What Happened
- Community-created derivative projects: visualization tools, games, Adventure Gold token ($AGLD peaked at $7.70, giving holders $77,000 in airdropped tokens)
- The "Lootverse" concept: an open-source game world anyone could build on top of
- **Reality**: Speculative mania died down substantially. Transaction volumes, unique buyers, and average prices all collapsed.
- Working on "Loot 2.0" to address value accrual and reward creators

#### Key Lesson
Bottom-up, community-driven game worlds are compelling conceptually but struggle without a central team driving consistent game development. The speculative layer overwhelmed the creative layer.

### 5.4 The 2024 Telegram Tap-to-Earn Phenomenon

#### Notcoin: 35M players, $1.1B market cap at token launch
#### Hamster Kombat: 300M players in 5 months

Both demonstrated massive viral potential of crypto mechanics on messaging platforms, but by mid-2025 even the developers admitted "the model is probably dead" due to lack of long-term retention.

### 5.5 Games That Actually Succeeded (2024-2025)

#### Big Time
- "Most successful NFT game of 2024"
- $100M+ revenue, $230M+ in player transactions
- **Key differentiator**: Fully free-to-play. All content accessible without NFT purchase.
- Team from Epic Games, Blizzard, EA
- Proved that blockchain games can succeed when gameplay comes first

#### The Sandbox
- 580,000 players during Season 4 (all-time high)
- UGC (user-generated content) economy with monetizable land, games, avatars
- Long-term player through consistent content updates

#### Pixels
- Farming/social game. One of most active blockchain titles of 2024.
- Stabilized at ~25,000 DAU after initial spike. Kept players with spinoff games and enhancements.

### 5.6 What Crypto Mechanics Actually Work vs. Are Gimmicks

#### WORKS: True Ownership and Trading
- Players genuinely value owning and trading items with real monetary value
- BUT only when the items have in-game utility, not just speculative value

#### WORKS: Transparent, Trustless Game Rules
- Dark Forest proved that putting game logic on-chain enables novel gameplay (fog of war without a server)
- Especially valuable for competitive games where fairness matters

#### GIMMICK: Play-to-Earn as Primary Value Proposition
- 93% of blockchain gaming projects fail within their first year (DappRadar 2024)
- When earning is the primary draw, token price collapse kills the game
- Successful games shift to "play AND earn" -- fun first, earning secondary

#### GIMMICK: Artificial Scarcity of Game Assets
- High entry costs ($1,000+ for Axie) create exploitative dynamics
- Free-to-play models (Big Time) dramatically outperform pay-to-play crypto games

#### WORKS: Community-Driven Economies
- When players control the economy (EVE Online model), engagement deepens
- Blockchain enables this without requiring a central authority

#### GIMMICK: Governance Tokens Without Real Governance
- Most "governance" tokens provide no meaningful decision-making power
- Players see through this quickly

### 5.7 The Sustainable Crypto Game Model (2025 Consensus)

1. **Gameplay first**: Build a fun game that would work without blockchain
2. **Blockchain as optional layer**: Ownership, trading, and community rewards as additions, not requirements
3. **Balanced tokenomics**: Token issuance matched by genuine sinks (not just speculation)
4. **Free-to-play**: Never gate core gameplay behind token/NFT purchase
5. **Sustainable economics**: Value comes from the game experience, not from recruiting new players

---

## Key Takeaways for Game Design

### The Universal Hook Loop
```
Low-Barrier Entry -> Immediate Reward -> Curiosity About Next Tier ->
Investment of Time -> Social Connection -> Sunk Cost + Status ->
Long-term Retention
```

### The Numbers That Matter
| Metric | Target |
|--------|--------|
| Active vs. Passive ratio | 40% active / 60% passive |
| Sessions per day (idle games) | 5.3 average |
| Average session length | 8 minutes |
| Day-1 retention (idle-arcade hybrid) | ~50% |
| Hook phase | First 0-30 minutes |
| Habit formation | 1-7 days |
| Production growth per level | x1.1 (exponential) |
| Cost growth per level | x1.15 (slightly faster than production) |
| Offline earnings efficiency | 70-80% of active play rate |
| Max offline accumulation window | 8-12 hours |

### The Five Pillars of a Viral Strategy Game
1. **Persistent world** that progresses without you (creates FOMO and check-in habits)
2. **Social layer** that makes the game better with more players (network effects)
3. **Competitive mechanics** with visible rankings (status and aspiration)
4. **Low barrier to entry** with deep long-term systems (easy to start, hard to master)
5. **Resource scarcity** that creates tension and forces meaningful decisions (trading, diplomacy, conflict)

---

## Sources

### Idle/Incremental Games
- [GameSpot: Best Idle Games 2025](https://www.gamespot.com/gallery/best-idle-games/2900-5676/)
- [Sensor Tower: Top 5 Idle Games Q1 2024](https://sensortower.com/blog/2024-q1-unified-top-5-idler%20games-units-us-602ae7fb241bc16eb874f8e1)
- [Machinations: How to Design Idle Games](https://machinations.io/articles/idle-games-and-how-to-design-them)
- [Eric Guan: Idle Game Design Principles](https://ericguan.substack.com/p/idle-game-design-principles)
- [Kongregate: The Math of Idle Games Part I](https://blog.kongregate.com/the-math-of-idle-games-part-i/)
- [Kongregate: The Math of Idle Games Part III](https://blog.kongregate.com/the-math-of-idle-games-part-iii/)
- [Lost Garden: Value Chains for Game Economies](https://lostgarden.com/2021/12/12/value-chains/)
- [1kx Network: Sinks & Faucets in Game Economies](https://medium.com/1kxnetwork/sinks-faucets-lessons-on-designing-effective-virtual-game-economies-c8daf6b88d05)
- [Mobile Free To Play: Top 7 Idle Game Mechanics](https://mobilefreetoplay.com/top-7-idle-game-mechanics/)
- [Adrian Crook: Passive Resource Systems in Idle Games](https://adriancrook.com/passive-resource-systems-in-idle-games/)
- [Gamigion: Engagement and Monetization in Idle Games 2025](https://www.gamigion.com/idle/)
- [Grid Inc: Idle Games Best Practices](https://gridinc.co.za/blog/idle-games-best-practices)

### Compulsion Loops & Psychology
- [Wikipedia: Compulsion Loop](https://en.wikipedia.org/wiki/Compulsion_loop)
- [GameAnalytics: The Compulsion Loop Explained](https://www.gameanalytics.com/blog/the-compulsion-loop-explained)
- [Gamasutra: Compulsion Loops & Dopamine in Games](https://www.gamedeveloper.com/design/compulsion-loops-dopamine-in-games-and-gamification)
- [Game Design Skills: Core Gameplay Loop Guide](https://gamedesignskills.com/game-design/core-loops-in-gameplay/)
- [The Recipe Behind Cookie Clicker](https://www.gamedeveloper.com/design/the-recipe-behind-cookie-clicker)
- [Make Tech Easier: Why Games Are Designed to Be Addictive](https://www.maketecheasier.com/why-games-are-designed-addictive/)

### Engagement Research
- [ResearchGate: Exploring Engagement in Idle Game Design (2024)](https://www.researchgate.net/publication/383510819_Exploring_Engagement_in_Idle_Game_Design)
- [ScienceDirect: What Do Players Do in Idle Games?](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305251)
- [GameAnalytics: Benchmark Engagement Metrics for Idle Games](https://gameworldobserver.com/2020/12/22/gameanalytics-names-benchmark-engagement-metrics-idle-games)
- [CHI 2024: Leveraging Idle Games for Behavior Change](https://dl.acm.org/doi/10.1145/3613904.3642430)

### Strategy Game Mechanics
- [CivFanatics: Civilization IV Game Mechanics](https://civfanatics.com/civ4/strategy/game-mechanics/)
- [Civilization VII: Managing Your Empire Dev Diary](https://civilization.2k.com/civ-vii/game-guide/dev-diary/managing-your-empire/)
- [Mechanics & Meeples: Anatomy of Catan](https://www.mechanics-and-meeples.com/2015/09/14/anatomy-of-a-game-catan/)
- [EVE University Wiki: Economics](https://wiki.eveuniversity.org/Economics)
- [EVE Online Economic System Design](https://050nor.substack.com/p/eve-online-economic-system-design-player-motication-emotion)
- [Clash of Clans Wiki: Shield](https://clashofclans.fandom.com/wiki/Shield)
- [Supercell: Shields & Village Guards](https://support.supercell.com/clash-of-clans/en/articles/multiplayer-attacking-defending.html)
- [Game AI Pro 2: Simulation Principles from Dwarf Fortress](http://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter41_Simulation_Principles_from_Dwarf_Fortress.pdf)
- [Stack Overflow: How Dwarf Fortress Is Built](https://stackoverflow.blog/2021/12/31/700000-lines-of-code-20-years-and-one-developer-how-dwarf-fortress-is-built/)

### Browser MMOs
- [Browser Games of Yesteryear (Travian, OGame, Tribal Wars)](https://goncalotomas.com/posts/browser-games-of-yesteryear)
- [Common Sense Gamer: Best Text-Based MMORPGs 2026](https://commonsensegamer.com/best-text-based-mmorpgs-to-play-now/)
- [PBBG.com: Persistent Browser Based Games](https://pbbg.com/)

### Discord Bot Games
- [Top.gg: Discord Game Bots](https://top.gg/tag/game)
- [Statista: Discord Most Popular Bots 2023](https://www.statista.com/statistics/1368394/discord-server-using-bots-global/)
- [Dank Memer Wiki](https://dankmemer.wiki/)
- [EJAW: Top 10 Discord Game Bots 2025](https://ejaw.net/discord-game-bots/)

### AI/LLM Games
- [arXiv: Survey on LLM-Based Game Agents (2024)](https://arxiv.org/abs/2404.02039)
- [Towards Data Science: Building an LLM-Based Game from Scratch](https://towardsdatascience.com/how-i-built-an-llm-based-game-from-scratch-86ac55ec7a10/)
- [CivAgent: LLM-based Digital Player for Unciv](https://github.com/fuxiAIlab/CivAgent)
- [GamingAgent: LLM/VLM Gaming Agents (ICLR 2026)](https://github.com/lmgame-org/GamingAgent)

### Virality & FOMO
- [Medium: FOMO as Behavioral Manipulation in Games](https://medium.com/@milijanakomad/product-design-and-psychology-the-exploitation-of-fear-of-missing-out-fomo-in-video-game-design-5b15a8df6cda)
- [EntheosWeb: How to Retain Players Through FOMO](https://www.entheosweb.com/how-to-retain-players-through-fomo-in-game-design/)
- [PixelPlex: Viral Telegram Games Mechanics & Strategies 2025](https://pixelplex.io/blog/viral-mechanics-on-telegram-apps/)
- [NFX Masterclass: Network Effects in Gaming](https://www.nfx.com/masterclass/network-effects/network-effects-in-gaming)
- [Cornell: Network Effects in Multiplayer Games](https://blogs.cornell.edu/info2040/2016/11/25/network-effects-in-online-multiplayer-games/)

### Crypto/Blockchain Games
- [Fortune Crypto: Success or Failure of Blockchain Games](https://fortune.com/crypto/2023/09/25/failed-blockchain-based-video-games-axie-infinity/)
- [Beluga: Rise and Fall of Axie Infinity](https://heybeluga.com/articles/why-axie-infinity-failed/)
- [SAGE Journals: Playing, Earning, Crashing - Axie Infinity Analysis (2025)](https://journals.sagepub.com/doi/10.1177/20539517251357296)
- [MIT Technology Review: Dark Forest Blockchain Game](https://www.technologyreview.com/2022/11/10/1062981/dark-forest-blockchain-video-game-creates-metaverse/)
- [Naavik: Dark Forest Deep Dive](https://naavik.co/deep-dives/dark-forest-beacon-of-light/)
- [Decrypt: Loot One Year Later](https://decrypt.co/108354/loot-one-year-later-nft-hype-dead-lootverse-hope-lives-on)
- [TechCrunch: The Loot Project Flips the Script on NFTs](https://techcrunch.com/2021/09/03/loot-games-the-crypto-world/)
- [CoinMarketCap: Telegram Tap-to-Earn Revolution](https://coinmarketcap.com/academy/article/the-telegram-tap-to-earn-mini-game-revolution-crypto-at-your-fingertips)
- [Decrypt: 7 Breakout Crypto Games of 2024](https://decrypt.co/298869/7-breakout-crypto-games-2024)
- [BlockchainGamerBiz: Blockchain Gaming in 2025](https://www.blockchaingamer.biz/features/opinions/36384/blockchain-gaming-looks-to-2025/)
- [TheStreet: 5 Web3 Gaming Projects That Might Survive 2025](https://www.thestreet.com/crypto/innovation/5-web3-gaming-projects-that-might-actually-survive-2025)
