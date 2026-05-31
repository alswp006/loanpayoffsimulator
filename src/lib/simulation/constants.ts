/** Hard cap on simulated months — prevents infinite loops on non-amortizing input. */
export const MAX_SIMULATION_MONTHS = 720;

/** Consecutive months of non-decreasing principal that abort a strategy. */
export const STALL_MONTHS_LIMIT = 3;
