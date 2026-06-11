/**
 * Carbon Compass – Comprehensive Test Suite
 * Run with: npx --yes jest app.test.js --verbose
 *
 * Covers:
 *  - Emission calculation correctness (home, travel, food, stuff)
 *  - Input sanitization / XSS prevention
 *  - Allowlist / input validation helpers
 *  - Edge-case guards (NaN, negatives, extremes, divide-by-zero)
 *  - State management helpers (planned savings, history)
 *  - Intensity classification with all goal levels
 *  - Action scoring & ranking
 *  - History persistence helpers
 *  - localStorage wrappers (storageSave / storageLoad)
 *  - Integration: full weekly footprint calculation
 */

"use strict";

// ─── Shared constants (mirrors app.js) ────────────────────────────────────────

const FACTORS = Object.freeze({
  electricity: 0.72,
  transport: Object.freeze({
    car: 0.18,
    motorbike: 0.1,
    bus: 0.075,
    metro: 0.035,
    cycle: 0,
  }),
  flightsPerHourWeekly: 22,
  dietWeekly: Object.freeze({ meat: 36, mixed: 25, vegetarian: 17, plant: 11 }),
  lowCarbonMealSaving: 0.45,
  deliveryWeekly: 0.65,
  wasteBag: 1.8,
});

const WEEKS_PER_MONTH    = 4.345;
const FOOD_EMISSION_FLOOR = 4;
const BASE_TARGET_KG     = 45;
const GOAL_MULTIPLIERS   = Object.freeze({ starter: 1.2, balanced: 1, bold: 0.78 });

const VALID_TRANSPORT_MODES = Object.freeze(["car", "motorbike", "bus", "metro", "cycle"]);
const VALID_DIETS           = Object.freeze(["meat", "mixed", "vegetarian", "plant"]);
const VALID_GOALS           = Object.freeze(["starter", "balanced", "bold"]);
const VALID_FILTERS         = Object.freeze(["all", "home", "travel", "food", "stuff"]);

// ─── Pure helpers (extracted from app.js for isolated unit testing) ──────────

/**
 * Sanitize HTML special characters to prevent XSS.
 * @param {string} input
 * @returns {string}
 */
