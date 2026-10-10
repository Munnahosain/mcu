import assert from 'node:assert/strict';
import test from 'node:test';
import { canSetAnimationParent } from './layerUtilities.ts';

test('animation parenting rejects self and descendant cycles', () => {
  const parents = new Map([
    ['root', null],
    ['child', 'root'],
    ['grandchild', 'child'],
    ['sibling', 'root'],
  ]);
  const getParentId = (id) => parents.get(id) ?? null;

  assert.equal(canSetAnimationParent('child', 'child', getParentId), false);
  assert.equal(canSetAnimationParent('root', 'grandchild', getParentId), false);
  assert.equal(canSetAnimationParent('grandchild', 'sibling', getParentId), true);
  assert.equal(canSetAnimationParent('child', null, getParentId), true);
});

test('animation parenting rejects already-cyclic parent chains', () => {
  const parents = new Map([
    ['first', 'second'],
    ['second', 'first'],
  ]);

  assert.equal(canSetAnimationParent('other', 'first', (id) => parents.get(id)), false);
});
