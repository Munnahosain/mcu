export function canSetAnimationParent(
  elementId: string,
  candidateParentId: string | null | undefined,
  getParentId: (id: string) => string | null | undefined
): boolean {
  const visited = new Set<string>();
  let currentId = candidateParentId;
  while (currentId) {
    if (currentId === elementId || visited.has(currentId)) return false;
    visited.add(currentId);
    currentId = getParentId(currentId);
  }
  return true;
}
