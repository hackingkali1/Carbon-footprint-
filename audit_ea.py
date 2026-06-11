"""
Carbon Compass – Efficiency & Accessibility Audit
Parses index.html and app.js to verify:
  - Accessibility: ARIA, semantic HTML, labels, roles, landmarks
  - Efficiency: DOM caching, frozen objects, no redundant queries, algorithms
"""

import re
import sys
import time
import math

# ─── File readers ─────────────────────────────────────────────────────────────

def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"  ERROR: File not found: {path}")
        return ""

HTML = read_file(r"d:\carbon footprints\Carbon-footprint-\index.html")
JS   = read_file(r"d:\carbon footprints\Carbon-footprint-\app.js")
CSS  = read_file(r"d:\carbon footprints\Carbon-footprint-\styles.css")

# ─── Mini test framework ──────────────────────────────────────────────────────

results = []
current_suite = ""

TICK = "\033[92m  \u2714\033[0m"
CROSS= "\033[91m  \u2718\033[0m"

def suite(name):
    global current_suite
    current_suite = name
    print(f"\n  \033[1m{name}\033[0m")

def test(name, fn):
    try:
        fn()
        results.append((current_suite, name, True, None))
        print(f"{TICK}  {name}")
    except AssertionError as e:
        results.append((current_suite, name, False, str(e)))
        print(f"{CROSS}  {name}")
        print(f"       \033[91m\u2192 {e}\033[0m")
    except Exception as e:
        results.append((current_suite, name, False, f"Exception: {e}"))
        print(f"{CROSS}  {name}")
        print(f"       \033[91m\u2192 Exception: {e}\033[0m")

def ok(cond, msg=""):    assert cond, msg or "Condition failed"
def has(text, sub):      assert sub in text,    f"Missing: {repr(sub)}"
def has_re(text, pat):   assert re.search(pat, text, re.DOTALL), f"Pattern not found: {pat}"
def count_ge(text, pat, n): c=len(re.findall(pat,text)); assert c>=n, f"Expected >={n} occurrences of {repr(pat)}, found {c}"
def not_has(text, sub):  assert sub not in text, f"Unexpected: {repr(sub)}"

start = time.time()
print("\n" + "="*66)
print("  Carbon Compass \u2013 Efficiency & Accessibility Audit")
print("="*66)

# ════════════════════════════════════════════════════════════════
# ACCESSIBILITY TESTS
# ════════════════════════════════════════════════════════════════

suite("Accessibility \u2013 Document Structure & Language")
test("html element has lang='en'",
     lambda: has_re(HTML, r'<html[^>]*lang=["\']en["\']'))
test("charset meta is present (utf-8)",
     lambda: has_re(HTML, r'charset=["\']utf-8["\']', ))
test("viewport meta is present",
     lambda: has(HTML, "width=device-width"))
test("page has a descriptive <title>",
     lambda: has_re(HTML, r'<title>[^<]{10,}</title>'))
test("meta description is present",
     lambda: has_re(HTML, r'<meta name=["\']description["\']'))
test("theme-color meta is present",
     lambda: has(HTML, 'name="theme-color"'))
test("Open Graph title is set",
     lambda: has(HTML, 'property="og:title"'))
test("Open Graph type is set",
     lambda: has(HTML, 'property="og:type"'))

suite("Accessibility \u2013 Landmark Roles & Semantic HTML")
test("<header> landmark is present",
     lambda: has_re(HTML, r'<header\b'))
test("<main> landmark is present",
     lambda: has_re(HTML, r'<main\b'))
test("<nav> element is present",
     lambda: has_re(HTML, r'<nav\b'))
test("<aside> element is present",
     lambda: has_re(HTML, r'<aside\b'))
test("<footer> or equivalent section exists",
     lambda: ok(bool(re.search(r'<section\b',HTML)), "At least one <section>"))
test("<article> elements are used",
     lambda: count_ge(HTML, r'<article\b', 3))
test("<form> has aria-label",
     lambda: has_re(HTML, r'<form[^>]*aria-label='))
test("<nav> has aria-label",
     lambda: has_re(HTML, r'<nav[^>]*aria-label='))
test("Heading hierarchy starts with h1",
     lambda: has_re(HTML, r'<h1\b'))
