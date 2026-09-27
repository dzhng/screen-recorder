export type Rational = Readonly<{ numerator: bigint; denominator: bigint }>;

export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator <= 0n) throw new RangeError("Expected positive denominator");
  let a = numerator < 0n ? -numerator : numerator;
  let b = denominator;
  while (b) [a, b] = [b, a % b];
  return Object.freeze({ numerator: numerator / a, denominator: denominator / a });
}
export function add(a: Rational, b: Rational): Rational {
  return rational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}
export function subtract(a: Rational, b: Rational): Rational {
  return rational(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}
export function multiply(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.numerator, a.denominator * b.denominator);
}
export function divide(a: Rational, b: Rational): Rational {
  if (b.numerator <= 0n) throw new RangeError("Expected positive divisor");
  return rational(a.numerator * b.denominator, a.denominator * b.numerator);
}
export function compare(a: Rational, b: Rational): number {
  const delta = a.numerator * b.denominator - b.numerator * a.denominator;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
export function floor(value: Rational): number {
  const quotient = value.numerator / value.denominator;
  return Number(
    value.numerator < 0n && value.numerator % value.denominator ? quotient - 1n : quotient,
  );
}
export function ceil(value: Rational): number {
  return Number(
    value.numerator / value.denominator +
      (value.numerator > 0n && value.numerator % value.denominator ? 1n : 0n),
  );
}