function sanitizeText(input) {
  if (typeof input !== "string") { return ""; }
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Safely parse a value to a finite number; returns 0 for non-finite results.
 * @param {string|number} value
 * @returns {number}
 */
function safeParseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Clamp a numeric value between inclusive min and max bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate a string value against an allowlist; return fallback when not found.
 * @param {string} value
 * @param {ReadonlyArray<string>} allowed
 * @param {string} fallback
 * @returns {string}
 */
function allowlisted(value, allowed, fallback) {
  return allowed.indexOf(value) !== -1 ? value : fallback;
}

/**
 * Calculate home energy emission (kg CO2e / week).
 * @param {number} electricityKWh
 * @param {number} renewableFraction  0–1
 * @param {number} household          persons ≥ 1
 * @returns {number}
 */
function calcHome(electricityKWh, renewableFraction, household) {
  const hh = Math.max(household, 1);
  return (electricityKWh * FACTORS.electricity * (1 - renewableFraction)) / hh;
}

/**
 * Calculate travel emission (kg CO2e / week).
 * @param {string} mode
 * @param {number} commuteKm
 * @param {number} flightHours
 * @returns {number}
 */
function calcTravel(mode, commuteKm, flightHours) {
  const modeFactor = FACTORS.transport[mode] !== undefined ? FACTORS.transport[mode] : 0;
  const commute    = commuteKm * modeFactor;
  const flight     = (flightHours * FACTORS.flightsPerHourWeekly) / WEEKS_PER_MONTH;
  return commute + flight;
}

/**
 * Calculate food emission (kg CO2e / week).
 * @param {string} diet
 * @param {number} lowCarbonMeals
 * @returns {number}
 */
function calcFood(diet, lowCarbonMeals) {
  const base    = FACTORS.dietWeekly[diet] !== undefined ? FACTORS.dietWeekly[diet] : FACTORS.dietWeekly.mixed;
  const reduced = base - lowCarbonMeals * FACTORS.lowCarbonMealSaving;
  return Math.max(reduced, FOOD_EMISSION_FLOOR);
}

/**
 * Calculate stuff & waste emission (kg CO2e / week).
 * @param {number} deliveries
 * @param {number} wasteBags
 * @param {number} recyclingFraction  0–1
 * @returns {number}
 */
function calcStuff(deliveries, wasteBags, recyclingFraction) {
  const deliveryEmission = (deliveries * FACTORS.deliveryWeekly) / WEEKS_PER_MONTH;
  const wasteEmission    = wasteBags * FACTORS.wasteBag * (1 - recyclingFraction * 0.58);
  return deliveryEmission + wasteEmission;
}

/**
 * Classify total emission into one of four intensity levels.
 * @param {number} total
 * @param {'starter'|'balanced'|'bold'} goal
 * @returns {'low'|'steady'|'high'|'urgent'}
 */
function getIntensity(total, goal) {
  const multiplier = GOAL_MULTIPLIERS[goal] !== undefined ? GOAL_MULTIPLIERS[goal] : 1;
  const target     = BASE_TARGET_KG * multiplier;
  if (total <= target * 0.75)  { return "low"; }
  if (total <= target)          { return "steady"; }
  if (total <= target * 1.35)  { return "high"; }
  return "urgent";
}

/**
 * Score an action given the current state context.
 * @param {object} action
 * @param {object|null} state
 * @returns {number}
 */
function scoreAction(action, state) {
  if (!state) { return action.saving; }
  let score = action.saving;
  if (action.category === state.topCategory) { score += 9; }
  if (action.effort === "Low")               { score += 4; }
  if (action.effort === "Medium")            { score += 2; }
  if (action.id === "ac-flight"    && state.flightHours === 0)           { score -= 16; }
  if (action.id === "ac-renewable" && state.renewable > 0.65)            { score -= 8;  }
  if (action.id === "ac-transit"   && state.transportMode === "cycle")   { score -= 12; }
  return score;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// ── sanitizeText ─────────────────────────────────────────────────────────────
describe("sanitizeText – XSS prevention", () => {
  test("plain text passes through unchanged", () => {
    expect(sanitizeText("hello world")).toBe("hello world");
  });

  test("escapes < and > characters", () => {
    expect(sanitizeText("<script>")).toBe("&lt;script&gt;");
  });

  test("escapes ampersand", () => {
    expect(sanitizeText("cats & dogs")).toBe("cats &amp; dogs");
  });

  test("escapes double quotes", () => {
    expect(sanitizeText('"quoted"')).toBe("&quot;quoted&quot;");
  });

  test("escapes single quotes", () => {
    expect(sanitizeText("it's")).toBe("it&#x27;s");
  });

  test("neutralizes a full XSS payload", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const safe    = sanitizeText(payload);
    expect(safe).not.toContain("<");
    expect(safe).not.toContain(">");
    expect(safe).not.toContain('"');
  });

  test("returns empty string for non-string input types", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(42)).toBe("");
    expect(sanitizeText({})).toBe("");
  });

  test("handles an empty string input", () => {
    expect(sanitizeText("")).toBe("");
  });
});

// ── safeParseNumber ───────────────────────────────────────────────────────────
describe("safeParseNumber – input validation", () => {
  test("parses valid integer string", ()    => { expect(safeParseNumber("42")).toBe(42); });
  test("parses valid float string",   ()    => { expect(safeParseNumber("3.14")).toBeCloseTo(3.14, 5); });
  test("returns 0 for empty string",  ()    => { expect(safeParseNumber("")).toBe(0); });
  test("returns 0 for NaN input",     ()    => { expect(safeParseNumber(NaN)).toBe(0); });
  test("returns 0 for +Infinity",     ()    => { expect(safeParseNumber(Infinity)).toBe(0); });
  test("returns 0 for -Infinity",     ()    => { expect(safeParseNumber(-Infinity)).toBe(0); });
  test("returns 0 for non-numeric string",  () => { expect(safeParseNumber("abc")).toBe(0); });
  test("passes through a valid number",     () => { expect(safeParseNumber(100)).toBe(100); });
  test("handles negative numbers correctly",() => { expect(safeParseNumber("-5")).toBe(-5); });
  test("handles zero correctly",            () => { expect(safeParseNumber(0)).toBe(0); });
});

