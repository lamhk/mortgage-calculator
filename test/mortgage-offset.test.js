import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule } from '../src/mortgage.js';

function sum(arr, key) {
  return arr.reduce((acc, x) => acc + x[key], 0);
}

test('zero offset: interest matches baseline (monthly repayment)', () => {
  const base = buildSchedule({
    principal: 300_000,
    annualRatePct: 5,
    years: 25,
    frequency: 'monthly',
    type: 'repayment',
    offsetBalance: 0,
  });

  const noOffsetFieldOmitted = buildSchedule({
    principal: 300_000,
    annualRatePct: 5,
    years: 25,
    frequency: 'monthly',
    type: 'repayment',
  });

  assert.ok(base.schedule.length > 0);
  assert.equal(base.schedule.length, noOffsetFieldOmitted.schedule.length);

  // Compare first few periods; floating error tolerance
  for (let i = 0; i < 6; i++) {
    assert.ok(Math.abs(base.schedule[i].interest - noOffsetFieldOmitted.schedule[i].interest) < 1e-9);
    assert.ok(Math.abs(base.schedule[i].principalPaid - noOffsetFieldOmitted.schedule[i].principalPaid) < 1e-9);
  }
});

test('partial offset: reduces interest vs zero offset', () => {
  const zero = buildSchedule({
    principal: 300_000,
    annualRatePct: 5,
    years: 25,
    frequency: 'monthly',
    type: 'repayment',
    offsetBalance: 0,
  });

  const partial = buildSchedule({
    principal: 300_000,
    annualRatePct: 5,
    years: 25,
    frequency: 'monthly',
    type: 'repayment',
    offsetBalance: 50_000,
  });

  // First-period interest should be lower by offset*rate/12
  const expectedDelta = 50_000 * (0.05 / 12);
  const actualDelta = zero.schedule[0].interest - partial.schedule[0].interest;
  assert.ok(Math.abs(actualDelta - expectedDelta) < 1e-6);

  // Total interest over first year should be lower
  const i0 = sum(zero.schedule.slice(0, 12), 'interest');
  const i1 = sum(partial.schedule.slice(0, 12), 'interest');
  assert.ok(i1 < i0);
});

test('full offset: effective principal becomes zero, interest is zero', () => {
  const full = buildSchedule({
    principal: 100_000,
    annualRatePct: 6,
    years: 10,
    frequency: 'monthly',
    type: 'repayment',
    offsetBalance: 200_000,
  });

  assert.ok(full.schedule.length > 0);
  for (const row of full.schedule.slice(0, 24)) {
    assert.equal(row.effectivePrincipal, 0);
    assert.equal(row.interest, 0);
    // payment should go entirely to principal until cleared
    assert.ok(row.principalPaid > 0);
  }
});
