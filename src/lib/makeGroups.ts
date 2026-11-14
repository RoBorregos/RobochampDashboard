// Groups of at most 5 teams; each group winner goes to the semi-finals, paired in order.
const MAX_GROUP = 5;

// Seeded shuffle: groups look random but are the same for every viewer and reload.
export function makeGroups(names: string[], random = false): string[][] {
  const out = [...names].sort();
  let seed = [...out.join("|")].reduce(
    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0,
    7,
  );
  const seeded = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = random ? Math.random : seeded;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Balanced sizes (4 or 5).
  const count = Math.ceil(out.length / MAX_GROUP);
  const groups: string[][] = [];
  for (let g = 0, from = 0; g < count; g++) {
    const size =
      Math.floor(out.length / count) + (g < out.length % count ? 1 : 0);
    groups.push(out.slice(from, (from += size)));
  }
  return groups;
}
