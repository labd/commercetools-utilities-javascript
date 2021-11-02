/**
 * Helper to create AND query predicates.
 *
 * ```ts
 * const name = 'a'
 * const slug = 'b'
 * const description = undefined
 * and(
 * name ? `name = "${name}"` : undefined,
 * description ? `description = "${description}"` : undefined,
 * slug ? `slug = "${slug}"` : undefined,
 * or('x', 'y')
 * )
 *
 * // ((name = "a") and (slug = "b") and (x or y))
 * ```
 */
export const and = (...items: (string | undefined)[]) =>
  items.filter(isValue).length
    ? items
        .filter(isValue)
        .map((x, _, a) => (a.length > 1 ? `(${x})` : x))
        .join(' and ')
    : undefined;

/**
 * Helper to create OR query predicates.
 *
 * ```ts
 * const name = 'a'
 * const slug = 'b'
 * const description = undefined
 * or(
 * name ? `name = "${name}"` : undefined,
 * description ? `description = "${description}"` : undefined,
 * slug ? `slug = "${slug}"` : undefined,
 * and('x', 'y')
 * )
 *
 * // ((name = "a") or (slug = "b") or (x and y))
 * ```
 */
export const or = (...items: (string | undefined)[]) =>
  items.filter(isValue).length
    ? items
        .filter(isValue)
        .map((x, _, a) => (a.length > 1 ? `(${x})` : x))
        .join(' or ')
    : undefined;

/**
 * Utility for lists to ensure there are no empty values.
 *
 * @example
 * ```ts
 * const products = [
 * {id: 'a', price: {centAmount: 20}},
 * {id: 'b', price: null},
 * {id: 'c', price: {centAmount: 30}}
 * ]
 * products.map(x => price).filter(isValue).map(p => p.centAmount)
 *
 * // results in
 * [20, 30]
 * ```
 */
export const isValue = <T>(value: T): value is NonNullable<T> =>
  value !== null && value !== undefined;