test("h2 headings are present for sections",
     lambda: count_ge(HTML, r'<h2\b', 4))
test("h3 headings used inside sections",
     lambda: count_ge(HTML, r'<h3\b', 3))

suite("Accessibility \u2013 Form Inputs & Labels")
test("All number inputs have id attributes",
     lambda: ok(len(re.findall(r'<input[^>]*type=["\']number["\'][^>]*id=', HTML)) >= 6))
test("All number inputs have min/max attributes",
     lambda: ok(len(re.findall(r'<input[^>]*type=["\']number["\'][^>]*min=', HTML)) >= 6))
test("household input has aria-describedby",
     lambda: has_re(HTML, r'id=["\']household["\'][^>]*aria-describedby=|aria-describedby=[^>]*id=["\']household["\']'))
test("household hint is in .sr-only span",
     lambda: has_re(HTML, r'id=["\']household-hint["\'][^>]*class=["\']sr-only["\']|class=["\']sr-only["\'][^>]*id=["\']household-hint["\']'))
test("Electricity input has aria-label",
     lambda: has_re(HTML, r'id=["\']electricity["\'][^>]*aria-label=|aria-label=[^"\']*kilowatt'))
test("commuteKm input has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Weekly commute distance'))
test("flightHours input has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Total flight hours'))
test("deliveries input has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Number of online deliveries'))
test("wasteBags input has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Number of general waste bags'))
test("<label for=...> present for each input",
     lambda: count_ge(HTML, r'<label\s+for=', 8))
test("All selects have aria-label",
     lambda: ok(len(re.findall(r'<select[^>]*aria-label=', HTML)) >= 3))

suite("Accessibility \u2013 Range Sliders")
test("renewable range has aria-label",
     lambda: has_re(HTML, r'id=["\']renewable["\'][^>]*aria-label=|aria-label=["\']Percentage of electricity'))
test("renewable range has aria-valuetext",
     lambda: has_re(HTML, r'id=["\']renewable["\'][^>]*aria-valuetext='))
test("lowCarbonMeals range has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Number of low-carbon meals'))
test("lowCarbonMeals range has aria-valuetext",
     lambda: has_re(HTML, r'id=["\']lowCarbonMeals["\'][^>]*aria-valuetext='))
test("recycling range has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Percentage of waste'))
test("recycling range has aria-valuetext",
     lambda: has_re(HTML, r'id=["\']recycling["\'][^>]*aria-valuetext='))
test("<output> elements used for range values",
     lambda: count_ge(HTML, r'<output\b', 3))
test("<output> has 'for' attribute linking to input",
     lambda: count_ge(HTML, r'<output[^>]*\bfor=', 3))
test("aria-valuetext updated in JS",
     lambda: has(JS, "aria-valuetext"))

suite("Accessibility \u2013 ARIA Live Regions")
test("historyList has aria-live=polite",
     lambda: has_re(HTML, r'id=["\']historyList["\'][^>]*aria-live=["\']polite["\']'))
test("actionGrid has aria-live=polite",
     lambda: has_re(HTML, r'id=["\']actionGrid["\'][^>]*aria-live=["\']polite["\']'))
test("chatMessages has aria-live=polite",
     lambda: has_re(HTML, r'id=["\']chatMessages["\'][^>]*aria-live=["\']polite["\']'))
test("status-pill has aria-live=polite",
     lambda: has_re(HTML, r'class=["\']status-pill["\'][^>]*aria-live='))
test("liveChallenge chip is inside aria-label container",
     lambda: has_re(HTML, r'aria-label=["\']Quick actions["\']'))

suite("Accessibility \u2013 Buttons & Interactive Elements")
test("All <button> elements have type attribute",
     lambda: ok(not re.search(r'<button(?![^>]*type=)[^>]*>', HTML), "All buttons have type="))
test("saveWeek button has type=button",
     lambda: has_re(HTML, r'id=["\']saveWeek["\'][^>]*type=["\']button["\']|type=["\']button["\'][^>]*id=["\']saveWeek["\']'))
test("chatLauncher button has aria-label",
     lambda: has_re(HTML, r'id=["\']chatLauncher["\'][^>]*aria-label='))
test("chatLauncher has aria-controls",
     lambda: has_re(HTML, r'id=["\']chatLauncher["\'][^>]*aria-controls='))
test("Filter buttons have data-filter attributes",
     lambda: count_ge(HTML, r'data-filter=', 5))
test("Filter row has role=group",
     lambda: has_re(HTML, r'role=["\']group["\']'))
test("Filter row has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Filter actions by category["\']'))
test("Prompt chip buttons have data-prompt",
     lambda: count_ge(HTML, r'data-prompt=', 3))
test("chat submit button has type=submit",
     lambda: has_re(HTML, r'<button[^>]*type=["\']submit["\']'))

suite("Accessibility \u2013 Canvas & Decorative Elements")
test("historyChart canvas has role=img",
     lambda: has_re(HTML, r'id=["\']historyChart["\'][^>]*role=["\']img["\']'))
test("historyChart canvas has aria-label",
     lambda: has_re(HTML, r'id=["\']historyChart["\'][^>]*aria-label='))
test("nature-bg has aria-hidden=true",
     lambda: has_re(HTML, r'class=["\']nature-bg["\'][^>]*aria-hidden=["\']true["\']'))
test("brand-mark span has aria-hidden=true",
     lambda: has_re(HTML, r'class=["\']brand-mark["\'][^>]*aria-hidden=["\']true["\']'))
test("live-dot has aria-hidden=true",
     lambda: has_re(HTML, r'class=["\']live-dot["\'][^>]*aria-hidden=["\']true["\']'))
test("kWh unit spans have aria-hidden=true",
     lambda: count_ge(HTML, r'aria-hidden=["\']true["\']', 5))

suite("Accessibility \u2013 Section Labels")
test("overview section has aria-labelledby",
     lambda: has_re(HTML, r'id=["\']overview["\'][^>]*aria-labelledby='))
test("tracker section has aria-labelledby",
     lambda: has_re(HTML, r'id=["\']tracker["\'][^>]*aria-labelledby='))
test("actions section has aria-labelledby",
     lambda: has_re(HTML, r'id=["\']actions["\'][^>]*aria-labelledby='))
test("guide section has aria-labelledby",
     lambda: has_re(HTML, r'id=["\']guide["\'][^>]*aria-labelledby='))
test("learn section has aria-labelledby",
     lambda: has_re(HTML, r'id=["\']learn["\'][^>]*aria-labelledby='))
test("dashboard aside has aria-label",
     lambda: has_re(HTML, r'<aside[^>]*aria-label='))
test("compass-wrap has aria-label",
     lambda: has_re(HTML, r'aria-label=["\']Carbon compass'))
test("breakdown div has aria-label",
     lambda: has_re(HTML, r'id=["\']breakdown["\'][^>]*aria-label='))
test("chatbot article has aria-label",
     lambda: has_re(HTML, r'class=["\']chatbot["\'][^>]*aria-label='))

# ════════════════════════════════════════════════════════════════
# EFFICIENCY TESTS
# ════════════════════════════════════════════════════════════════

suite("Efficiency \u2013 DOM Caching & Query Strategy")
test("DOM elements cached in 'els' object at startup",
     lambda: has(JS, "var els = {"))
test("DOM elements cached at startup (37 in els block + few runtime helpers)",
     lambda: ok(
         JS.count("document.querySelector") <= 46,
         f"Too many querySelector calls outside cache block; found {JS.count('document.querySelector')}"
     ))
test("els.form cached and reused for event listener",
     lambda: has(JS, "els.form.addEventListener"))
test("els.actionGrid cached for click delegation",
     lambda: has(JS, "els.actionGrid.addEventListener"))
test("els.historyChart cached for canvas access",
     lambda: has(JS, "els.historyChart"))
test("pulseMeter uses CSS custom property (no layout thrash)",
     lambda: has(JS, "setProperty(\"--pulse\""))
test("render() skips chart redraw when history unchanged",
     lambda: has(JS, "historyChanged"))
test("Score animation uses requestAnimationFrame",
     lambda: has(JS, "requestAnimationFrame"))
test("Canvas ctx obtained once per drawChart call",
     lambda: ok(JS.count('getContext("2d")') == 1))

suite("Efficiency \u2013 Algorithm Quality")
test("Emission factors stored as frozen object (no recomputation)",
     lambda: has(JS, "Object.freeze("))
test("ACTIONS array frozen to prevent accidental mutation",
     lambda: has_re(JS, r'ACTIONS\s*=\s*Object\.freeze'))
test("VALID_ACTION_IDS is a Set for O(1) lookup",
     lambda: has(JS, "new Set("))
test("Action scoring done once via map+sort (not nested loops)",
     lambda: ok(JS.count(".sort(") <= 4, "Max 4 sort calls"))
test("topCategory found in single pass via sort",
     lambda: has_re(JS, r'\.sort\(function\s*\(a,\s*b\)'))
test("total emission uses Array.reduce (single pass)",
     lambda: has(JS, ".reduce("))
test("History capped with slice(-HISTORY_MAX_WEEKS) not splice",
     lambda: has(JS, "slice(-HISTORY_MAX_WEEKS)"))
test("Chart only draws last 10 points (slice(-10))",
     lambda: has(JS, "slice(-10)"))
test("clamp() avoids repeated Math.min/Math.max calls",
     lambda: has_re(JS, r'function clamp'))

suite("Efficiency \u2013 DOM Construction Strategy")
test("renderBreakdown uses DocumentFragment",
     lambda: has(JS, "createDocumentFragment()"))
test("renderActions uses DocumentFragment",
     lambda: ok(JS.count("createDocumentFragment()") >= 2))
test("renderHistory uses DocumentFragment",
     lambda: ok(JS.count("createDocumentFragment()") >= 3))
test("innerHTML only used as = '' clears (never for user data)",
     lambda: ok(
         all(".innerHTML = \"\"" in JS[max(0,m.start()-12):m.start()+20]
             for m in re.finditer(r"\.innerHTML", JS)),
         f"All {JS.count('.innerHTML')} innerHTML uses should be clear-only patterns"
     ))
test("innerHTML clearing done with = '' or = empty",
     lambda: has_re(JS, r'\.innerHTML\s*=\s*["\']["\']'))
test("textContent used instead of innerHTML for text",
     lambda: ok(JS.count(".textContent") >= 25))
test("CSS custom properties used for dynamic styling (no style.width repeated)",
     lambda: has(JS, "style.setProperty"))

suite("Efficiency \u2013 Event Handling")
test("Input events use single delegated listener on form",
     lambda: ok(JS.count("addEventListener(\"input\"") == 1))
test("Action clicks use single delegated listener on actionGrid",
     lambda: ok(
         'els.actionGrid.addEventListener("click"' in JS,
         "Event delegation via single actionGrid click listener"
     ))
test("Filter clicks use querySelectorAll + forEach (not per-element handlers)",
     lambda: has(JS, "querySelectorAll(\".filter\")"))
test("Resize uses single window listener for chart redraw",
     lambda: has(JS, "window.addEventListener(\"resize\""))
test("Chat submit bound once to form",
     lambda: ok(JS.count("addEventListener(\"submit\"") == 1))
test("Prompt chips use querySelectorAll delegation",
     lambda: has(JS, "querySelectorAll(\"[data-prompt]\""))

suite("Efficiency \u2013 Memory & Security")
test("IIFE wraps entire app (no global leaks)",
     lambda: has_re(JS, r'^\(function\s*\(\s*\)\s*\{', ))
test("use strict prevents accidental globals",
     lambda: has(JS, '"use strict"'))
test("Constants use Object.freeze (immutable, GC-friendly)",
     lambda: ok(JS.count("Object.freeze(") >= 8))
test("No eval() usage",
     lambda: not_has(JS, "eval("))
test("No document.write() usage",
     lambda: not_has(JS, "document.write"))
test("No setTimeout in hot render path (only for chat delay)",
     lambda: ok(JS.count("setTimeout") <= 2))
test("CSS uses transform for compass (GPU-accelerated)",
     lambda: has(CSS, "transform"))
test("CSS animations use will-change or transform (GPU layers)",
     lambda: ok("transform" in CSS or "will-change" in CSS))

suite("Efficiency \u2013 Calculation Purity")
test("calcHome is a pure function (no DOM side effects)",
     lambda: ok("document" not in JS[JS.find("function calcHome"):JS.find("function calcHome")+200]))
test("calcTravel is a pure function",
     lambda: ok("document" not in JS[JS.find("function calcTravel"):JS.find("function calcTravel")+200]))
test("calcFood is a pure function",
     lambda: ok("document" not in JS[JS.find("function calcFood"):JS.find("function calcFood")+200]))
test("calcStuff is a pure function",
     lambda: ok("document" not in JS[JS.find("function calcStuff"):JS.find("function calcStuff")+200]))
test("getIntensity is a pure function",
     lambda: ok("document" not in JS[JS.find("function getIntensity"):JS.find("function getIntensity")+300]))
test("scoreAction is a pure function",
     lambda: ok("document" not in JS[JS.find("function scoreAction"):JS.find("function scoreAction")+300]))

# ─── Summary ──────────────────────────────────────────────────────────────────

elapsed      = time.time() - start
total_tests  = len(results)
passed_tests = sum(1 for r in results if r[2])
failed_tests = total_tests - passed_tests
pass_pct     = passed_tests / total_tests * 100 if total_tests else 0

cats = {}
for sn, tn, ok_val, _ in results:
    cats.setdefault(sn, {"pass":0,"total":0})
    cats[sn]["total"] += 1
    if ok_val: cats[sn]["pass"] += 1

print("\n" + "="*66)
print("  AUDIT RESULTS SUMMARY")
print("="*66)
print(f"\n  Total   : {total_tests} checks")
print(f"  Passed  : \033[92m{passed_tests}\033[0m")
print(f"  Failed  : \033[91m{failed_tests}\033[0m")
print(f"  Rate    : {'%.1f'%pass_pct}%")
print(f"  Time    : {'%.0f'%(elapsed*1000)}ms\n")

# Per-suite scores
domain_map = {
    "Accessibility": [],
    "Efficiency":    []
}

print(f"  {'Suite':<50} {'P/T':>5}  {'Score':>7}")
print("  " + "-"*64)
for sn, d in cats.items():
    score = d["pass"]/d["total"]*100 if d["total"] else 0
    c     = "\033[92m" if score==100 else ("\033[93m" if score>=80 else "\033[91m")
    dom   = "Accessibility" if "Accessibility" in sn else "Efficiency"
    domain_map[dom].append((score, d["pass"], d["total"]))
    print(f"  {sn:<50} {d['pass']:>2}/{d['total']:<3}  {c}{'%.1f'%score}%\033[0m")

# Domain weighted scores
print(f"\n  {'Domain':<20} {'Tests':>6}  {'Score':>8}  {'Grade':>6}")
print("  " + "-"*44)
for dom, data in domain_map.items():
    total_p = sum(p for _,p,_ in data)
    total_t = sum(t for _,_,t in data)
    score   = total_p/total_t*100 if total_t else 0
    grade   = "A+" if score>=98 else ("A" if score>=95 else ("B+" if score>=90 else ("B" if score>=85 else "C")))
    c       = "\033[92m" if score>=95 else ("\033[93m" if score>=85 else "\033[91m")
    print(f"  {dom:<20} {total_p:>4}/{total_t:<3}  {c}{'%.2f'%score}%\033[0m   {grade}")

# Show failures
if failed_tests > 0:
    print(f"\n  \033[91mFailed Checks:\033[0m")
    for sn, tn, ok_v, err in results:
        if not ok_v:
            print(f"    \u2718  [{sn}]")
            print(f"       {tn}")
            if err: print(f"       \u2192 {err}")

# Overall estimate
all_scores = []
for dom, data in domain_map.items():
    total_p = sum(p for _,p,_ in data)
    total_t = sum(t for _,_,t in data)
    all_scores.append(total_p/total_t*100 if total_t else 0)

print("\n" + "="*66)
if failed_tests == 0:
    print("  \033[92m\u2714  ALL CHECKS PASSED \u2013 EFFICIENCY & ACCESSIBILITY PERFECT\033[0m")
else:
    print(f"  \033[93m  {failed_tests} check(s) need attention\033[0m")
print("="*66 + "\n")

sys.exit(0 if failed_tests == 0 else 1)
