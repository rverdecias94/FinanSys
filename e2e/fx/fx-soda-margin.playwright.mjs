/**
 * Script de apoyo para playwright-cli / `npx playwright cli run-code`.
 * Dataset canónico: R0=800 → precio 1000; R1=1000 → sugerido 1250.
 *
 * Uso (con sesión ya abierta en localhost):
 *   npx playwright cli run-code --filename=e2e/fx/fx-soda-margin.playwright.mjs
 *
 * Este archivo documenta aserciones; la UI real depende de auth.
 * Las pruebas unitarias del dataset están en replacementPricing.test.js.
 */
export const SODA_FIXTURE = {
  r0: 800,
  r1: 1000,
  unitCostCup: 800,
  priceAtR0: 1000,
  suggestedAtR1: 1250,
  marginPct: 25,
}

export function assertSuggestedAtR1(suggested) {
  if (Number(suggested) !== SODA_FIXTURE.suggestedAtR1) {
    throw new Error(`Esperado sugerido ${SODA_FIXTURE.suggestedAtR1}, got ${suggested}`)
  }
}
