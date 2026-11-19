// Where an import's step lives in the address. The address helpers themselves are in @/ui-kit/Route.hook.

/** The address of an import's step ("/?import=…&step=review"). */
export const importAddress = (id: string, step: string): string => `/?import=${encodeURIComponent(id)}&step=${step}`
