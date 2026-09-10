/**
 * Money is stored as whole minor units (cents). Never a fraction, ever.
 * Binary floating point cannot represent 0.10 exactly, so 0.10 + 0.20 !== 0.30.
 * Integers have no such problem.
 */
export type Minor = number;

export function fromMajor(major: number): Minor {
  return Math.round(major * 100);
}

export function add(a: Minor, b: Minor): Minor {
  return a + b;
}

export function isPositive(a: Minor): boolean {
  return a > 0;
}
