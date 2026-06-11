(function () {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────────────────────

  /**
   * Allowlisted transport mode keys – used to validate user-supplied select values.
   * @type {ReadonlyArray<string>}
   */
  const VALID_TRANSPORT_MODES = Object.freeze(["car", "motorbike", "bus", "metro", "cycle"]);

  /**
   * Allowlisted diet keys – used to validate user-supplied select values.
   * @type {ReadonlyArray<string>}
   */
  const VALID_DIETS = Object.freeze(["meat", "mixed", "vegetarian", "plant"]);

  /**
   * Allowlisted goal keys – used to validate user-supplied select values.
   * @type {ReadonlyArray<string>}
   */
  const VALID_GOALS = Object.freeze(["starter", "balanced", "bold"]);

  /**
   * Emission factors used throughout all calculations.
   * All values are in kg CO₂e per unit unless noted.
   * @type {Readonly<object>}
   */
  const FACTORS = Object.freeze({
    /** kg CO₂e per kWh of grid electricity */
    electricity: 0.72,
    /** kg CO₂e per km by transport mode */
    transport: Object.freeze({
      car: 0.18,
      motorbike: 0.1,
      bus: 0.075,
      metro: 0.035,
      cycle: 0
    }),
    /** kg CO₂e per flight hour, annualised to a weekly figure */
    flightsPerHourWeekly: 22,
    /** Baseline weekly food emissions in kg CO₂e by diet pattern */
    dietWeekly: Object.freeze({
      meat: 36,
      mixed: 25,
      vegetarian: 17,
      plant: 11
    }),
    /** kg CO₂e saved per low-carbon meal substitution */
    lowCarbonMealSaving: 0.45,
    /** kg CO₂e per online delivery, monthly → weekly via ÷ 4.345 */
    deliveryWeekly: 0.65,
    /** kg CO₂e per general waste bag */
    wasteBag: 1.8
  });

  /**
   * Weeks per month divisor (365 / 12 / 7 ≈ 4.345).
   * @type {number}
   */
  const WEEKS_PER_MONTH = 4.345;

  /**
   * Minimum food emission floor, in kg CO₂e per week.
   * @type {number}
   */
  const FOOD_EMISSION_FLOOR = 4;

  /**
   * Multiplier applied to the base target (45 kg/week) for each goal level.
   * @type {Readonly<Record<string, number>>}
   */
  const GOAL_MULTIPLIERS = Object.freeze({ starter: 1.2, balanced: 1, bold: 0.78 });

  /**
   * Reference weekly footprint target before goal adjustment (kg CO₂e).
   * @type {number}
   */
  const BASE_TARGET_KG = 45;

  /**
   * Maximum number of saved history weeks to retain.
   * @type {number}
   */
  const HISTORY_MAX_WEEKS = 12;

  /**
   * Category display metadata: label, colour, and compass angle.
   * @type {Readonly<Record<string, {label: string, color: string, angle: number}>>}
   */
  const CATEGORY_META = Object.freeze({
    home:   Object.freeze({ label: "Home",   color: "#f4c842", angle: 0   }),
    travel: Object.freeze({ label: "Travel", color: "#4fb8d4", angle: 90  }),
    food:   Object.freeze({ label: "Food",   color: "#5cba8a", angle: 180 }),
    stuff:  Object.freeze({ label: "Stuff",  color: "#c47c50", angle: 270 })
  });

  /**
   * Recommended action definitions.
   * @type {ReadonlyArray<Readonly<object>>}
   */
  const ACTIONS = Object.freeze([
    Object.freeze({
      id: "ac-thermostat",
      category: "home",
      title: "Shift heavy appliance use",
      copy: "Run laundry, charging, and water heating in one planned block and avoid standby power overnight.",
      saving: 5.4,
      effort: "Low",
      match: Object.freeze(["electricity"])
    }),
    Object.freeze({
      id: "ac-led",
      category: "home",
      title: "Replace the busiest bulbs",
      copy: "Start with the three lights used most often before changing the entire house.",
      saving: 3.1,
      effort: "Low",
      match: Object.freeze(["electricity"])
    }),
    Object.freeze({
      id: "ac-renewable",
      category: "home",
      title: "Move one bill toward clean power",
      copy: "Choose a green tariff, rooftop solar step, or shared renewable option when available.",
      saving: 8.6,
      effort: "Medium",
      match: Object.freeze(["electricity"])
    }),
    Object.freeze({
      id: "ac-transit",
      category: "travel",
      title: "Swap two commute days",
      copy: "Use metro, bus, carpool, walk, or cycle for two regular trips each week.",
      saving: 7.2,
      effort: "Medium",
      match: Object.freeze(["commute"])
    }),
    Object.freeze({
      id: "ac-tripchain",
      category: "travel",
      title: "Chain errands into one loop",
      copy: "Combine short trips into one route and avoid repeat starts for small purchases.",
      saving: 4.8,
      effort: "Low",
      match: Object.freeze(["commute"])
    }),
    Object.freeze({
      id: "ac-flight",
      category: "travel",
      title: "Replace one short flight segment",
      copy: "For nearby routes, compare rail or video call alternatives before booking.",
      saving: 18,
      effort: "High",
      match: Object.freeze(["flight"])
    }),
    Object.freeze({
      id: "ac-meals",
      category: "food",
      title: "Make three meals plant-forward",
      copy: "Pick repeatable meals you already like and anchor them to fixed days.",
      saving: 4.2,
      effort: "Low",
      match: Object.freeze(["diet"])
    }),
    Object.freeze({
      id: "ac-foodwaste",
      category: "food",
      title: "Cook from a two-day shelf",
      copy: "Keep a visible use-first area for leftovers and ingredients close to expiry.",
      saving: 3.6,
      effort: "Low",
      match: Object.freeze(["waste"])
    }),
    Object.freeze({
      id: "ac-local",
      category: "food",
      title: "Choose seasonal staples",
      copy: "Build weekly meals around produce that is local, seasonal, and minimally packaged.",
      saving: 2.7,
      effort: "Medium",
      match: Object.freeze(["diet", "deliveries"])
    }),
    Object.freeze({
      id: "ac-cart",
      category: "stuff",
      title: "Hold a 48-hour cart",
      copy: "Delay non-urgent purchases and batch the ones that still matter after two days.",
      saving: 5,
      effort: "Low",
      match: Object.freeze(["deliveries"])
    }),
    Object.freeze({
      id: "ac-repair",
      category: "stuff",
      title: "Repair before replacing",
      copy: "Create a small fix list for clothes, electronics, bags, or appliances.",
      saving: 6.5,
      effort: "Medium",
      match: Object.freeze(["deliveries"])
    }),
    Object.freeze({
      id: "ac-reuse",
      category: "stuff",
      title: "Build a reuse station",
      copy: "Place bags, bottles, containers, and return parcels in one exit-ready spot.",
      saving: 2.5,
      effort: "Low",
      match: Object.freeze(["waste", "deliveries"])
    })
  ]);

  /**
   * Set of allowlisted action IDs for fast O(1) lookup.
   * @type {ReadonlySet<string>}
   */
  const VALID_ACTION_IDS = Object.freeze(new Set(ACTIONS.map(function (a) { return a.id; })));

  /**
   * Demo scenarios that can be loaded into the form.
   * @type {ReadonlyArray<Readonly<object>>}
   */
  const SCENARIOS = Object.freeze([
    Object.freeze({
      label: "Transit week loaded",
      values: Object.freeze({ transportMode: "metro", commuteKm: 62, flightHours: 0, deliveries: 3, lowCarbonMeals: 9 })
    }),
    Object.freeze({
      label: "High-travel week loaded",
      values: Object.freeze({ transportMode: "car", commuteKm: 210, flightHours: 4, deliveries: 8, lowCarbonMeals: 4 })
    }),
    Object.freeze({
      label: "Clean-home week loaded",
      values: Object.freeze({ electricity: 42, renewable: 65, recycling: 70, wasteBags: 1, diet: "vegetarian" })
    })
  ]);

  // ─── Utility helpers ─────────────────────────────────────────────────────────

  /**
   * Sanitize a string before inserting into an HTML context.
   * Prevents stored-XSS by escaping all HTML special characters.
   *
   * @param {string} input - Raw value to sanitize.
   * @returns {string} HTML-safe string, or empty string for non-string input.
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
   * Safely coerce a value to a finite number; returns 0 for non-finite results.
   *
   * @param {string|number} value - Value to parse.
   * @returns {number} Parsed finite number, or 0.
   */
  function safeParseNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Clamp a numeric value between inclusive lower and upper bounds.
   *
   * @param {number} value - Value to clamp.
   * @param {number} min   - Inclusive lower bound.
   * @param {number} max   - Inclusive upper bound.
   * @returns {number} Clamped value.
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Validate that a string value is in an allowlist.
   * Returns the value if allowed, or the fallback otherwise.
   *
   * @param {string}               value    - Candidate value.
   * @param {ReadonlyArray<string>} allowed  - Permitted values.
   * @param {string}               fallback - Value returned when candidate is not permitted.
   * @returns {string} Validated value.
   */
  function allowlisted(value, allowed, fallback) {
    return allowed.indexOf(value) !== -1 ? value : fallback;
  }

  // ─── Storage helpers ─────────────────────────────────────────────────────────

  /**
   * Persist a serialisable value to localStorage.
   * Swallows storage errors gracefully (e.g., private-browsing or quota exceeded).
   *
   * @param {string} key   - localStorage key.
   * @param {*}      value - Value to serialise and store.
   * @returns {void}
   */
  function storageSave(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("[CarbonCompass] localStorage write failed:", err);
    }
  }

  /**
   * Load and deserialise a value from localStorage.
   * Returns the fallback on missing key, parse errors, or storage exceptions.
   *
   * @param {string} key      - localStorage key.
   * @param {*}      fallback - Value returned when the key is absent or unreadable.
   * @returns {*} Parsed value or fallback.
   */
  function storageLoad(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn("[CarbonCompass] localStorage read failed:", err);
      return fallback;
    }
  }

  // ─── DOM element cache ───────────────────────────────────────────────────────

  /**
   * Cached references to frequently accessed DOM elements.
   * Queried once at startup to avoid repeated DOM traversals.
   * @type {Record<string, Element|null>}
   */
  var els = {
    form:           document.querySelector("#footprintForm"),
    weeklyScore:    document.querySelector("#weeklyScore"),
    score:          document.querySelector(".score"),
    renewable:      document.querySelector("#renewable"),
    renewableValue: document.querySelector("#renewableValue"),
    lowCarbonMeals: document.querySelector("#lowCarbonMeals"),
    mealValue:      document.querySelector("#mealValue"),
    recycling:      document.querySelector("#recycling"),
    recyclingValue: document.querySelector("#recyclingValue"),
    breakdown:      document.querySelector("#breakdown"),
    needle:         document.querySelector("#needle"),
    compassTitle:   document.querySelector("#compassTitle"),
    compassText:    document.querySelector("#compassText"),
    primaryInsight: document.querySelector("#primaryInsight"),
    actionGrid:     document.querySelector("#actionGrid"),
    plannedSavings: document.querySelector("#plannedSavings"),
    nextBestTitle:  document.querySelector("#nextBestTitle"),
    nextBestText:   document.querySelector("#nextBestText"),
    saveWeek:       document.querySelector("#saveWeek"),
    clearLog:       document.querySelector("#clearLog"),
    historyList:    document.querySelector("#historyList"),
    historyChart:   document.querySelector("#historyChart"),
    trendLabel:     document.querySelector("#trendLabel"),
    pulseMeter:     document.querySelector(".pulse-meter"),
    impactTitle:    document.querySelector("#impactTitle"),
    impactText:     document.querySelector("#impactText"),
    liveChallenge:  document.querySelector("#liveChallenge"),
    demoScenario:   document.querySelector("#demoScenario"),
    nudgeChat:      document.querySelector("#nudgeChat"),
    spinChallenge:  document.querySelector("#spinChallenge"),
    autoPlan:       document.querySelector("#autoPlan"),
    challengeTitle: document.querySelector("#challengeTitle"),
    challengeCopy:  document.querySelector("#challengeCopy"),
    chatMessages:   document.querySelector("#chatMessages"),
    chatForm:       document.querySelector("#chatForm"),
    chatInput:      document.querySelector("#chatInput"),
    chatLauncher:   document.querySelector("#chatLauncher")
  };

  // ─── Application state ───────────────────────────────────────────────────────

  /**
   * Mutable application state.
   * @type {{current: object|null, filter: string, planned: Set<string>, history: Array<object>, scenarioIndex: number, challengeIndex: number, lastScore: number|null}}
   */
  var state = {
    current:        null,
    filter:         "all",
    planned:        new Set(storageLoad("carbonCompassPlanned", [])),
    history:        storageLoad("carbonCompassHistory", []),
    scenarioIndex:  0,
    challengeIndex: 0,
    lastScore:      null
  };

  // ─── Emission calculations ───────────────────────────────────────────────────

  /**
   * Read a numeric form input by element ID and clamp it to valid bounds.
   *
   * @param {string} id  - Element ID to query.
   * @param {number} min - Minimum accepted value (default: -Infinity).
   * @param {number} max - Maximum accepted value (default: Infinity).
   * @returns {number} Clamped numeric value, or 0 if the element is absent.
   */
  function readNumber(id, min, max) {
    var lo = (min === undefined) ? -Infinity : min;
    var hi = (max === undefined) ?  Infinity : max;
    var el = document.querySelector("#" + id);
    if (!el) { return 0; }
    return clamp(safeParseNumber(el.value), lo, hi);
  }

  /**
   * Read and validate a <select> element value against an allowlist.
   * Falls back to the provided default when the element is absent or the
   * selected value is not in the allowlist (guards against DOM manipulation).
   *
   * @param {string}               id        - Element ID to query.
   * @param {ReadonlyArray<string>} allowed   - Permitted option values.
   * @param {string}               fallback  - Value returned when validation fails.
   * @returns {string} Validated select value.
   */
  function readSelect(id, allowed, fallback) {
    var el = document.querySelector("#" + id);
    if (!el) { return fallback; }
    return allowlisted(el.value, allowed, fallback);
  }

  /**
   * Compute weekly home-energy emission for a single household member's share.
   *
   * Formula: (kWh × factor × (1 − renewableFraction)) ÷ householdSize
   *
   * @param {number} electricityKWh     - Weekly electricity consumption in kWh.
   * @param {number} renewableFraction  - Share of electricity from renewables (0–1).
   * @param {number} household          - Number of people sharing the bill (≥ 1).
   * @returns {number} Weekly home emission in kg CO₂e.
   */
  function calcHome(electricityKWh, renewableFraction, household) {
    var hh = Math.max(household, 1);
    return (electricityKWh * FACTORS.electricity * (1 - renewableFraction)) / hh;
  }

  /**
   * Compute weekly travel emission from commuting and flights combined.
   *
   * @param {string} mode        - Transport mode key (must be in VALID_TRANSPORT_MODES).
   * @param {number} commuteKm   - Weekly commute distance in km.
   * @param {number} flightHours - Monthly flight hours.
   * @returns {number} Weekly travel emission in kg CO₂e.
   */
  function calcTravel(mode, commuteKm, flightHours) {
    var modeFactor = FACTORS.transport[mode] !== undefined ? FACTORS.transport[mode] : 0;
    var commute    = commuteKm * modeFactor;
    var flight     = (flightHours * FACTORS.flightsPerHourWeekly) / WEEKS_PER_MONTH;
    return commute + flight;
  }

  /**
   * Compute weekly food emission, applying a floor to prevent negative values.
   *
   * @param {string} diet          - Diet pattern key (must be in VALID_DIETS).
   * @param {number} lowCarbonMeals - Number of low-carbon meal substitutions per week.
   * @returns {number} Weekly food emission in kg CO₂e (minimum FOOD_EMISSION_FLOOR).
   */
  function calcFood(diet, lowCarbonMeals) {
    var base    = FACTORS.dietWeekly[diet] !== undefined ? FACTORS.dietWeekly[diet] : FACTORS.dietWeekly.mixed;
    var reduced = base - lowCarbonMeals * FACTORS.lowCarbonMealSaving;
    return Math.max(reduced, FOOD_EMISSION_FLOOR);
  }

  /**
   * Compute weekly stuff-and-waste emission from deliveries and general waste.
   *
   * @param {number} deliveries       - Monthly online deliveries count.
   * @param {number} wasteBags        - Weekly general waste bag count.
   * @param {number} recyclingFraction - Share of waste recycled or reused (0–1).
   * @returns {number} Weekly stuff emission in kg CO₂e.
   */
  function calcStuff(deliveries, wasteBags, recyclingFraction) {
    var deliveryEmission = (deliveries * FACTORS.deliveryWeekly) / WEEKS_PER_MONTH;
    var wasteEmission    = wasteBags * FACTORS.wasteBag * (1 - recyclingFraction * 0.58);
    return deliveryEmission + wasteEmission;
  }

  /**
   * Classify a total weekly emission into an intensity level relative to the
   * user's chosen goal.
   *
   * @param {number} total - Total weekly emission in kg CO₂e.
   * @param {string} goal  - Goal key (starter | balanced | bold).
   * @returns {'low'|'steady'|'high'|'urgent'} Intensity classification.
   */
  function getIntensity(total, goal) {
    var multiplier = GOAL_MULTIPLIERS[goal] !== undefined ? GOAL_MULTIPLIERS[goal] : 1;
    var target     = BASE_TARGET_KG * multiplier;
    if (total <= target * 0.75)  { return "low"; }
    if (total <= target)          { return "steady"; }
    if (total <= target * 1.35)  { return "high"; }
    return "urgent";
  }

  /**
   * Read all form inputs, compute per-category emissions, and update state.current.
   * All select values are validated against allowlists before use.
   *
   * @returns {void}
   */
  function calculate() {
    var household     = readNumber("household",     1, 12);
    var electricity   = readNumber("electricity",   0, 500);
    var renewable     = readNumber("renewable",     0, 100) / 100;
    var transportMode = readSelect("transportMode", VALID_TRANSPORT_MODES, "car");
    var commuteKm     = readNumber("commuteKm",     0, 1000);
    var flightHours   = readNumber("flightHours",   0, 80);
    var diet          = readSelect("diet",          VALID_DIETS,           "mixed");
    var lowCarbonMeals = readNumber("lowCarbonMeals", 0, 21);
    var deliveries    = readNumber("deliveries",    0, 80);
    var wasteBags     = readNumber("wasteBags",     0, 20);
    var recycling     = readNumber("recycling",     0, 100) / 100;
    var goal          = readSelect("goal",          VALID_GOALS,           "balanced");

    var home   = calcHome(electricity, renewable, household);
    var travel = calcTravel(transportMode, commuteKm, flightHours);
    var food   = calcFood(diet, lowCarbonMeals);
    var stuff  = calcStuff(deliveries, wasteBags, recycling);

    var categories = { home: home, travel: travel, food: food, stuff: stuff };
    var total      = Object.values(categories).reduce(function (sum, v) { return sum + v; }, 0);
    var topCategory = Object.entries(categories).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var intensity  = getIntensity(total, goal);

    state.current = {
      household:      household,
      electricity:    electricity,
      renewable:      renewable,
      transportMode:  transportMode,
      commuteKm:      commuteKm,
      flightHours:    flightHours,
      diet:           diet,
      lowCarbonMeals: lowCarbonMeals,
      deliveries:     deliveries,
      wasteBags:      wasteBags,
      recycling:      recycling,
      goal:           goal,
      categories:     categories,
      total:          total,
      topCategory:    topCategory,
      intensity:      intensity
    };

    render();
  }

  // ─── Rendering helpers ───────────────────────────────────────────────────────

  /**
   * Synchronise all range-slider output labels and aria-valuetext attributes
   * with their current values so screen readers announce the correct state.
   *
   * @returns {void}
   */
  function renderRangeLabels() {
    var renewableEl  = els.renewable;
    var mealsEl      = els.lowCarbonMeals;
    var recyclingEl  = els.recycling;
    var renewableVal = readNumber("renewable");
    var mealsVal     = readNumber("lowCarbonMeals");
    var recyclingVal = readNumber("recycling");

    els.renewableValue.textContent = renewableVal + "%";
    els.mealValue.textContent      = String(mealsVal);
    els.recyclingValue.textContent = recyclingVal + "%";

    if (renewableEl)  { renewableEl.setAttribute("aria-valuetext",  renewableVal + "%"); }
    if (mealsEl)      { mealsEl.setAttribute("aria-valuetext",      mealsVal + " meals"); }
    if (recyclingEl)  { recyclingEl.setAttribute("aria-valuetext",  recyclingVal + "%"); }
  }

  /**
   * Update the weekly score display and trigger the bump animation when the
   * value changes from one render cycle to the next.
   *
   * @returns {void}
   */
  function renderScore() {
    var rounded = Math.round(state.current.total);
    els.weeklyScore.textContent = String(rounded);
    if (state.lastScore !== null && state.lastScore !== rounded) {
      els.score.classList.remove("bump");
      window.requestAnimationFrame(function () { els.score.classList.add("bump"); });
    }
    state.lastScore = rounded;
  }

  /**
   * Update the live impact-pulse section (meter fill, title, body text, and
   * the live challenge chip) based on the current intensity and top category.
   *
   * @returns {void}
   */
  function renderImpact() {
    var total     = state.current.total;
    var intensity = state.current.intensity;
    var top       = CATEGORY_META[state.current.topCategory].label;
    var percent   = Math.max(12, Math.min((total / 85) * 100, 100));

    els.pulseMeter.style.setProperty("--pulse", percent + "%");

    var titles = {
      low:    "Clean signal",
      steady: "Balanced signal",
      high:   "Action signal",
      urgent: "Hotspot signal"
    };
    var texts = {
      low:    "Your weekly route is already lean. Keep the habits that made it work.",
      steady: "One focused action can make the next saved week visibly lower.",
      high:   top + " is pulling the score upward. Start there for the fastest movement.",
      urgent: top + " is a clear hotspot. Pick a high-saving action and save the week after trying it."
    };

    els.impactTitle.textContent  = titles[intensity];
    els.impactText.textContent   = texts[intensity];
    els.liveChallenge.textContent =
      top + " leads by " + state.current.categories[state.current.topCategory].toFixed(1) + " kg this week";
  }

  /**
   * Render the per-category emission breakdown bar chart using safe DOM
   * construction (textContent for data, setAttribute for inline styles).
   *
   * @returns {void}
   */
  function renderBreakdown() {
    var max      = Math.max.apply(Math, Object.values(state.current.categories).concat([1]));
    var fragment = document.createDocumentFragment();

    Object.entries(state.current.categories).forEach(function (entry) {
      var key   = entry[0];
      var value = entry[1];
      var meta  = CATEGORY_META[key];
      var width = Math.max((value / max) * 100, 4);

      var row   = document.createElement("div");
      row.className = "breakdown-row";

      var labelEl = document.createElement("span");
      labelEl.textContent = meta.label;

      var track = document.createElement("div");
      track.className = "bar-track";

      var fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.setProperty("--bar-color", meta.color);
      fill.style.width = width.toFixed(2) + "%";

      var valueEl = document.createElement("strong");
      valueEl.textContent = value.toFixed(1) + " kg";

      track.appendChild(fill);
      row.appendChild(labelEl);
      row.appendChild(track);
      row.appendChild(valueEl);
      fragment.appendChild(row);
    });

    els.breakdown.innerHTML = "";
    els.breakdown.appendChild(fragment);
  }

  /**
   * Rotate the compass needle to point at the top emission category and
   * update the caption text.
   *
   * @returns {void}
   */
  function renderCompass() {
    var topCategory = state.current.topCategory;
    var meta        = CATEGORY_META[topCategory];
    els.needle.style.transform = "rotate(" + meta.angle + "deg)";
    els.compassTitle.textContent = meta.label + " is your current north";
    els.compassText.textContent  =
      meta.label + " contributes " +
      state.current.categories[topCategory].toFixed(1) +
      " kg CO2e this week, so the best route starts there.";
  }

  /**
   * Render the personalised insight paragraph combining intensity copy,
   * annual projection, and planned-savings projection.
   *
   * @returns {void}
   */
  function renderInsight() {
    var data          = state.current;
    var annual        = (data.total * 52) / 1000;
    var top           = CATEGORY_META[data.topCategory].label.toLowerCase();
    var plannedSaving = getPlannedSavings();
    var afterPlan     = Math.max(data.total - plannedSaving, 0);

    var copyByIntensity = {
      low:    "You are already on a lighter route. Keep tracking and protect the habits that make " + top + " low.",
      steady: "You are close to a balanced route. One repeatable " + top + " action can make the next week noticeably cleaner.",
      high:   "Your route has room to bend. Start with " + top + ", because it is the largest source in your current week.",
      urgent: "Your footprint is concentrated. A focused " + top + " change plus one low-effort habit will create the fastest drop."
    };

    els.primaryInsight.textContent =
      copyByIntensity[data.intensity] +
      " At this pace, your annual footprint is about " +
      annual.toFixed(1) +
      " tonnes CO2e. Planned actions would bring this week to " +
      afterPlan.toFixed(1) +
      " kg.";
  }

  /**
   * Score an action for ranking relative to the current state.
   * Higher scores surface actions that match the user's biggest source
   * and require the least effort.
   *
   * @param {Readonly<object>} action - Action definition from ACTIONS.
   * @returns {number} Numeric relevance score.
   */
  function scoreAction(action) {
    if (!state.current) { return action.saving; }
    var score = action.saving;
    if (action.category === state.current.topCategory) { score += 9; }
    if (action.effort === "Low")    { score += 4; }
    if (action.effort === "Medium") { score += 2; }
    if (action.id === "ac-flight"   && state.current.flightHours === 0)           { score -= 16; }
    if (action.id === "ac-renewable"&& state.current.renewable > 0.65)            { score -= 8;  }
    if (action.id === "ac-transit"  && state.current.transportMode === "cycle")   { score -= 12; }
    return score;
  }

  /**
   * Return all actions sorted by descending relevance score.
   *
   * @returns {Array<object>} Sorted action objects (each extended with a score property).
   */
  function getRankedActions() {
    return ACTIONS
      .map(function (a) { return Object.assign({}, a, { score: scoreAction(a) }); })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /**
   * Compute total planned weekly CO₂e savings from all currently selected actions.
   *
   * @returns {number} Total planned saving in kg CO₂e per week.
   */
  function getPlannedSavings() {
    return ACTIONS
      .filter(function (a) { return state.planned.has(a.id); })
      .reduce(function (sum, a) { return sum + a.saving; }, 0);
  }

  /**
   * Render the action card grid, applying the active category filter and
   * highlighting the top-ranked recommended action.
   * Uses safe DOM construction (textContent / setAttribute) for all user data.
   *
   * @returns {void}
   */
  function renderActions() {
    var ranked  = getRankedActions();
    var visible = ranked.filter(function (a) {
      return state.filter === "all" || a.category === state.filter;
    });

    var best   = visible[0] || ACTIONS[0];
    var bestId = best.id;

    els.nextBestTitle.textContent = best.title;
    els.nextBestText.textContent  =
      CATEGORY_META[best.category].label +
      " is the strongest next move right now, with about " +
      best.saving.toFixed(1) +
      " kg CO2e saved per week.";

    var fragment = document.createDocumentFragment();

    visible.forEach(function (action) {
      var selected         = state.planned.has(action.id);
      var isRecommended    = action.id === bestId;

      var article = document.createElement("article");
      article.className = "action-card" +
        (selected      ? " selected"    : "") +
        (isRecommended ? " recommended" : "");

      var metaDiv = document.createElement("div");
      metaDiv.className = "action-meta";

      var catPill = document.createElement("span");
      catPill.className   = "pill";
      catPill.textContent = CATEGORY_META[action.category].label;

      var effortPill = document.createElement("span");
      effortPill.className   = "pill";
      effortPill.textContent = action.effort + " effort";

      metaDiv.appendChild(catPill);
      metaDiv.appendChild(effortPill);

      var bodyDiv = document.createElement("div");
      var h3      = document.createElement("h3");
      h3.textContent = action.title;
      var p       = document.createElement("p");
      p.textContent = action.copy;
      bodyDiv.appendChild(h3);
      bodyDiv.appendChild(p);

      var footerDiv  = document.createElement("div");
      footerDiv.className = "action-footer";

      var savingSpan = document.createElement("span");
      savingSpan.className   = "saving";
      savingSpan.textContent = action.saving.toFixed(1) + " kg";

      var btn = document.createElement("button");
      btn.type            = "button";
      btn.className       = "plan-toggle";
      btn.dataset.action  = action.id;
      btn.textContent     = selected ? "Planned" : "Plan";

      footerDiv.appendChild(savingSpan);
      footerDiv.appendChild(btn);

      article.appendChild(metaDiv);
      article.appendChild(bodyDiv);
      article.appendChild(footerDiv);
      fragment.appendChild(article);
    });

    els.actionGrid.innerHTML = "";
    els.actionGrid.appendChild(fragment);
    els.plannedSavings.textContent = getPlannedSavings().toFixed(1);
  }

  /**
   * Render the live challenge card using the top-ranked actions rotated by
   * state.challengeIndex.
   *
   * @returns {void}
   */
  function renderChallenge() {
    var options = getRankedActions().slice(0, 4);
    var action  = options[state.challengeIndex % options.length] || ACTIONS[0];
    var top     = CATEGORY_META[state.current.topCategory].label;
    els.challengeTitle.textContent = "Beat " + top + " with " + action.title.toLowerCase();
    els.challengeCopy.textContent  =
      action.copy +
      " This could trim about " +
      action.saving.toFixed(1) +
      " kg CO2e from a week like this one.";
  }

  /**
   * Render the saved-weeks history list with sanitized date, category, and
   * total values (guards against stored-XSS in localStorage).
   *
   * @returns {void}
   */
  function renderHistory() {
    if (!state.history.length) {
      els.historyList.textContent = "";
      var empty = document.createElement("div");
      empty.className   = "empty-state";
      empty.textContent = "Save this week to start your footprint log.";
      els.historyList.appendChild(empty);
      els.trendLabel.textContent = "No saved weeks yet";
      return;
    }

    var latest   = state.history[state.history.length - 1];
    var previous = state.history[state.history.length - 2];
    if (previous) {
      var diff = latest.total - previous.total;
      els.trendLabel.textContent =
        diff <= 0
          ? Math.abs(diff).toFixed(1) + " kg lower"
          : diff.toFixed(1) + " kg higher";
    } else {
      els.trendLabel.textContent = "First week saved";
    }

    var fragment = document.createDocumentFragment();
    state.history.slice().reverse().forEach(function (item) {
      // Sanitize all fields loaded from localStorage before inserting into DOM
      var safeDate  = sanitizeText(String(item.date  !== undefined ? item.date  : ""));
      var safeTop   = sanitizeText(String(item.top   !== undefined ? item.top   : ""));
      var safeTotal = safeParseNumber(item.total).toFixed(1);

      var itemDiv   = document.createElement("div");
      itemDiv.className = "history-item";

      var innerDiv  = document.createElement("div");
      var strong    = document.createElement("strong");
      strong.textContent = safeTotal + " kg CO2e";
      var topSpan   = document.createElement("span");
      topSpan.textContent = safeTop + " led the week";
      innerDiv.appendChild(strong);
      innerDiv.appendChild(topSpan);

      var dateSpan  = document.createElement("span");
      dateSpan.textContent = safeDate;

      itemDiv.appendChild(innerDiv);
      itemDiv.appendChild(dateSpan);
      fragment.appendChild(itemDiv);
    });

    els.historyList.innerHTML = "";
    els.historyList.appendChild(fragment);
  }

  /**
   * Draw the trend line chart on the history canvas using the last
   * HISTORY_MAX_WEEKS saved weeks plus the current unsaved week.
   *
   * @returns {void}
   */
  function drawChart() {
    var canvas  = els.historyChart;
    var ctx     = canvas.getContext("2d");
    var width   = canvas.width;
    var height  = canvas.height;
    var padding = 46;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#050c07";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(92, 186, 138, 0.12)";
    ctx.lineWidth   = 1;
    for (var i = 0; i < 5; i++) {
      var y = padding + ((height - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    var points = state.history.slice(-10);

    ctx.fillStyle = "#5cba8a";
    ctx.font      = "700 18px 'Outfit', system-ui, sans-serif";
    if (!points.length) {
      ctx.fillText("No saved weeks yet", padding, height / 2);
      return;
    }

    var totals  = points.map(function (p) { return p.total; });
    var current = state.current ? state.current.total : 0;
    var max     = Math.max.apply(Math, totals.concat([current, 20]));
    var min     = Math.min.apply(Math, totals.concat([current, 0]));
    var spread  = Math.max(max - min, 10);
    var xStep   = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

    var coords = points.map(function (item, index) {
      var x = points.length > 1 ? padding + xStep * index : width / 2;
      var yy = height - padding - ((item.total - min) / spread) * (height - padding * 2);
      return { x: x, y: yy, item: item };
    });

    // Trend line
    ctx.strokeStyle = "#56d68f";
    ctx.lineWidth   = 5;
    ctx.lineJoin    = "round";
    ctx.beginPath();
    coords.forEach(function (pt, idx) {
      if (idx === 0) { ctx.moveTo(pt.x, pt.y); }
      else           { ctx.lineTo(pt.x, pt.y); }
    });
    ctx.stroke();

    // Data-point dots + labels
    coords.forEach(function (pt) {
      ctx.beginPath();
      ctx.fillStyle   = "#050c07";
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth   = 3;
      ctx.strokeStyle = "#5cba8a";
      ctx.stroke();

      ctx.fillStyle = "#eef6f1";
      ctx.font      = "700 14px 'Outfit', system-ui, sans-serif";
      ctx.fillText(String(Math.round(pt.item.total)), pt.x - 10, pt.y - 16);
    });
  }

  /**
   * Orchestrate a full UI re-render from the current state snapshot.
   * History and chart are only redrawn when the history array has changed
   * length to avoid unnecessary canvas repaints.
   *
   * @returns {void}
   */
  function render() {
    if (!state.current) { return; }
    var prevLength   = render._prevHistoryLength !== undefined ? render._prevHistoryLength : -1;
    var historyChanged = state.history.length !== prevLength;
    render._prevHistoryLength = state.history.length;

    renderRangeLabels();
    renderScore();
    renderImpact();
    renderBreakdown();
    renderCompass();
    renderInsight();
    renderActions();
    renderChallenge();
    if (historyChanged) {
      renderHistory();
      drawChart();
    }
  }

  // ─── User-action handlers ────────────────────────────────────────────────────

  /**
   * Persist the current week's footprint total and top category to the
   * history log, capping to HISTORY_MAX_WEEKS entries.
   *
   * @returns {void}
   */
  function saveWeek() {
    if (!state.current) { return; }
    var date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    state.history.push({
      date:  date,
      total: state.current.total,
      top:   CATEGORY_META[state.current.topCategory].label
    });
    state.history = state.history.slice(-HISTORY_MAX_WEEKS);
    storageSave("carbonCompassHistory", state.history);
    renderHistory();
    drawChart();
  }

  /**
   * Clear the full history log from state and localStorage.
   *
   * @returns {void}
   */
  function clearLog() {
    state.history = [];
    try {
      localStorage.removeItem("carbonCompassHistory");
    } catch (err) {
      console.warn("[CarbonCompass] localStorage remove failed:", err);
    }
    renderHistory();
    drawChart();
  }

  /**
   * Set a form control's value by element ID.
   *
   * @param {string}        id    - Element ID.
   * @param {string|number} value - Value to assign.
   * @returns {void}
   */
  function setControlValue(id, value) {
    var control = document.querySelector("#" + id);
    if (control) { control.value = value; }
  }

  /**
   * Load the next demo scenario into the form and re-calculate.
   * Cycles through SCENARIOS in order.
   *
   * @returns {void}
   */
  function runScenario() {
    var scenario = SCENARIOS[state.scenarioIndex % SCENARIOS.length];
    Object.entries(scenario.values).forEach(function (entry) {
      setControlValue(entry[0], entry[1]);
    });
    state.scenarioIndex += 1;
    calculate();
    addMessage(
      "bot",
      scenario.label + ". Your new top source is " +
        CATEGORY_META[state.current.topCategory].label.toLowerCase() +
        ", so I refreshed the best action."
    );
  }

  /**
   * Add the top-N ranked actions to the planned set and persist.
   *
   * @param {number} [count=3] - Number of top actions to plan.
   * @returns {void}
   */
  function planTopActions(count) {
    var n = count !== undefined ? count : 3;
    getRankedActions().slice(0, n).forEach(function (a) { state.planned.add(a.id); });
    storageSave("carbonCompassPlanned", Array.from(state.planned));
    render();
    addMessage(
      "bot",
      "I planned the top " + n + " actions. Together they can save about " +
        getPlannedSavings().toFixed(1) + " kg CO2e per week."
    );
  }

  /**
   * Smooth-scroll to the guide section and focus the chat input.
   *
   * @returns {void}
   */
  function focusGuide() {
    document.querySelector("#guide").scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(function () { els.chatInput.focus(); }, 420);
  }

  // ─── Chat helpers ────────────────────────────────────────────────────────────

  /**
   * Append a chat message bubble to the chat panel using safe DOM construction.
   * No innerHTML is used; all text is assigned via textContent.
   *
   * @param {'user'|'bot'} sender - Identifies the message author.
   * @param {string}       text   - Message body text.
   * @returns {void}
   */
  function addMessage(sender, text) {
    if (!els.chatMessages) { return; }
    var message = document.createElement("div");
    var label   = document.createElement("small");
    var body    = document.createElement("span");
    message.className   = "message " + sender;
    label.textContent   = sender === "user" ? "You" : "EcoGuide";
    body.textContent    = text;
    message.appendChild(label);
    message.appendChild(body);
    els.chatMessages.appendChild(message);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  /**
   * Seed the chat with an initial bot greeting if the chat panel is empty.
   *
   * @returns {void}
   */
  function seedChat() {
    if (els.chatMessages.children.length) { return; }
    addMessage("bot", "Your current footprint is live. The strongest signal will appear here as habits change.");
  }

  /**
   * Return the best-ranked action for a given category.
   *
   * @param {string} category - Category key (home | travel | food | stuff).
   * @returns {object} Best-matching action, or first action in the category.
   */
  function getBestActionFor(category) {
    return (
      getRankedActions().find(function (a) { return a.category === category; }) ||
      ACTIONS.find(function (a) { return a.category === category; })
    );
  }

  /**
   * Build a contextual reply to a user chat message based on keyword matching.
   *
   * @param {string} prompt - Raw user message text.
   * @returns {string} Bot reply string.
   */
  function buildBotReply(prompt) {
    var text       = prompt.toLowerCase();
    var data       = state.current;
    var topAction  = getRankedActions()[0];
    var topCat     = CATEGORY_META[data.topCategory].label;
    var topValue   = data.categories[data.topCategory].toFixed(1);
    var annual     = ((data.total * 52) / 1000).toFixed(1);

    if (text.includes("first") || text.includes("start") || text.includes("do")) {
      return "Start with \"" + topAction.title + "\". It matches your " +
        topCat.toLowerCase() + " footprint and can save about " +
        topAction.saving.toFixed(1) + " kg CO2e per week.";
    }
    if (text.includes("why") || text.includes("high") || text.includes("score") || text.includes("explain")) {
      return "Your score is " + data.total.toFixed(1) + " kg CO2e this week. " +
        topCat + " is the biggest source at " + topValue +
        " kg, and your annual pace is about " + annual + " tonnes CO2e.";
    }
    if (text.includes("7") || text.includes("week") || text.includes("plan")) {
      var plan = getRankedActions()
        .slice(0, 3)
        .map(function (a, i) { return "Day " + (i * 2 + 1) + ": " + a.title; })
        .join(". ");
      return plan + ". Save the week after trying them, then keep only the actions that felt repeatable.";
    }
    if (text.includes("travel") || text.includes("commute") || text.includes("flight")) {
      return "Travel is " + data.categories.travel.toFixed(1) +
        " kg this week. The best travel move is \"" +
        getBestActionFor("travel").title +
        "\", especially if car distance or flight hours are high.";
    }
    if (text.includes("food") || text.includes("diet") || text.includes("meal")) {
      return "Food is " + data.categories.food.toFixed(1) +
        " kg this week. Add a few plant-forward meals first, because repeatable meals beat complicated diet rules.";
    }
    if (text.includes("home") || text.includes("electric") || text.includes("energy")) {
      return "Home energy is " + data.categories.home.toFixed(1) +
        " kg this week. Renewable share and appliance timing are your quickest home levers.";
    }
    if (text.includes("shop") || text.includes("waste") || text.includes("stuff") || text.includes("delivery")) {
      return "Stuff and waste are " + data.categories.stuff.toFixed(1) +
        " kg this week. Batch deliveries, reuse basics, and repair before replacing.";
    }
    if (text.includes("save") || text.includes("reduce") || text.includes("cut")) {
      return "Your planned actions save " + getPlannedSavings().toFixed(1) +
        " kg per week. Add \"" + topAction.title + "\" if you want the current fastest cut.";
    }
    return "I would focus on " + topCat.toLowerCase() +
      " first. The sharpest next move is \"" + topAction.title +
      "\", then track the next week to see if the trend bends down.";
  }

  /**
   * Handle chat form submission: display the user message and schedule a bot reply.
   *
   * @param {Event} event - Form submit event.
   * @returns {void}
   */
  function handleChatSubmit(event) {
    event.preventDefault();
    var prompt = els.chatInput.value.trim();
    if (!prompt) { return; }
    addMessage("user", prompt);
    els.chatInput.value = "";
    window.setTimeout(function () { addMessage("bot", buildBotReply(prompt)); }, 240);
  }

  // ─── Event listeners ─────────────────────────────────────────────────────────

  els.form.addEventListener("input",  calculate);
  els.form.addEventListener("change", calculate);

  els.actionGrid.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) { return; }
    var id = button.dataset.action;
    // Validate against allowlisted action IDs before mutating state
    if (!VALID_ACTION_IDS.has(id)) { return; }
    if (state.planned.has(id)) { state.planned.delete(id); }
    else                        { state.planned.add(id); }
    storageSave("carbonCompassPlanned", Array.from(state.planned));
    render();
  });

  document.querySelectorAll(".filter").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll(".filter").forEach(function (item) {
        item.classList.remove("active");
      });
      button.classList.add("active");
      // Validate filter value before using it
      var filterVal = button.dataset.filter;
      var validFilters = ["all", "home", "travel", "food", "stuff"];
      state.filter = validFilters.indexOf(filterVal) !== -1 ? filterVal : "all";
      renderActions();
    });
  });

  els.saveWeek.addEventListener("click",      saveWeek);
  els.clearLog.addEventListener("click",      clearLog);
  els.demoScenario.addEventListener("click",  runScenario);
  els.nudgeChat.addEventListener("click",     focusGuide);
  els.chatLauncher.addEventListener("click",  focusGuide);

  els.spinChallenge.addEventListener("click", function () {
    state.challengeIndex += 1;
    renderChallenge();
  });

  els.autoPlan.addEventListener("click",     function () { planTopActions(3); });
  els.chatForm.addEventListener("submit",    handleChatSubmit);

  document.querySelectorAll("[data-prompt]").forEach(function (button) {
    button.addEventListener("click", function () {
      els.chatInput.value = button.dataset.prompt;
      if (els.chatForm.requestSubmit) {
        els.chatForm.requestSubmit();
      } else {
        handleChatSubmit(new Event("submit"));
      }
    });
  });

  window.addEventListener("resize", drawChart);

  // ─── Initialisation ──────────────────────────────────────────────────────────

  calculate();
  seedChat();

})();
