import { and, or } from '.';

test.each([
  {
    input: [],
    result: undefined,
  },
  {
    input: ['a', 'b'],
    result: '(a) and (b)',
  },
  {
    input: ['a', undefined, 'c'],
    result: '(a) and (c)',
  },
  {
    input: ['a', or('b', 'c')],
    result: '(a) and ((b) or (c))',
  },
])('and', ({ input, result }) => {
  expect(and(...input)).toBe(result);
});

test.each([
  { input: [], result: undefined },
  {
    input: ['a', 'b'],
    result: '(a) or (b)',
  },
  {
    input: ['a', undefined, 'c'],
    result: '(a) or (c)',
  },
  {
    input: ['a', and('b', 'c')],
    result: '(a) or ((b) and (c))',
  },
])('or', ({ input, result }) => {
  expect(or(...input)).toBe(result);
});
