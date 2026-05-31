import type { SimulationErrorCode } from "@/lib/types";

/** Runtime constants for the two simulation error codes (type lives in types.ts). */
export const SIMULATION_ERROR_CODES = {
  STALL_3_MONTHS: "STALL_3_MONTHS",
  MAX_MONTHS_REACHED: "MAX_MONTHS_REACHED",
} as const satisfies Record<string, SimulationErrorCode>;

export type { SimulationErrorCode };

export function isSimulationErrorCode(value: unknown): value is SimulationErrorCode {
  return value === "STALL_3_MONTHS" || value === "MAX_MONTHS_REACHED";
}