// ── clamp ─────────────────────────────────────────────────────────────────────
describe("clamp – value clamping", () => {
  test("value below min → returns min",           () => { expect(clamp(-10, 0, 100)).toBe(0); });
  test("value above max → returns max",           () => { expect(clamp(150, 0, 100)).toBe(100); });
  test("value within range → returned unchanged", () => { expect(clamp(50, 0, 100)).toBe(50); });
  test("value equal to min boundary",             () => { expect(clamp(0, 0, 100)).toBe(0); });
  test("value equal to max boundary",             () => { expect(clamp(100, 0, 100)).toBe(100); });
  test("negative range works correctly",          () => { expect(clamp(-3, -10, -1)).toBe(-3); });
});

// ── allowlisted ───────────────────────────────────────────────────────────────
describe("allowlisted – security input validation", () => {
  test("returns value when it is in the allowlist", () => {
    expect(allowlisted("car", VALID_TRANSPORT_MODES, "car")).toBe("car");
  });

  test("returns fallback when value is NOT in the allowlist", () => {
    expect(allowlisted("hovercraft", VALID_TRANSPORT_MODES, "car")).toBe("car");
  });

  test("returns fallback for an empty string when not allowed", () => {
    expect(allowlisted("", VALID_DIETS, "mixed")).toBe("mixed");
  });

  test("all transport modes pass the allowlist", () => {
    VALID_TRANSPORT_MODES.forEach((m) => {
      expect(allowlisted(m, VALID_TRANSPORT_MODES, "car")).toBe(m);
    });
  });

  test("all diet values pass the allowlist", () => {
    VALID_DIETS.forEach((d) => {
      expect(allowlisted(d, VALID_DIETS, "mixed")).toBe(d);
    });
  });

  test("all goal values pass the allowlist", () => {
    VALID_GOALS.forEach((g) => {
      expect(allowlisted(g, VALID_GOALS, "balanced")).toBe(g);
    });
  });

  test("all filter values pass the allowlist", () => {
    VALID_FILTERS.forEach((f) => {
      expect(allowlisted(f, VALID_FILTERS, "all")).toBe(f);
    });
  });

  test("returns fallback for injected script value", () => {
    expect(allowlisted("<script>alert(1)</script>", VALID_GOALS, "balanced")).toBe("balanced");
  });

  test("is case-sensitive (uppercase variant is rejected)", () => {
    expect(allowlisted("CAR", VALID_TRANSPORT_MODES, "car")).toBe("car");
  });
});

// ── calcHome ──────────────────────────────────────────────────────────────────
describe("calcHome – home energy emissions", () => {
  test("zero electricity produces zero emission", () => {
    expect(calcHome(0, 0, 1)).toBe(0);
  });

  test("100 % renewable share eliminates electricity emission", () => {
    expect(calcHome(100, 1, 1)).toBe(0);
  });

  test("divides correctly by household size", () => {
    const single = calcHome(58, 0, 1);
    const triple = calcHome(58, 0, 3);
    expect(triple).toBeCloseTo(single / 3, 5);
  });

  test("household < 1 is treated as 1 (no divide-by-zero)", () => {
    expect(calcHome(58, 0, 0)).toBe(calcHome(58, 0, 1));
    expect(calcHome(58, 0, -5)).toBe(calcHome(58, 0, 1));
  });

  test("typical input produces expected value (58 kWh, 10 % renewable, 3 people → ≈ 12.528)", () => {
    // (58 * 0.72 * 0.9) / 3 = 12.528
    expect(calcHome(58, 0.1, 3)).toBeCloseTo(12.528, 2);
  });

  test("partial renewable reduces emission proportionally", () => {
    const full = calcHome(100, 0, 1);
    const half = calcHome(100, 0.5, 1);
    expect(half).toBeCloseTo(full / 2, 5);
  });

  test("large electricity value scales linearly", () => {
    expect(calcHome(200, 0, 1)).toBeCloseTo(calcHome(100, 0, 1) * 2, 5);
  });
});

