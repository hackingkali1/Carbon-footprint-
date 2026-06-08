const factors = {
  electricity: 0.72,
  transport: {
    car: 0.18,
    motorbike: 0.1,
    bus: 0.075,
    metro: 0.035,
    cycle: 0
  },
  flightsPerHourWeekly: 22,
  dietWeekly: {
    meat: 36,
    mixed: 25,
    vegetarian: 17,
    plant: 11
  },
  lowCarbonMealSaving: 0.45,
  deliveryWeekly: 0.65,
  wasteBag: 1.8
};

const categoryMeta = {
  home: { label: "Home", color: "#56d68f", angle: 0 },
  travel: { label: "Travel", color: "#53c7d5", angle: 90 },
  food: { label: "Food", color: "#e0b45b", angle: 180 },
  stuff: { label: "Stuff", color: "#df6f87", angle: 270 }
};

const actions = [
  {
    id: "ac-thermostat",
    category: "home",
    title: "Shift heavy appliance use",
    copy: "Run laundry, charging, and water heating in one planned block and avoid standby power overnight.",
    saving: 5.4,
    effort: "Low",
    match: ["electricity"]
  },
  {
    id: "ac-led",
    category: "home",
    title: "Replace the busiest bulbs",
    copy: "Start with the three lights used most often before changing the entire house.",
    saving: 3.1,
    effort: "Low",
    match: ["electricity"]
  },
  {
    id: "ac-renewable",
    category: "home",
    title: "Move one bill toward clean power",
    copy: "Choose a green tariff, rooftop solar step, or shared renewable option when available.",
    saving: 8.6,
    effort: "Medium",
    match: ["electricity"]
  },
  {
    id: "ac-transit",
    category: "travel",
    title: "Swap two commute days",
    copy: "Use metro, bus, carpool, walk, or cycle for two regular trips each week.",
    saving: 7.2,
    effort: "Medium",
    match: ["commute"]
  },
  {
    id: "ac-tripchain",
    category: "travel",
    title: "Chain errands into one loop",
    copy: "Combine short trips into one route and avoid repeat starts for small purchases.",
    saving: 4.8,
    effort: "Low",
    match: ["commute"]
  },
  {
    id: "ac-flight",
    category: "travel",
    title: "Replace one short flight segment",
    copy: "For nearby routes, compare rail or video call alternatives before booking.",
    saving: 18,
    effort: "High",
    match: ["flight"]
  },
  {
    id: "ac-meals",
    category: "food",
    title: "Make three meals plant-forward",
    copy: "Pick repeatable meals you already like and anchor them to fixed days.",
    saving: 4.2,
    effort: "Low",
    match: ["diet"]
  },
  {
    id: "ac-foodwaste",
    category: "food",
    title: "Cook from a two-day shelf",
    copy: "Keep a visible use-first area for leftovers and ingredients close to expiry.",
    saving: 3.6,
    effort: "Low",
    match: ["waste"]
  },
  {
    id: "ac-local",
    category: "food",
    title: "Choose seasonal staples",
    copy: "Build weekly meals around produce that is local, seasonal, and minimally packaged.",
    saving: 2.7,
    effort: "Medium",
    match: ["diet", "deliveries"]
  },
  {
    id: "ac-cart",
    category: "stuff",
    title: "Hold a 48-hour cart",
    copy: "Delay non-urgent purchases and batch the ones that still matter after two days.",
    saving: 5,
    effort: "Low",
    match: ["deliveries"]
  },
  {
    id: "ac-repair",
    category: "stuff",
    title: "Repair before replacing",
    copy: "Create a small fix list for clothes, electronics, bags, or appliances.",
    saving: 6.5,
    effort: "Medium",
    match: ["deliveries"]
  },
  {
    id: "ac-reuse",
    category: "stuff",
    title: "Build a reuse station",
    copy: "Place bags, bottles, containers, and return parcels in one exit-ready spot.",
    saving: 2.5,
    effort: "Low",
    match: ["waste", "deliveries"]
  }
];

