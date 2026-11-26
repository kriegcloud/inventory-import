/**
 * Makes a claim the compiler cannot check, solely to bridge a documented library typing gap.
 * Prove ordinary application values by decoding or narrowing them. Every call must supply a string-literal reason
 * approved in the unsafe-asserts ledger; this function performs no runtime validation.
 */
export function unsafeAssert<T>(...[value, reason]: [value: unknown, reason: string]): T {
  void reason
  return value as T
}
