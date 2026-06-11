# Carbon Compass

Carbon Compass is a personal carbon-footprint navigator that helps individuals understand, track, and reduce their weekly CO₂ emissions through personalised actions and insights.

## Solution

The app turns carbon tracking into a simple repeatable route:

1. Enter weekly habits for home energy, transport, food, shopping, and waste.
2. See an instant footprint estimate in kg CO₂e.
3. Use the animated compass to identify the largest emission source.
4. Plan simple actions with estimated weekly CO₂e savings.
5. Chat with EcoGuide for a first move, score explanation, or 7-day plan.
6. Save each week and watch the footprint trend over time on a canvas chart.

## What Makes It Unique

Instead of showing only a score, Carbon Compass shows a **direction**. The compass points to the category that currently needs attention, then the route planner recommends the next best action based on the user's own inputs and chosen goal level.

## Key Features

- **Understand** – plain explanations of carbon footprint, big emission levers, and why weekly tracking works.
- **Track** – a weekly calculator, saved footprint log (localStorage), and visual trend chart.
- **Reduce** – action cards with effort level, category, and estimated kg CO₂e savings.
- **Personalise** – recommendations adapt to the user's largest source, travel habits, diet, renewable energy share, and ambition goal.
- **Engage** – animated nature background, live compass, live challenge prompts, scenario demos, and a contextual chatbot.
- **EcoGuide chatbot** – answers common questions using the current footprint, top category, planned savings, and ranked actions.

## Security Architecture

| Layer | Mechanism |
|---|---|
| Content-Security-Policy | `script-src 'self'` — no inline scripts, no `eval`, no external JS |
| Input allowlisting | All `<select>` values validated against explicit allowlists before use |
| XSS prevention | All user-derived and localStorage data escaped via `sanitizeText()` before any DOM insertion |
| DOM construction | `renderBreakdown`, `renderActions`, `renderHistory`, and `addMessage` use DOM methods (`createElement`, `textContent`) — **no `innerHTML` for user data** |
| CSP extras | `object-src 'none'`, `base-uri 'self'`, `form-action 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer leakage | `referrer: strict-origin-when-cross-origin` |
| Permissions Policy | Camera, microphone, geolocation, payment, USB all disabled |
| Strict mode | `"use strict"` in both `app.js` and `particles.js` via IIFE wrappers |
| Action validation | `data-action` values verified against a `Set` of allowlisted IDs before state mutation |

## Code Quality

- All functions documented with full JSDoc (`@param`, `@returns`, `@type`).
- All magic numbers extracted into named `const` constants (`BASE_TARGET_KG`, `WEEKS_PER_MONTH`, `FOOD_EMISSION_FLOOR`, `HISTORY_MAX_WEEKS`).
- All data objects frozen with `Object.freeze()` to prevent accidental mutation.
- Calculation logic split into pure, testable functions (`calcHome`, `calcTravel`, `calcFood`, `calcStuff`).
- `allowlisted()` helper centralises all allowlist validation.
- DOM element cache queried once at startup; no repeated `querySelector` in hot paths.

## Testing

```bash
npx --yes jest app.test.js --verbose
npx --yes jest app.test.js --coverage
```

The test suite covers:
- Emission calculation correctness for all four categories
- `sanitizeText` XSS prevention (including full payload)
- `allowlisted` security validator (all allowlists, injection attempts, case-sensitivity)
- `safeParseNumber` and `clamp` edge cases
- `getIntensity` with all goal levels
- `scoreAction` all bonuses and penalties
- Integration: full footprint calculation including injected-value rejection
- History helpers: trend computation, capping, serialisation, XSS sanitization
- localStorage wrappers: happy path, parse errors, quota errors, circular references

## Files

| File | Purpose |
|---|---|
| `index.html` | App structure, semantic HTML, security meta headers |
| `styles.css` | Responsive visual design, dark mode, animations |
| `app.js` | Calculator, insights, action planner, chat, history, chart |
| `particles.js` | Leaf and firefly particle animation (visual only) |
| `app.test.js` | Comprehensive Jest unit + integration test suite |
| `package.json` | Dev dependencies and test scripts |

Open `index.html` in a browser to use the app.