const els = {
  form: document.querySelector("#footprintForm"),
  weeklyScore: document.querySelector("#weeklyScore"),
  score: document.querySelector(".score"),
  renewable: document.querySelector("#renewable"),
  renewableValue: document.querySelector("#renewableValue"),
  lowCarbonMeals: document.querySelector("#lowCarbonMeals"),
  mealValue: document.querySelector("#mealValue"),
  recycling: document.querySelector("#recycling"),
  recyclingValue: document.querySelector("#recyclingValue"),
  breakdown: document.querySelector("#breakdown"),
  needle: document.querySelector("#needle"),
  compassTitle: document.querySelector("#compassTitle"),
  compassText: document.querySelector("#compassText"),
  primaryInsight: document.querySelector("#primaryInsight"),
  actionGrid: document.querySelector("#actionGrid"),
  plannedSavings: document.querySelector("#plannedSavings"),
  nextBestTitle: document.querySelector("#nextBestTitle"),
  nextBestText: document.querySelector("#nextBestText"),
  saveWeek: document.querySelector("#saveWeek"),
  clearLog: document.querySelector("#clearLog"),
  historyList: document.querySelector("#historyList"),
  historyChart: document.querySelector("#historyChart"),
  trendLabel: document.querySelector("#trendLabel"),
  pulseMeter: document.querySelector(".pulse-meter"),
  impactTitle: document.querySelector("#impactTitle"),
  impactText: document.querySelector("#impactText"),
  liveChallenge: document.querySelector("#liveChallenge"),
  demoScenario: document.querySelector("#demoScenario"),
  nudgeChat: document.querySelector("#nudgeChat"),
  spinChallenge: document.querySelector("#spinChallenge"),
  autoPlan: document.querySelector("#autoPlan"),
  challengeTitle: document.querySelector("#challengeTitle"),
  challengeCopy: document.querySelector("#challengeCopy"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatLauncher: document.querySelector("#chatLauncher")
};

const state = {
  current: null,
  filter: "all",
  planned: new Set(JSON.parse(localStorage.getItem("carbonCompassPlanned") || "[]")),
  history: JSON.parse(localStorage.getItem("carbonCompassHistory") || "[]"),
  scenarioIndex: 0,
  challengeIndex: 0,
  lastScore: null
};

const scenarios = [
  {
    label: "Transit week loaded",
    values: {
      transportMode: "metro",
      commuteKm: 62,
      flightHours: 0,
      deliveries: 3,
      lowCarbonMeals: 9
    }
  },
  {
    label: "High-travel week loaded",
    values: {
      transportMode: "car",
      commuteKm: 210,
      flightHours: 4,
      deliveries: 8,
      lowCarbonMeals: 4
    }
  },
  {
    label: "Clean-home week loaded",
    values: {
      electricity: 42,
      renewable: 65,
      recycling: 70,
      wasteBags: 1,
      diet: "vegetarian"
    }
  }
];

function readNumber(id) {
  const value = Number(document.querySelector(`#${id}`).value);
  return Number.isFinite(value) ? value : 0;
}

function calculate() {
  const household = Math.max(readNumber("household"), 1);
  const electricity = readNumber("electricity");
  const renewable = readNumber("renewable") / 100;
  const transportMode = document.querySelector("#transportMode").value;
  const commuteKm = readNumber("commuteKm");
  const flightHours = readNumber("flightHours");
  const diet = document.querySelector("#diet").value;
  const lowCarbonMeals = readNumber("lowCarbonMeals");
  const deliveries = readNumber("deliveries");
  const wasteBags = readNumber("wasteBags");
  const recycling = readNumber("recycling") / 100;
  const goal = document.querySelector("#goal").value;

  const home = (electricity * factors.electricity * (1 - renewable)) / household;
  const commute = commuteKm * factors.transport[transportMode];
  const flight = (flightHours * factors.flightsPerHourWeekly) / 4.345;
  const travel = commute + flight;
  const food = Math.max(factors.dietWeekly[diet] - lowCarbonMeals * factors.lowCarbonMealSaving, 4);
  const stuff = deliveries * factors.deliveryWeekly / 4.345 + wasteBags * factors.wasteBag * (1 - recycling * 0.58);

  const categories = {
    home,
    travel,
    food,
    stuff
  };

  const total = Object.values(categories).reduce((sum, value) => sum + value, 0);
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0];
  const intensity = getIntensity(total, goal);

  state.current = {
    household,
    electricity,
    renewable,
    transportMode,
    commuteKm,
    flightHours,
    diet,
    lowCarbonMeals,
    deliveries,
    wasteBags,
    recycling,
    goal,
    categories,
    total,
    topCategory,
    intensity
  };

  render();
}

