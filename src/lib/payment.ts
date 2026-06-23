// Credit-card payment rules — single source of truth shared by the order API
// (server-side, authoritative) and the checkout / payment UIs (client gating).
// We use a manual "DM the page for a payment link" flow with no gateway, so the
// amount charged to a card has a hard ceiling.

/** Surcharge added to the payable when paying by credit card (+5%). */
export const CARD_SURCHARGE_RATE = 0.05

/** Max amount (THB) we can charge on a single credit-card order, INCLUDING the surcharge. */
export const CARD_MAX_TOTAL = 2000