// ── calcTravel ────────────────────────────────────────────────────────────────
describe("calcTravel – transport + flight emissions", () => {
  test("zero km and zero flight hours → zero", () => {
    expect(calcTravel("car", 0, 0)).toBe(0);
  });

  test("cycling mode contributes zero commute emission", () => {
    expect(calcTravel("cycle", 200, 0)).toBe(0);
  });

  test("car commute factor applied correctly (85 km → 15.3 kg)", () => {
    expect(calcTravel("car", 85, 0)).toBeCloseTo(15.3, 5);
  });

  test("metro has lower factor than car", () => {
    expect(calcTravel("metro", 100, 0)).toBeLessThan(calcTravel("car", 100, 0));
  });

  test("bus has lower factor than car", () => {
    expect(calcTravel("bus", 100, 0)).toBeLessThan(calcTravel("car", 100, 0));
  });

  test("flight hours add emission (4 hrs ≈ 20.25 kg)", () => {
    const flight = calcTravel("cycle", 0, 4);
    expect(flight).toBeCloseTo((4 * 22) / WEEKS_PER_MONTH, 3);
  });

  test("commute and flight emissions sum independently", () => {
    const commute  = calcTravel("car", 100, 0);
    const flight   = calcTravel("cycle", 0, 2);
    const combined = calcTravel("car", 100, 2);
    expect(combined).toBeCloseTo(commute + flight, 5);
  });

  test("unknown transport mode defaults to zero emission (safety guard)", () => {
    expect(calcTravel("hovercraft", 100, 0)).toBe(0);
  });

  test("motorbike factor is between cycle and car", () => {
    expect(calcTravel("motorbike", 100, 0)).toBeGreaterThan(calcTravel("cycle", 100, 0));
    expect(calcTravel("motorbike", 100, 0)).toBeLessThan(calcTravel("car", 100, 0));
  });
});

// ── calcFood ──────────────────────────────────────────────────────────────────
describe("calcFood – diet emissions", () => {
  test("meat diet is higher than plant diet", () => {
    expect(calcFood("meat", 0)).toBeGreaterThan(calcFood("plant", 0));
  });

  test("low-carbon meals reduce food emission", () => {
    expect(calcFood("meat", 10)).toBeLessThan(calcFood("meat", 0));
  });

  test("emission never drops below floor of 4 kg", () => {
    expect(calcFood("plant", 21)).toBeGreaterThanOrEqual(FOOD_EMISSION_FLOOR);
    expect(calcFood("meat",  999)).toBeGreaterThanOrEqual(FOOD_EMISSION_FLOOR);
  });

  test("mixed diet with 6 meals ≈ 22.3 kg", () => {
    // 25 - 6 * 0.45 = 22.3
    expect(calcFood("mixed", 6)).toBeCloseTo(22.3, 2);
  });

  test("unknown diet key falls back to mixed (security guard)", () => {
    expect(calcFood("vegan_keto", 0)).toBeCloseTo(calcFood("mixed", 0), 5);
  });

  test("vegetarian is lower than mixed but higher than plant", () => {
    expect(calcFood("vegetarian", 0)).toBeLessThan(calcFood("mixed", 0));
    expect(calcFood("vegetarian", 0)).toBeGreaterThan(calcFood("plant", 0));
  });
});

// ── calcStuff ─────────────────────────────────────────────────────────────────
describe("calcStuff – deliveries and waste emissions", () => {
  test("zero inputs → zero emission", () => {
    expect(calcStuff(0, 0, 0)).toBe(0);
  });

  test("recycling reduces waste emission", () => {
    expect(calcStuff(0, 5, 0.8)).toBeLessThan(calcStuff(0, 5, 0));
  });

  test("recycling fraction of 1 still leaves some waste emission (factor 0.58)", () => {
    expect(calcStuff(0, 5, 1)).toBeGreaterThan(0);
  });

  test("typical values produce expected result", () => {
    const expected = (5 * FACTORS.deliveryWeekly) / WEEKS_PER_MONTH +
                     3 * FACTORS.wasteBag * (1 - 0.35 * 0.58);
    expect(calcStuff(5, 3, 0.35)).toBeCloseTo(expected, 4);
  });

  test("more deliveries increase emission linearly", () => {
    expect(calcStuff(10, 0, 0)).toBeCloseTo(calcStuff(5, 0, 0) * 2, 5);
  });

  test("more waste bags increase emission", () => {
    expect(calcStuff(0, 5, 0)).toBeGreaterThan(calcStuff(0, 2, 0));
  });
});