function getIntensity(total, goal) {
  const goalMultiplier = {
    starter: 1.2,
    balanced: 1,
    bold: 0.78
  }[goal];
  const target = 45 * goalMultiplier;
  if (total <= target * 0.75) return "low";
  if (total <= target) return "steady";
  if (total <= target * 1.35) return "high";
  return "urgent";
}

function render() {
  if (!state.current) return;
  renderRangeLabels();
  renderScore();
  renderImpact();
  renderBreakdown();
  renderCompass();
  renderInsight();
  renderActions();
  renderChallenge();
  renderHistory();
  drawChart();
}

function renderRangeLabels() {
  els.renewableValue.textContent = `${readNumber("renewable")}%`;
  els.mealValue.textContent = readNumber("lowCarbonMeals");
  els.recyclingValue.textContent = `${readNumber("recycling")}%`;
}

function renderScore() {
  const rounded = Math.round(state.current.total);
  els.weeklyScore.textContent = rounded;
  if (state.lastScore !== null && state.lastScore !== rounded) {
    els.score.classList.remove("bump");
    window.requestAnimationFrame(() => els.score.classList.add("bump"));
  }
  state.lastScore = rounded;
}

function renderImpact() {
  const { total, intensity, topCategory } = state.current;
  const top = categoryMeta[topCategory].label;
  const percent = Math.max(12, Math.min((total / 85) * 100, 100));
  els.pulseMeter.style.setProperty("--pulse", `${percent}%`);

  const titles = {
    low: "Clean signal",
    steady: "Balanced signal",
    high: "Action signal",
    urgent: "Hotspot signal"
  };
  const text = {
    low: "Your weekly route is already lean. Keep the habits that made it work.",
    steady: "One focused action can make the next saved week visibly lower.",
    high: `${top} is pulling the score upward. Start there for the fastest movement.`,
    urgent: `${top} is a clear hotspot. Pick a high-saving action and save the week after trying it.`
  };

  els.impactTitle.textContent = titles[intensity];
  els.impactText.textContent = text[intensity];
  els.liveChallenge.textContent = `${top} leads by ${state.current.categories[topCategory].toFixed(1)} kg this week`;
}

function renderBreakdown() {
  const max = Math.max(...Object.values(state.current.categories), 1);
  els.breakdown.innerHTML = Object.entries(state.current.categories)
    .map(([key, value]) => {
      const meta = categoryMeta[key];
      const width = Math.max((value / max) * 100, 4);
      return `
        <div class="breakdown-row">
          <span>${meta.label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="--bar-color:${meta.color};width:${width}%"></div>
          </div>
          <strong>${value.toFixed(1)} kg</strong>
        </div>
      `;
    })
    .join("");
}

function renderCompass() {
  const { topCategory, categories } = state.current;
  const meta = categoryMeta[topCategory];
  els.needle.style.transform = `rotate(${meta.angle}deg)`;
  els.compassTitle.textContent = `${meta.label} is your current north`;
  els.compassText.textContent = `${meta.label} contributes ${categories[topCategory].toFixed(1)} kg CO2e this week, so the best route starts there.`;
}

