/** The browser Storage read boundary shared by test pages; an absent key is null, and empty text stays text. */
export const StorageTwin = {
  getItem: (items: Record<string, string>, key: string): string | null => items[key] ?? null
}
