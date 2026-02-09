import type { PlayerState } from '@nodecoin/engine';

const ERA_NAMES: Record<number, string> = {
  1: 'Aldea',
  2: 'Pueblo',
  3: 'Ciudad',
  4: 'Metropolis',
};

const RESOURCE_ICONS: Record<string, string> = {
  wood: 'Wood',
  food: 'Food',
  stone: 'Stone',
  iron: 'Iron',
  gems: 'Gems',
  mana: 'Mana',
};

export function formatStatus(state: PlayerState): string {
  const lines: string[] = [];

  lines.push(`=== ${state.name} ===`);
  lines.push(`Era: ${ERA_NAMES[state.era] ?? 'Unknown'} | Tick: ${state.tick}`);
  lines.push(`Population: ${state.population.current}/${state.population.max} | Happiness: ${state.population.happiness}`);
  lines.push(`Tokens: ${state.tokens.toFixed(2)} NODECOIN`);
  lines.push('');

  lines.push('--- Resources ---');
  for (const [key, value] of Object.entries(state.resources)) {
    const storage = state.resourceStorage[key as keyof typeof state.resourceStorage] ?? 0;
    const icon = RESOURCE_ICONS[key] ?? key;
    const pct = storage > 0 ? Math.round((value / storage) * 100) : 0;
    const bar = formatBar(pct);
    lines.push(`  ${icon}: ${Math.floor(value)}/${storage} ${bar}`);
  }
  lines.push('');

  if (state.buildings.length > 0) {
    lines.push('--- Buildings ---');
    for (const b of state.buildings) {
      if (b.constructionTicksRemaining > 0) {
        lines.push(`  ${b.id} (Lv${b.level}) [Building... ${b.constructionTicksRemaining} ticks left]`);
      } else {
        lines.push(`  ${b.id} (Lv${b.level})`);
      }
    }
    lines.push('');
  }

  if (state.buildQueue.length > 0) {
    lines.push('--- Build Queue ---');
    for (const b of state.buildQueue) {
      lines.push(`  ${b.id} - ${b.constructionTicksRemaining} ticks remaining`);
    }
    lines.push('');
  }

  const totalUnits = Object.values(state.army.units).reduce((a, b) => a + b, 0);
  if (totalUnits > 0) {
    lines.push('--- Army ---');
    lines.push(`  Strategy: ${state.army.strategy}`);
    for (const [type, count] of Object.entries(state.army.units)) {
      if (count > 0) {
        lines.push(`  ${type}: ${count}`);
      }
    }
    lines.push('');
  }

  if (state.research.current) {
    lines.push('--- Research ---');
    lines.push(`  Researching: ${state.research.current} (progress: ${state.research.progress})`);
    lines.push(`  Completed: ${state.research.completed.length} technologies`);
    lines.push('');
  }

  if (state.activeEffects.length > 0) {
    lines.push('--- Active Effects ---');
    for (const e of state.activeEffects) {
      lines.push(`  ${e.type}: ${e.modifier > 0 ? '+' : ''}${(e.modifier * 100).toFixed(0)}% (${e.ticksRemaining} ticks left)`);
    }
    lines.push('');
  }

  if (state.prestige.level > 0) {
    lines.push(`--- Prestige ---`);
    lines.push(`  Level: ${state.prestige.level} | Legacy Multiplier: x${state.prestige.legacyMultiplier.toFixed(2)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatInventory(state: PlayerState): string {
  const lines: string[] = [];

  lines.push('=== Inventory ===');
  lines.push('');
  lines.push('Resources:');
  for (const [key, value] of Object.entries(state.resources)) {
    const storage = state.resourceStorage[key as keyof typeof state.resourceStorage] ?? 0;
    lines.push(`  ${RESOURCE_ICONS[key] ?? key}: ${Math.floor(value)} / ${storage}`);
  }
  lines.push('');
  lines.push(`NODECOIN: ${state.tokens.toFixed(2)}`);
  lines.push('');

  lines.push('Army:');
  for (const [type, count] of Object.entries(state.army.units)) {
    lines.push(`  ${type}: ${count}`);
  }

  return lines.join('\n');
}

export function formatNarrative(events: Array<{ description: string }>): string {
  if (events.length === 0) return 'All is quiet in your settlement.';
  return events.map((e) => `- ${e.description}`).join('\n');
}

function formatBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + '] ' + pct + '%';
}