function renderInsight() {
  const data = state.current;
  const annual = (data.total * 52) / 1000;
  const top = categoryMeta[data.topCategory].label.toLowerCase();
  const plannedSaving = getPlannedSavings();
  const afterPlan = Math.max(data.total - plannedSaving, 0);
  const copyByIntensity = {
    low: `You are already on a lighter route. Keep tracking and protect the habits that make ${top} low.`,
    steady: `You are close to a balanced route. One repeatable ${top} action can make the next week noticeably cleaner.`,
    high: `Your route has room to bend. Start with ${top}, because it is the largest source in your current week.`,
    urgent: `Your footprint is concentrated. A focused ${top} change plus one low-effort habit will create the fastest drop.`
  };

  els.primaryInsight.textContent = `${copyByIntensity[data.intensity]} At this pace, your annual footprint is about ${annual.toFixed(1)} tonnes CO2e. Planned actions would bring this week to ${afterPlan.toFixed(1)} kg.`;
}

function renderActions() {
  const visible = actions
    .map((action) => ({ ...action, score: scoreAction(action) }))
    .sort((a, b) => b.score - a.score)
    .filter((action) => state.filter === "all" || action.category === state.filter);

  const best = visible[0] || actions[0];
  const bestId = best.id;
  els.nextBestTitle.textContent = best.title;
  els.nextBestText.textContent = `${categoryMeta[best.category].label} is the strongest next move right now, with about ${best.saving.toFixed(1)} kg CO2e saved per week.`;

  els.actionGrid.innerHTML = visible
    .map((action) => {
      const selected = state.planned.has(action.id);
      return `
        <article class="action-card ${selected ? "selected" : ""} ${action.id === bestId ? "recommended" : ""}">
          <div class="action-meta">
            <span class="pill">${categoryMeta[action.category].label}</span>
            <span class="pill">${action.effort} effort</span>
          </div>
          <div>
            <h3>${action.title}</h3>
            <p>${action.copy}</p>
          </div>
          <div class="action-footer">
            <span class="saving">${action.saving.toFixed(1)} kg</span>
            <button type="button" class="plan-toggle" data-action="${action.id}">
              ${selected ? "Planned" : "Plan"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  els.plannedSavings.textContent = getPlannedSavings().toFixed(1);
}

function renderChallenge() {
  const options = getRankedActions().slice(0, 4);
  const action = options[state.challengeIndex % options.length] || actions[0];
  const top = categoryMeta[state.current.topCategory].label;
  els.challengeTitle.textContent = `Beat ${top} with ${action.title.toLowerCase()}`;
  els.challengeCopy.textContent = `${action.copy} This could trim about ${action.saving.toFixed(1)} kg CO2e from a week like this one.`;
}

function getRankedActions() {
  return actions
    .map((action) => ({ ...action, score: scoreAction(action) }))
    .sort((a, b) => b.score - a.score);
}

function scoreAction(action) {
  if (!state.current) return action.saving;
  let score = action.saving;
  if (action.category === state.current.topCategory) score += 9;
  if (action.effort === "Low") score += 4;
  if (action.effort === "Medium") score += 2;
  if (action.id === "ac-flight" && state.current.flightHours === 0) score -= 16;
  if (action.id === "ac-renewable" && state.current.renewable > 0.65) score -= 8;
  if (action.id === "ac-transit" && state.current.transportMode === "cycle") score -= 12;
  return score;
}

function getPlannedSavings() {
  return actions
    .filter((action) => state.planned.has(action.id))
    .reduce((sum, action) => sum + action.saving, 0);
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = `<div class="empty-state">Save this week to start your footprint log.</div>`;
    els.trendLabel.textContent = "No saved weeks yet";
    return;
  }

  const latest = state.history[state.history.length - 1];
  const previous = state.history[state.history.length - 2];
  if (previous) {
    const diff = latest.total - previous.total;
    els.trendLabel.textContent = diff <= 0 ? `${Math.abs(diff).toFixed(1)} kg lower` : `${diff.toFixed(1)} kg higher`;
  } else {
    els.trendLabel.textContent = "First week saved";
  }

  els.historyList.innerHTML = state.history
    .slice()
    .reverse()
    .map((item) => `
      <div class="history-item">
        <div>
          <strong>${item.total.toFixed(1)} kg CO2e</strong>
          <span>${item.top} led the week</span>
        </div>
        <span>${item.date}</span>
      </div>
    `)
    .join("");
}

function drawChart() {
  const canvas = els.historyChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b110d";
  ctx.fillRect(0, 0, width, height);

  const padding = 46;
  const points = state.history.slice(-10);

  ctx.strokeStyle = "rgba(203, 229, 211, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padding + ((height - padding * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#9aa89d";
  ctx.font = "700 22px system-ui, sans-serif";
  if (!points.length) {
    ctx.fillText("No saved weeks yet", padding, height / 2);
    return;
  }

  const max = Math.max(...points.map((item) => item.total), state.current?.total || 0, 20);
  const min = Math.min(...points.map((item) => item.total), state.current?.total || 0, 0);
  const spread = Math.max(max - min, 10);
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((item, index) => {
    const x = points.length > 1 ? padding + xStep * index : width / 2;
    const y = height - padding - ((item.total - min) / spread) * (height - padding * 2);
    return { x, y, item };
  });

  ctx.strokeStyle = "#56d68f";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  coords.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  coords.forEach((point) => {
    ctx.beginPath();
    ctx.fillStyle = "#0b110d";
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#56d68f";
    ctx.stroke();

    ctx.fillStyle = "#f4f8ee";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.fillText(Math.round(point.item.total), point.x - 10, point.y - 16);
  });
}

function saveWeek() {
  if (!state.current) return;
  const date = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  state.history.push({
    date,
    total: state.current.total,
    top: categoryMeta[state.current.topCategory].label
  });
  state.history = state.history.slice(-12);
  localStorage.setItem("carbonCompassHistory", JSON.stringify(state.history));
  renderHistory();
  drawChart();
}

function clearLog() {
  state.history = [];
  localStorage.removeItem("carbonCompassHistory");
  renderHistory();
  drawChart();
}

function setControlValue(id, value) {
  const control = document.querySelector(`#${id}`);
  if (control) control.value = value;
}

function runScenario() {
  const scenario = scenarios[state.scenarioIndex % scenarios.length];
  Object.entries(scenario.values).forEach(([id, value]) => setControlValue(id, value));
  state.scenarioIndex += 1;
  calculate();
  addMessage("bot", `${scenario.label}. Your new top source is ${categoryMeta[state.current.topCategory].label.toLowerCase()}, so I refreshed the best action.`);
}

function planTopActions(count = 3) {
  getRankedActions()
    .slice(0, count)
    .forEach((action) => state.planned.add(action.id));
  localStorage.setItem("carbonCompassPlanned", JSON.stringify([...state.planned]));
  render();
  addMessage("bot", `I planned the top ${count} actions. Together they can save about ${getPlannedSavings().toFixed(1)} kg CO2e per week.`);
}

function focusGuide() {
  document.querySelector("#guide").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => els.chatInput.focus(), 420);
}

function addMessage(sender, text) {
  if (!els.chatMessages) return;
  const message = document.createElement("div");
  const label = document.createElement("small");
  const body = document.createElement("span");
  message.className = `message ${sender}`;
  label.textContent = sender === "user" ? "You" : "EcoGuide";
  body.textContent = text;
  message.append(label, body);
  els.chatMessages.appendChild(message);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function seedChat() {
  if (els.chatMessages.children.length) return;
  addMessage("bot", "Your current footprint is live. The strongest signal will appear here as habits change.");
}

function handleChatSubmit(event) {
  event.preventDefault();
  const prompt = els.chatInput.value.trim();
  if (!prompt) return;
  addMessage("user", prompt);
  els.chatInput.value = "";
  window.setTimeout(() => addMessage("bot", buildBotReply(prompt)), 240);
}

function buildBotReply(prompt) {
  const text = prompt.toLowerCase();
  const data = state.current;
  const topAction = getRankedActions()[0];
  const topCategory = categoryMeta[data.topCategory].label;
  const topValue = data.categories[data.topCategory].toFixed(1);
  const annual = ((data.total * 52) / 1000).toFixed(1);

  if (text.includes("first") || text.includes("start") || text.includes("do")) {
    return `Start with "${topAction.title}". It matches your ${topCategory.toLowerCase()} footprint and can save about ${topAction.saving.toFixed(1)} kg CO2e per week.`;
  }

  if (text.includes("why") || text.includes("high") || text.includes("score") || text.includes("explain")) {
    return `Your score is ${data.total.toFixed(1)} kg CO2e this week. ${topCategory} is the biggest source at ${topValue} kg, and your annual pace is about ${annual} tonnes CO2e.`;
  }

  if (text.includes("7") || text.includes("week") || text.includes("plan")) {
    const plan = getRankedActions()
      .slice(0, 3)
      .map((action, index) => `Day ${index * 2 + 1}: ${action.title}`)
      .join(". ");
    return `${plan}. Save the week after trying them, then keep only the actions that felt repeatable.`;
  }

  if (text.includes("travel") || text.includes("commute") || text.includes("flight")) {
    const travel = data.categories.travel.toFixed(1);
    return `Travel is ${travel} kg this week. The best travel move is "${getBestActionFor("travel").title}", especially if car distance or flight hours are high.`;
  }

  if (text.includes("food") || text.includes("diet") || text.includes("meal")) {
    const food = data.categories.food.toFixed(1);
    return `Food is ${food} kg this week. Add a few plant-forward meals first, because repeatable meals beat complicated diet rules.`;
  }

  if (text.includes("home") || text.includes("electric") || text.includes("energy")) {
    const home = data.categories.home.toFixed(1);
    return `Home energy is ${home} kg this week. Renewable share and appliance timing are your quickest home levers.`;
  }

  if (text.includes("shop") || text.includes("waste") || text.includes("stuff") || text.includes("delivery")) {
    const stuff = data.categories.stuff.toFixed(1);
    return `Stuff and waste are ${stuff} kg this week. Batch deliveries, reuse basics, and repair before replacing.`;
  }

  if (text.includes("save") || text.includes("reduce") || text.includes("cut")) {
    return `Your planned actions save ${getPlannedSavings().toFixed(1)} kg per week. Add "${topAction.title}" if you want the current fastest cut.`;
  }

  return `I would focus on ${topCategory.toLowerCase()} first. The sharpest next move is "${topAction.title}", then track the next week to see if the trend bends down.`;
}

function getBestActionFor(category) {
  return getRankedActions().find((action) => action.category === category) || actions.find((action) => action.category === category);
}

els.form.addEventListener("input", calculate);
els.form.addEventListener("change", calculate);
els.actionGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.action;
  if (state.planned.has(id)) state.planned.delete(id);
  else state.planned.add(id);
  localStorage.setItem("carbonCompassPlanned", JSON.stringify([...state.planned]));
  render();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    renderActions();
  });
});

els.saveWeek.addEventListener("click", saveWeek);
els.clearLog.addEventListener("click", clearLog);
els.demoScenario.addEventListener("click", runScenario);
els.nudgeChat.addEventListener("click", focusGuide);
els.chatLauncher.addEventListener("click", focusGuide);
els.spinChallenge.addEventListener("click", () => {
  state.challengeIndex += 1;
  renderChallenge();
});
els.autoPlan.addEventListener("click", () => planTopActions(3));
els.chatForm.addEventListener("submit", handleChatSubmit);
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    els.chatInput.value = button.dataset.prompt;
    if (els.chatForm.requestSubmit) {
      els.chatForm.requestSubmit();
    } else {
      handleChatSubmit(new Event("submit"));
    }
  });
});

window.addEventListener("resize", drawChart);

calculate();
seedChat();
