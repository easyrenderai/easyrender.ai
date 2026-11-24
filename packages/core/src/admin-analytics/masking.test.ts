import { expect, it } from 'vitest';
import { maskEmail } from './masking';

it.each([
  ['john@gmail.com', 'jo***@g***.com'],
  ['a@b.co', '***@***.co'],
  ['ab@company.co.uk', 'a***@c***.c***.uk'],
  [' john+private@sub.example.com ', 'jo***@s***.e***.com'],
  ['broken', '***'],
  ['name@@host.com', '***'],
  ['name@.com', '***'],
  [null, '—'],
  [undefined, '—'],
  ['', '—'],
])('masks %s before it reaches a client', (input, expected) => {
  expect(maskEmail(input)).toBe(expected);
});
