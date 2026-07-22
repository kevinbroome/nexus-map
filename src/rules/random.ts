export function createRandomSeed(): string {
  return crypto.randomUUID();
}

function hashSeed(seed: string): number {
  let hash = 1779033703;

  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandomItems<T>(
  items: T[],
  count: number,
  random: () => number,
): T[] {
  const pool = [...items];

  if (count >= pool.length) {
    return pool;
  }

  const selected: T[] = [];

  for (let index = 0; index < count; index++) {
    const pickIndex = Math.floor(random() * pool.length);
    selected.push(pool.splice(pickIndex, 1)[0]!);
  }

  return selected;
}
