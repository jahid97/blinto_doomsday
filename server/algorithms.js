import { ApiError } from './errors.js';

export function rewatchOrder(graph, targetId) {
  const active = new Set();
  const complete = new Set();
  const ordered = [];
  const stack = [{ id: targetId, next: 0 }];
  active.add(targetId);

  while (stack.length) {
    const frame = stack.at(-1);
    const prerequisites = graph.get(frame.id).prerequisiteIds;

    if (frame.next === prerequisites.length) {
      stack.pop();
      active.delete(frame.id);
      complete.add(frame.id);
      if (frame.id !== targetId) ordered.push(graph.get(frame.id));
      continue;
    }

    const prerequisiteId = prerequisites[frame.next++];
    if (active.has(prerequisiteId)) {
      throw new ApiError(409, 'CIRCULAR_DEPENDENCY', 'Those prerequisites would create a circular dependency.');
    }
    if (complete.has(prerequisiteId)) continue;

    active.add(prerequisiteId);
    stack.push({ id: prerequisiteId, next: 0 });
  }

  return ordered;
}

export function minimumBundles(bundleSizes, groupSize) {
  const sizes = [...bundleSizes].sort((left, right) => right - left);
  const unreachable = groupSize + 1;
  const best = new Uint16Array(groupSize + 1).fill(unreachable);
  const chosen = new Uint16Array(groupSize + 1);
  best[0] = 0;

  for (let seats = 1; seats <= groupSize; seats++) {
    for (const size of sizes) {
      if (size > seats || best[seats - size] + 1 >= best[seats]) continue;
      best[seats] = best[seats - size] + 1;
      chosen[seats] = size;
    }
  }

  if (best[groupSize] === unreachable) {
    return { possible: false, totalBundles: null, bundles: [] };
  }

  const counts = new Map();
  for (let seats = groupSize; seats > 0; seats -= chosen[seats]) {
    const size = chosen[seats];
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }

  return {
    possible: true,
    totalBundles: best[groupSize],
    bundles: sizes.filter((size) => counts.has(size)).map((size) => ({ size, count: counts.get(size) })),
  };
}