// ── getIntensity ──────────────────────────────────────────────────────────────
describe("getIntensity – classification", () => {
  test("very low footprint → 'low'",                   () => { expect(getIntensity(1, "balanced")).toBe("low"); });
  test("footprint at 75 % of target → 'low'",          () => { expect(getIntensity(45 * 0.75, "balanced")).toBe("low"); });
  test("footprint at exactly target → 'steady'",       () => { expect(getIntensity(45, "balanced")).toBe("steady"); });
  test("footprint between target and 1.35× → 'high'",  () => { expect(getIntensity(50, "balanced")).toBe("high"); });
  test("footprint above 1.35× target → 'urgent'",      () => { expect(getIntensity(70, "balanced")).toBe("urgent"); });

  test("bold goal shifts threshold lower (48 kg is urgent on bold, high on balanced)", () => {
    // target = 45 * 0.78 = 35.1; urgent > 35.1 * 1.35 = 47.385
    expect(getIntensity(48, "bold")).toBe("urgent");
    expect(getIntensity(48, "balanced")).toBe("high");
  });

  test("starter goal shifts threshold higher (50 kg is steady on starter, high on balanced)", () => {
    // target = 45 * 1.2 = 54
    expect(getIntensity(50, "starter")).toBe("steady");
    expect(getIntensity(50, "balanced")).toBe("high");
  });

  test("unknown goal falls back gracefully (does not throw)", () => {
    expect(() => getIntensity(50, "unknown")).not.toThrow();
  });

  test("zero emission is always 'low'", () => {
    expect(getIntensity(0, "bold")).toBe("low");
  });
});

// ── scoreAction ───────────────────────────────────────────────────────────────
describe("scoreAction – recommendation scoring", () => {
  const mockState = Object.freeze({
    topCategory:   "travel",
    flightHours:   2,
    renewable:     0.1,
    transportMode: "car",
  });

  const travelAction = Object.freeze({ id: "ac-transit",    category: "travel", saving: 7.2, effort: "Medium" });
  const flightAction = Object.freeze({ id: "ac-flight",     category: "travel", saving: 18,  effort: "High"   });
  const homeAction   = Object.freeze({ id: "ac-thermostat", category: "home",   saving: 5.4, effort: "Low"    });
  const renewableAct = Object.freeze({ id: "ac-renewable",  category: "home",   saving: 8.6, effort: "Medium" });

  test("action in top category gets +9 bonus", () => {
    const withBonus  = scoreAction(travelAction, mockState);
    expect(withBonus).toBe(7.2 + 9 + 2); // saving + category + medium
  });

  test("flight action penalised when flight hours are zero", () => {
    const zeroFlightState = { ...mockState, flightHours: 0 };
    // 18 (saving) + 9 (top category) + 0 (High effort) - 16 (penalty) = 11
    expect(scoreAction(flightAction, zeroFlightState)).toBe(11);
  });

  test("no flight penalty when hours > 0", () => {
    const score = scoreAction(flightAction, mockState);
    expect(score).toBeGreaterThan(18);
  });

  test("low-effort actions get +4 bonus", () => {
    // 5.4 + 4 (low effort) = 9.4  (home is not top category)
    expect(scoreAction(homeAction, mockState)).toBeCloseTo(9.4, 1);
  });

  test("cycle transport penalises transit action by -12", () => {
    const cycleState    = { ...mockState, transportMode: "cycle" };
    const withPenalty   = scoreAction(travelAction, cycleState);
    const withoutPenalty = scoreAction(travelAction, mockState);
    expect(withPenalty).toBe(withoutPenalty - 12);
  });

  test("renewable action penalised when renewable > 65 %", () => {
    const highRenewState = { ...mockState, renewable: 0.8, topCategory: "home" };
    const penalised      = scoreAction(renewableAct, highRenewState);
    const normal         = scoreAction(renewableAct, { ...mockState, topCategory: "home" });
    expect(penalised).toBe(normal - 8);
  });

  test("returns action saving when no state provided", () => {
    expect(scoreAction(homeAction, null)).toBe(homeAction.saving);
  });
});

