import { describe, it, expect } from "vitest";
import { MAX_SIMULATION_MONTHS, STALL_MONTHS_LIMIT } from "@/lib/simulation/constants";
import { calcMonthlyInterest } from "@/lib/simulation/interest";
import { SIMULATION_ERROR_CODES, isSimulationErrorCode } from "@/lib/simulation/errorCodes";

describe("packet-0005: engine primitives", () => {
  it("AC-1: calcMonthlyInterest matches Math.round(principal * rate/100 / 12)", () => {
    expect(calcMonthlyInterest(1_000_000, 12)).toBe(Math.round((1_000_000 * 0.12) / 12));
    expect(calcMonthlyInterest(1_000_000, 12)).toBe(10_000);
  });

  it("AC-1: result is always an integer (rounding)", () => {
    const v = calcMonthlyInterest(1_000_000, 5); // 1,000,000*0.05/12 = 4166.67 → 4167
    expect(v).toBe(4167);
    expect(Number.isInteger(v)).toBe(true);
    expect(calcMonthlyInterest(12_000_000, 4.2)).toBe(42_000);
  });

  it("calcMonthlyInterest is 0 for zero principal/rate and non-finite input", () => {
    expect(calcMonthlyInterest(0, 12)).toBe(0);
    expect(calcMonthlyInterest(1_000_000, 0)).toBe(0);
    expect(calcMonthlyInterest(NaN, 12)).toBe(0);
  });

  it("AC-2: MAX_SIMULATION_MONTHS is 720", () => {
    expect(MAX_SIMULATION_MONTHS).toBe(720);
    expect(STALL_MONTHS_LIMIT).toBe(3);
  });

  it("AC-3: error code constants/guard are available", () => {
    expect(SIMULATION_ERROR_CODES.MAX_MONTHS_REACHED).toBe("MAX_MONTHS_REACHED");
    expect(SIMULATION_ERROR_CODES.STALL_3_MONTHS).toBe("STALL_3_MONTHS");
    expect(isSimulationErrorCode("STALL_3_MONTHS")).toBe(true);
    expect(isSimulationErrorCode("NOPE")).toBe(false);
  });
});
