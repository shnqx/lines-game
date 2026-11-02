export interface Point {
  x: number;
  y: number;
}

export interface Edge {
  id: string;
  from: number;
  to: number;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  const epsilon = 1e-9;

  return (
    ((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
    ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon))
  );
}

export function getCrossingEdgeIds(
  edges: Edge[],
  positions: Point[],
): Set<string> {
  const crossingIds = new Set<string>();

  for (let i = 0; i < edges.length; i += 1) {
    const first = edges[i];
    for (let j = i + 1; j < edges.length; j += 1) {
      const second = edges[j];
      if (
        first.from === second.from ||
        first.from === second.to ||
        first.to === second.from ||
        first.to === second.to
      ) {
        continue;
      }

      if (
        segmentsIntersect(
          positions[first.from],
          positions[first.to],
          positions[second.from],
          positions[second.to],
        )
      ) {
        crossingIds.add(first.id);
        crossingIds.add(second.id);
      }
    }
  }

  return crossingIds;
}

export function countCrossings(edges: Edge[], positions: Point[]): number {
  let crossings = 0;

  for (let i = 0; i < edges.length; i += 1) {
    const first = edges[i];
    for (let j = i + 1; j < edges.length; j += 1) {
      const second = edges[j];
      if (
        first.from === second.from ||
        first.from === second.to ||
        first.to === second.from ||
        first.to === second.to
      ) {
        continue;
      }

      if (
        segmentsIntersect(
          positions[first.from],
          positions[first.to],
          positions[second.from],
          positions[second.to],
        )
      ) {
        crossings += 1;
      }
    }
  }

  return crossings;
}