// ── Integration ───────────────────────────────────────────────────────────────
describe("Integration – full weekly footprint calculation", () => {
  function fullCalculate({
    household      = 3,
    electricity    = 58,
    renewable      = 0.1,
    transportMode  = "car",
    commuteKm      = 85,
    flightHours    = 0,
    diet           = "mixed",
    lowCarbonMeals = 6,
    deliveries     = 5,
    wasteBags      = 3,
    recycling      = 0.35,
    goal           = "balanced",
  } = {}) {
    const safeTransport = allowlisted(transportMode, VALID_TRANSPORT_MODES, "car");
    const safeDiet      = allowlisted(diet,          VALID_DIETS,           "mixed");
    const safeGoal      = allowlisted(goal,          VALID_GOALS,           "balanced");

    const home   = calcHome(electricity, renewable, household);
    const travel = calcTravel(safeTransport, commuteKm, flightHours);
    const food   = calcFood(safeDiet, lowCarbonMeals);
    const stuff  = calcStuff(deliveries, wasteBags, recycling);
    const total  = home + travel + food + stuff;
    const categories  = { home, travel, food, stuff };
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0];
    const intensity   = getIntensity(total, safeGoal);
    return { home, travel, food, stuff, total, topCategory, intensity };
  }

  test("default inputs produce a positive, finite total", () => {
    const { total } = fullCalculate();
    expect(total).toBeGreaterThan(0);
    expect(Number.isFinite(total)).toBe(true);
  });

  test("switching to cycle reduces travel emission to zero", () => {
    const car   = fullCalculate({ transportMode: "car",   commuteKm: 100 });
    const cycle = fullCalculate({ transportMode: "cycle", commuteKm: 100 });
    expect(cycle.travel).toBe(0);
    expect(cycle.total).toBeLessThan(car.total);
  });

  test("100 % renewable cuts home emission to zero", () => {
    const { home } = fullCalculate({ renewable: 1 });
    expect(home).toBe(0);
  });

  test("plant-based diet + max low-carbon meals reaches the floor", () => {
    const { food } = fullCalculate({ diet: "plant", lowCarbonMeals: 21 });
    expect(food).toBe(FOOD_EMISSION_FLOOR);
  });

  test("adding flights increases travel and total", () => {
    const ground  = fullCalculate({ flightHours: 0 });
    const flying  = fullCalculate({ flightHours: 4 });
    expect(flying.travel).toBeGreaterThan(ground.travel);
    expect(flying.total).toBeGreaterThan(ground.total);
  });

  test("largest emission category becomes topCategory", () => {
    const { topCategory } = fullCalculate({
      flightHours: 10, transportMode: "car", commuteKm: 200,
      electricity: 5,  diet: "plant",        wasteBags: 0,
    });
    expect(topCategory).toBe("travel");
  });

  test("all-zero inputs (except household) give a safe non-NaN result", () => {
    const { total } = fullCalculate({
      electricity: 0, commuteKm: 0, flightHours: 0,
      lowCarbonMeals: 0, deliveries: 0, wasteBags: 0,
    });
    expect(Number.isFinite(total)).toBe(true);
  });

  test("injected transport mode is rejected and falls back to car", () => {
    const hacked  = fullCalculate({ transportMode: "<script>alert(1)</script>" });
    const normal  = fullCalculate({ transportMode: "car" });
    expect(hacked.travel).toBeCloseTo(normal.travel, 5);
  });

  test("injected diet value is rejected and falls back to mixed", () => {
    const hacked = fullCalculate({ diet: "'; DROP TABLE users;--" });
    const normal = fullCalculate({ diet: "mixed" });
    expect(hacked.food).toBeCloseTo(normal.food, 5);
  });

  test("large household reduces per-person home emission", () => {
    const small = fullCalculate({ household: 1 });
    const large = fullCalculate({ household: 6 });
    expect(large.home).toBeLessThan(small.home);
  });
});

// ── History helpers ───────────────────────────────────────────────────────────
describe("History – persistence helpers", () => {
  function createHistoryEntry(total, topLabel) {
    const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { date, total, top: topLabel };
  }

  function computeTrend(history) {
    if (history.length < 2) { return null; }
    return history[history.length - 1].total - history[history.length - 2].total;
  }

  test("history entry has date, total, and top fields", () => {
    const entry = createHistoryEntry(42.5, "Travel");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("total", 42.5);
    expect(entry).toHaveProperty("top",   "Travel");
  });

  test("trend is positive when last week is higher", () => {
    const history = [createHistoryEntry(40, "Travel"), createHistoryEntry(55, "Home")];
    expect(computeTrend(history)).toBeGreaterThan(0);
  });

  test("trend is negative when last week is lower", () => {
    const history = [createHistoryEntry(55, "Home"), createHistoryEntry(40, "Travel")];
    expect(computeTrend(history)).toBeLessThan(0);
  });

  test("trend is zero when weeks are equal", () => {
    const history = [createHistoryEntry(42, "Food"), createHistoryEntry(42, "Food")];
    expect(computeTrend(history)).toBe(0);
  });

  test("single entry returns null trend (no previous week)", () => {
    expect(computeTrend([createHistoryEntry(42, "Food")])).toBeNull();
  });

  test("empty history returns null trend", () => {
    expect(computeTrend([])).toBeNull();
  });

  test("history is capped at HISTORY_MAX_WEEKS (12) entries", () => {
    const HISTORY_MAX_WEEKS = 12;
    const history = Array.from({ length: 15 }, (_, i) => createHistoryEntry(30 + i, "Home"));
    const capped  = history.slice(-HISTORY_MAX_WEEKS);
    expect(capped).toHaveLength(HISTORY_MAX_WEEKS);
  });

  test("serialise and deserialise round-trip preserves data", () => {
    const entry  = createHistoryEntry(38.2, "Food");
    const json   = JSON.stringify([entry]);
    const parsed = JSON.parse(json);
    expect(parsed[0].total).toBe(38.2);
    expect(parsed[0].top).toBe("Food");
  });

  test("sanitizeText guards tampered localStorage history entries", () => {
    const malicious = { date: "<script>alert(1)</script>", total: 50, top: "<img src=x>" };
    const safeDate  = sanitizeText(String(malicious.date));
    const safeTop   = sanitizeText(String(malicious.top));
    expect(safeDate).not.toContain("<");
    expect(safeTop).not.toContain("<");
  });
});

// ── Storage helpers ───────────────────────────────────────────────────────────
describe("Storage – localStorage wrappers", () => {
  let store = {};
  const mockLocalStorage = {
    getItem:    (key)        => key in store ? store[key] : null,
    setItem:    (key, value) => { store[key] = value.toString(); },
    removeItem: (key)        => { delete store[key]; },
    clear:      ()           => { store = {}; },
  };

  beforeEach(() => {
    store = {};
    global.localStorage = mockLocalStorage;
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  function storageSave(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (err) { console.warn("[CarbonCompass] localStorage write failed:", err); }
  }

  function storageLoad(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn("[CarbonCompass] localStorage read failed:", err);
      return fallback;
    }
  }

  test("storageSave serialises and stores value", () => {
    storageSave("testKey", { a: 1 });
    expect(store["testKey"]).toBe('{"a":1}');
  });

  test("storageLoad parses stored JSON", () => {
    store["testKey"] = '{"b":2}';
    expect(storageLoad("testKey", null)).toEqual({ b: 2 });
  });

  test("storageLoad returns fallback if key is missing", () => {
    expect(storageLoad("missing", "default")).toBe("default");
  });

  test("storageLoad returns fallback and warns on invalid JSON", () => {
    store["badKey"] = "not-valid-json";
    expect(storageLoad("badKey", "fallback")).toBe("fallback");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("localStorage read failed"),
      expect.any(Error)
    );
  });

  test("storageSave catches error for circular references", () => {
    const circular = {};
    circular.self  = circular;
    storageSave("circularKey", circular);
    expect(store["circularKey"]).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("localStorage write failed"),
      expect.any(TypeError)
    );
  });

  test("storageSave and storageLoad round-trip an array", () => {
    storageSave("arr", [1, 2, 3]);
    expect(storageLoad("arr", [])).toEqual([1, 2, 3]);
  });

  test("storageLoad returns fallback when localStorage throws on getItem", () => {
    const broken = { ...mockLocalStorage, getItem: () => { throw new Error("quota"); } };
    global.localStorage = broken;
    expect(storageLoad("x", "safe")).toBe("safe");
  });
});
