const API_BASE =
  window.HOMEATLAS_API_BASE ||
  localStorage.getItem("homeatlasApiBase") ||
  "http://127.0.0.1:8000";

const state = {
  currentStep: 1,
  listings: [],
  filteredListings: [],
  markers: [],
  selectedHomes: [],
  buyerProfile: {
    city: "All cities",
    minPrice: 900000,
    maxPrice: 1500000,
    income: 165000,
    downPayment: 220000,
    cashReserve: 45000,
    monthlyDebts: 0,
    interestRate: 5.09,
    amortYears: 25,
    rateShock: 1.0,
  },
  lastBestFit: null,
};

const dom = {};

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  wireEvents();
  initMap();
  loadBuyerInputs();
  updateBuyerSummary();

  await checkApiHealth();
  await loadListings();

  showStep(1);
  renderCoachPanel();
  renderJourneyPanel();
});

function cacheDom() {
  dom.screens = [...document.querySelectorAll(".screen")];
  dom.stepChips = [...document.querySelectorAll(".step-chip")];
  dom.stepLinks = [...document.querySelectorAll("[data-step-link]")];
  dom.tabButtons = [...document.querySelectorAll(".tab-btn")];
  dom.tabPanels = [...document.querySelectorAll(".tab-panel")];

  dom.apiStatus = document.getElementById("api-status");
  dom.startBtn = document.getElementById("start-btn");
  dom.jumpExploreBtn = document.getElementById("jump-explore-btn");
  dom.restartFlowBtn = document.getElementById("restart-flow-btn");
  dom.toggleAdvancedBtn = document.getElementById("toggle-advanced-btn");
  dom.advancedFields = document.getElementById("advanced-fields");

  dom.cityInput = document.getElementById("city-input");
  dom.setupMinPrice = document.getElementById("setup-min-price");
  dom.setupMaxPrice = document.getElementById("setup-max-price");
  dom.incomeInput = document.getElementById("income-input");
  dom.downPaymentInput = document.getElementById("down-payment-input");
  dom.cashReserveInput = document.getElementById("cash-reserve-input");
  dom.monthlyDebtsInput = document.getElementById("monthly-debts-input");
  dom.interestRateInput = document.getElementById("interest-rate-input");
  dom.amortYearsInput = document.getElementById("amort-years-input");
  dom.rateShockInput = document.getElementById("rate-shock-input");
  dom.buyerSummary = document.getElementById("buyer-summary");

  dom.filterCity = document.getElementById("filter-city");
  dom.filterMinPrice = document.getElementById("filter-min-price");
  dom.filterMaxPrice = document.getElementById("filter-max-price");
  dom.filterBeds = document.getElementById("filter-beds");
  dom.sortView = document.getElementById("sort-view");
  dom.applyFiltersBtn = document.getElementById("apply-filters-btn");
  dom.resetFiltersBtn = document.getElementById("reset-filters-btn");
  dom.homesShown = document.getElementById("homes-shown");
  dom.visibleRange = document.getElementById("visible-range");
  dom.resultsList = document.getElementById("results-list");
  dom.selectedHomesPanel = document.getElementById("selected-homes-panel");
  dom.compareSelectedBtn = document.getElementById("compare-selected-btn");

  dom.comparisonSummary = document.getElementById("comparison-summary");
  dom.comparisonHomeA = document.getElementById("comparison-home-a");
  dom.comparisonHomeB = document.getElementById("comparison-home-b");

  dom.metricBestFit = document.getElementById("metric-best-fit");
  dom.metricReadiness = document.getElementById("metric-readiness");
  dom.metricCash = document.getElementById("metric-cash");
  dom.metricComfort = document.getElementById("metric-comfort");
  dom.readinessChecklist = document.getElementById("readiness-checklist");
  dom.nextStepsCard = document.getElementById("next-steps-card");
  dom.saveScenarioBtn = document.getElementById("save-scenario-btn");

  dom.coachPanel = document.getElementById("coach-panel");
  dom.journeyRouteText = document.getElementById("journey-route-text");
  dom.journeyStageText = document.getElementById("journey-stage-text");
  dom.journeyNextText = document.getElementById("journey-next-text");
}

function wireEvents() {
  dom.startBtn.addEventListener("click", () => showStep(2));
  dom.jumpExploreBtn.addEventListener("click", () => {
    syncSetupInputsToFilters();
    applyFilters();
    showStep(3);
  });

  dom.restartFlowBtn.addEventListener("click", () => showStep(1));

  dom.toggleAdvancedBtn.addEventListener("click", () => {
    dom.advancedFields.classList.toggle("hidden");
    dom.toggleAdvancedBtn.textContent = dom.advancedFields.classList.contains("hidden")
      ? "Show advanced details"
      : "Hide advanced details";
  });

  [
    dom.cityInput,
    dom.setupMinPrice,
    dom.setupMaxPrice,
    dom.incomeInput,
    dom.downPaymentInput,
    dom.cashReserveInput,
    dom.monthlyDebtsInput,
    dom.interestRateInput,
    dom.amortYearsInput,
    dom.rateShockInput,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      readBuyerProfileFromInputs();
      updateBuyerSummary();
      renderCoachPanel();
    });
  });

  document.getElementById("continue-to-explore-btn").addEventListener("click", () => {
    readBuyerProfileFromInputs();
    syncSetupInputsToFilters();
    applyFilters();
    showStep(3);
  });

  dom.applyFiltersBtn.addEventListener("click", applyFilters);
  dom.resetFiltersBtn.addEventListener("click", resetFilters);
  dom.compareSelectedBtn.addEventListener("click", () => {
    if (state.selectedHomes.length === 0) {
      alert("Select at least one home first.");
      return;
    }
    renderCompareScreen();
    showStep(4);
  });

  dom.saveScenarioBtn.addEventListener("click", saveScenario);

  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.next);
      if (next === 4) {
        renderCompareScreen();
      }
      if (next === 5) {
        renderAffordabilityScreen();
      }
      showStep(next);
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showStep(Number(btn.dataset.back)));
  });

  dom.stepLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.stepLink);
      if (step === 4) renderCompareScreen();
      if (step === 5) renderAffordabilityScreen();
      showStep(step);
    });
  });

  dom.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function initMap() {
  state.map = L.map("map", { scrollWheelZoom: true }).setView([43.72, -79.39], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  state.markerLayer = L.layerGroup().addTo(state.map);
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error("Health endpoint failed");
    dom.apiStatus.textContent = "API: connected";
  } catch (error) {
    dom.apiStatus.textContent = "API: offline";
    dom.apiStatus.style.color = "#be123c";
  }
}

async function loadListings() {
  try {
    const response = await fetch(`${API_BASE}/listings`);
    if (!response.ok) throw new Error("Could not load listings");
    const listings = await response.json();

    state.listings = listings.map(normalizeListing);
    populateCitySelects();
    syncSetupInputsToFilters();
    applyFilters();
  } catch (error) {
    dom.resultsList.innerHTML = `
      <div class="empty-state">
        Could not load listings from ${escapeHtml(API_BASE)}. Make sure the backend is running and CORS is enabled.
      </div>
    `;
  }
}

function normalizeListing(listing) {
  return {
    ...listing,
    price: Number(listing.price || 0),
    beds: Number(listing.beds || 0),
    baths: Number(listing.baths || 0),
    sqft: Number(listing.sqft || 0),
    lat: Number(listing.lat || 0),
    lng: Number(listing.lng || 0),
    image_url:
      listing.image_url ||
      `https://placehold.co/800x500/png?text=${encodeURIComponent(listing.address || "HomeAtlas Listing")}`,
  };
}

function populateCitySelects() {
  const cities = ["All cities", ...new Set(state.listings.map((item) => item.city).filter(Boolean))];

  const optionHtml = cities
    .map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`)
    .join("");

  dom.cityInput.innerHTML = optionHtml;
  dom.filterCity.innerHTML = optionHtml;

  dom.cityInput.value = state.buyerProfile.city;
  dom.filterCity.value = state.buyerProfile.city;
}

function loadBuyerInputs() {
  dom.cityInput.value = state.buyerProfile.city;
  dom.setupMinPrice.value = state.buyerProfile.minPrice;
  dom.setupMaxPrice.value = state.buyerProfile.maxPrice;
  dom.incomeInput.value = state.buyerProfile.income;
  dom.downPaymentInput.value = state.buyerProfile.downPayment;
  dom.cashReserveInput.value = state.buyerProfile.cashReserve;
  dom.monthlyDebtsInput.value = state.buyerProfile.monthlyDebts;
  dom.interestRateInput.value = state.buyerProfile.interestRate;
  dom.amortYearsInput.value = state.buyerProfile.amortYears;
  dom.rateShockInput.value = state.buyerProfile.rateShock;
}

function readBuyerProfileFromInputs() {
  state.buyerProfile = {
    city: dom.cityInput.value || "All cities",
    minPrice: toNumber(dom.setupMinPrice.value, 0),
    maxPrice: toNumber(dom.setupMaxPrice.value, Infinity),
    income: toNumber(dom.incomeInput.value, 0),
    downPayment: toNumber(dom.downPaymentInput.value, 0),
    cashReserve: toNumber(dom.cashReserveInput.value, 0),
    monthlyDebts: toNumber(dom.monthlyDebtsInput.value, 0),
    interestRate: toNumber(dom.interestRateInput.value, 5.09),
    amortYears: toNumber(dom.amortYearsInput.value, 25),
    rateShock: toNumber(dom.rateShockInput.value, 1.0),
  };
}

function updateBuyerSummary() {
  const profile = state.buyerProfile;
  const rows = [
    ["City", profile.city],
    ["Price range", `${formatCurrency(profile.minPrice)} – ${profile.maxPrice === Infinity ? "No max" : formatCurrency(profile.maxPrice)}`],
    ["Annual income", formatCurrency(profile.income)],
    ["Down payment", formatCurrency(profile.downPayment)],
    ["Cash reserve", formatCurrency(profile.cashReserve)],
    ["Monthly debts", formatCurrency(profile.monthlyDebts)],
    ["Rate / amortization", `${formatPercent(profile.interestRate)} · ${profile.amortYears} yrs`],
    ["Rate shock", `+${formatPercent(profile.rateShock)}`],
  ];

  dom.buyerSummary.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="summary-row">
          <span class="summary-label">${escapeHtml(label)}</span>
          <strong class="summary-value">${escapeHtml(String(value))}</strong>
        </div>
      `
    )
    .join("");
}

function syncSetupInputsToFilters() {
  dom.filterCity.value = dom.cityInput.value;
  dom.filterMinPrice.value = dom.setupMinPrice.value;
  dom.filterMaxPrice.value = dom.setupMaxPrice.value;
}

function applyFilters() {
  readBuyerProfileFromInputs();

  const city = dom.filterCity.value || "All cities";
  const minPrice = toNumber(dom.filterMinPrice.value, 0);
  const maxPrice = toNumber(dom.filterMaxPrice.value, Infinity);
  const minBeds = toNumber(dom.filterBeds.value, 0);
  const sort = dom.sortView.value;

  state.filteredListings = state.listings.filter((listing) => {
    const cityMatch = city === "All cities" || listing.city === city;
    return cityMatch && listing.price >= minPrice && listing.price <= maxPrice && listing.beds >= minBeds;
  });

  if (sort === "price-asc") {
    state.filteredListings.sort((a, b) => a.price - b.price);
  } else if (sort === "price-desc") {
    state.filteredListings.sort((a, b) => b.price - a.price);
  } else if (sort === "beds-desc") {
    state.filteredListings.sort((a, b) => b.beds - a.beds || b.price - a.price);
  }

  dom.homesShown.textContent = String(state.filteredListings.length);

  if (state.filteredListings.length > 0) {
    const prices = state.filteredListings.map((item) => item.price);
    dom.visibleRange.textContent = `${formatCurrency(Math.min(...prices))} – ${formatCurrency(Math.max(...prices))}`;
  } else {
    dom.visibleRange.textContent = "$0 – $0";
  }

  renderMapMarkers();
  renderResultsList();
  renderSelectedHomes();
  renderCoachPanel();
}

function resetFilters() {
  dom.filterCity.value = state.buyerProfile.city;
  dom.filterMinPrice.value = state.buyerProfile.minPrice;
  dom.filterMaxPrice.value = state.buyerProfile.maxPrice === Infinity ? "" : state.buyerProfile.maxPrice;
  dom.filterBeds.value = "";
  dom.sortView.value = "default";
  applyFilters();
}

function renderMapMarkers() {
  state.markerLayer.clearLayers();

  if (state.filteredListings.length === 0) {
    return;
  }

  const bounds = [];

  state.filteredListings.forEach((listing) => {
    const selected = isSelected(listing.id);
    const marker = L.circleMarker([listing.lat, listing.lng], {
      radius: selected ? 10 : 8,
      weight: 2,
      color: selected ? "#1e3a8a" : "#1d4ed8",
      fillColor: selected ? "#1d4ed8" : "#60a5fa",
      fillOpacity: 0.95,
    });

    marker.bindPopup(`
      <div style="min-width: 200px">
        <strong>${escapeHtml(listing.address)}</strong><br />
        ${escapeHtml(listing.city)}<br />
        ${formatCurrency(listing.price)} · ${listing.beds} bed · ${listing.baths} bath<br />
        <button type="button" data-popup-select="${listing.id}" style="margin-top:8px;padding:8px 10px;border:none;border-radius:10px;background:#dbeafe;color:#1e3a8a;font-weight:700;cursor:pointer;">
          ${selected ? "Remove from shortlist" : "Select for compare"}
        </button>
      </div>
    `);

    marker.on("popupopen", () => {
      setTimeout(() => {
        const popupButton = document.querySelector(`[data-popup-select="${listing.id}"]`);
        if (popupButton) {
          popupButton.addEventListener("click", () => {
            toggleSelectedHome(listing.id);
            state.map.closePopup();
          });
        }
      }, 0);
    });

    marker.on("click", () => toggleSelectedHome(listing.id));
    marker.addTo(state.markerLayer);
    bounds.push([listing.lat, listing.lng]);
  });

  if (bounds.length > 0) {
    state.map.fitBounds(bounds, { padding: [36, 36] });
  }
}

function renderResultsList() {
  if (state.filteredListings.length === 0) {
    dom.resultsList.innerHTML = `<div class="empty-state">No homes match the current filter set.</div>`;
    return;
  }

  dom.resultsList.innerHTML = state.filteredListings
    .map((listing, index) => {
      const selected = isSelected(listing.id);
      return `
        <div class="result-card-entry">
          <div>
            <div class="muted-text">${index + 1}. ${escapeHtml(sortLabel())}</div>
            <h4>${escapeHtml(listing.address)}</h4>
            <div class="result-meta">
              <span>${escapeHtml(listing.city)}</span>
              <span>${listing.beds} bed</span>
              <span>${listing.baths} bath</span>
              <span>${numberWithCommas(listing.sqft)} sqft</span>
            </div>
          </div>

          <div class="result-footer">
            <div>
              <div class="result-price">${formatCurrency(listing.price)}</div>
              <div class="muted-text">Est. monthly ${formatCurrency(estimateMonthlyPayment(listing.price, state.buyerProfile.downPayment, state.buyerProfile.interestRate, state.buyerProfile.amortYears))}</div>
            </div>
            <button class="result-button" type="button" data-select-home="${listing.id}">
              ${selected ? "Remove" : "Select on map"}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll("[data-select-home]").forEach((btn) => {
    btn.addEventListener("click", () => toggleSelectedHome(Number(btn.dataset.selectHome)));
  });
}

function renderSelectedHomes() {
  if (state.selectedHomes.length === 0) {
    dom.selectedHomesPanel.innerHTML = `
      <div class="selected-empty">
        No homes selected yet. Click a marker or a result card to build the shortlist.
      </div>
    `;
    return;
  }

  dom.selectedHomesPanel.innerHTML = state.selectedHomes
    .map((home) => {
      const fit = evaluateHome(home, state.buyerProfile);
      return `
        <article class="selected-home-entry">
          <img src="${escapeHtml(home.image_url)}" alt="${escapeHtml(home.address)}" />
          <div>
            <h4>${escapeHtml(home.address)}</h4>
            <div class="selected-meta">
              <span>${home.beds} bed</span>
              <span>${home.baths} bath</span>
              <span>${numberWithCommas(home.sqft)} sqft</span>
            </div>
          </div>
          <div class="selected-footer">
            <div>
              <div class="result-price">${formatCurrency(home.price)}</div>
              <div class="muted-text">${fit.readinessLabel}</div>
            </div>
            <button class="result-button" type="button" data-remove-home="${home.id}">Remove</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-remove-home]").forEach((btn) => {
    btn.addEventListener("click", () => toggleSelectedHome(Number(btn.dataset.removeHome)));
  });
}

function toggleSelectedHome(listingId) {
  const listing = state.listings.find((item) => item.id === listingId);
  if (!listing) return;

  const existingIndex = state.selectedHomes.findIndex((item) => item.id === listingId);

  if (existingIndex >= 0) {
    state.selectedHomes.splice(existingIndex, 1);
  } else {
    if (state.selectedHomes.length >= 2) {
      state.selectedHomes.shift();
    }
    state.selectedHomes.push(listing);
  }

  renderMapMarkers();
  renderResultsList();
  renderSelectedHomes();
  renderCompareScreen();
  renderAffordabilityScreen();
  renderCoachPanel();
  renderJourneyPanel();
}

function renderCompareScreen() {
  const homes = state.selectedHomes;
  const evaluations = homes.map((home) => evaluateHome(home, state.buyerProfile));

  if (homes.length === 0) {
    dom.comparisonSummary.innerHTML = `<p>Select one or two homes to compare.</p>`;
    dom.comparisonHomeA.innerHTML = `<div class="empty-state">Waiting for a selected home.</div>`;
    dom.comparisonHomeB.innerHTML = `<div class="empty-state">Waiting for a second selected home.</div>`;
    return;
  }

  const bestByScore = [...evaluations].sort((a, b) => b.score - a.score)[0];
  state.lastBestFit = bestByScore;

  const other = evaluations[1] || null;
  const lowerMonthly = [...evaluations].sort((a, b) => a.allInMonthly - b.allInMonthly)[0];
  const lowerCash = [...evaluations].sort((a, b) => a.cashToClose - b.cashToClose)[0];
  const moreResilient = [...evaluations].sort((a, b) => a.qualifyingTdsRatio - b.qualifyingTdsRatio)[0];

  dom.comparisonSummary.innerHTML = `
    <span class="eyebrow">Headline answer</span>
    <h3>${escapeHtml(bestByScore.home.address)} looks like the strongest current fit.</h3>
    <p>${escapeHtml(bestByScore.headline)}</p>

    <div class="comparison-summary-grid">
      <div class="compare-metric">
        <span class="compare-metric-label">Best fit</span>
        <div class="compare-metric-value">${escapeHtml(bestByScore.home.address)}</div>
      </div>
      <div class="compare-metric">
        <span class="compare-metric-label">Lower all-in monthly</span>
        <div class="compare-metric-value">${escapeHtml(lowerMonthly.home.address)}</div>
      </div>
      <div class="compare-metric">
        <span class="compare-metric-label">Less cash needed at close</span>
        <div class="compare-metric-value">${escapeHtml(lowerCash.home.address)}</div>
      </div>
      <div class="compare-metric">
        <span class="compare-metric-label">More resilient</span>
        <div class="compare-metric-value">${escapeHtml(moreResilient.home.address)}</div>
      </div>
    </div>
  `;

  dom.comparisonHomeA.innerHTML = renderPropertyCard(evaluations[0], "Selected home");
  dom.comparisonHomeB.innerHTML = other
    ? renderPropertyCard(other, "Comparison home")
    : `<div class="empty-state">Add a second home from the map to see a true side-by-side comparison.</div>`;
}

function renderPropertyCard(result, label) {
  return `
    <div class="property-visual" style="background-image:
      linear-gradient(180deg, rgba(30, 41, 59, 0.08), rgba(15, 23, 42, 0.72)),
      url('${escapeHtml(result.home.image_url)}');">
      ${escapeHtml(label)}
    </div>
    <div class="property-header">
      <div>
        <span class="eyebrow">${escapeHtml(label)}</span>
        <h3>${escapeHtml(result.home.address)}</h3>
        <div class="property-meta">
          <span>${result.home.beds} bed</span>
          <span>${result.home.baths} bath</span>
          <span>${numberWithCommas(result.home.sqft)} sqft</span>
        </div>
      </div>
      <span class="fit-pill ${scoreClass(result.score).fit}">${escapeHtml(result.readinessLabel)}</span>
    </div>

    <div class="property-price">${formatCurrency(result.home.price)}</div>
    <p>${escapeHtml(result.headline)}</p>

    <div class="summary-row">
      <span class="summary-label">All-in monthly</span>
      <strong class="summary-value">${formatCurrency(result.allInMonthly)}</strong>
    </div>
    <div class="summary-row">
      <span class="summary-label">Cash to close</span>
      <strong class="summary-value">${formatCurrency(result.cashToClose)}</strong>
    </div>
    <div class="summary-row">
      <span class="summary-label">Qualifying rate</span>
      <strong class="summary-value">${formatPercent(result.qualifyingRate)}</strong>
    </div>
    <div class="summary-row">
      <span class="summary-label">Qualifying TDS</span>
      <strong class="summary-value">${formatRatio(result.qualifyingTdsRatio)}</strong>
    </div>
  `;
}

function renderAffordabilityScreen() {
  const best = state.lastBestFit || (state.selectedHomes[0] ? evaluateHome(state.selectedHomes[0], state.buyerProfile) : null);

  if (!best) {
    dom.metricBestFit.innerHTML = `<p>Select at least one home to unlock the affordability screen.</p>`;
    dom.metricReadiness.innerHTML = `<div class="empty-state">No affordability data yet.</div>`;
    dom.metricCash.innerHTML = `<div class="empty-state">No affordability data yet.</div>`;
    dom.metricComfort.innerHTML = `<div class="empty-state">No affordability data yet.</div>`;
    dom.readinessChecklist.innerHTML = `<div class="empty-state">Checklist will appear here once a home is selected.</div>`;
    dom.nextStepsCard.innerHTML = `<div class="empty-state">Next-step guidance will appear here once a home is selected.</div>`;
    return;
  }

  const comfortCeiling = estimateComfortCeiling(state.buyerProfile);
  const classes = scoreClass(best.score);

  dom.metricBestFit.innerHTML = `
    <div class="metric-header">
      <div>
        <span class="eyebrow">Best current fit</span>
        <h3>${escapeHtml(best.home.address)}</h3>
      </div>
      <span class="score-pill ${classes.score}">${best.score}/100</span>
    </div>
    <p>${escapeHtml(best.headline)}</p>
  `;

  dom.metricReadiness.innerHTML = `
    <div class="metric-header">
      <div>
        <span class="eyebrow">Offer-readiness</span>
        <h3>${escapeHtml(best.readinessLabel)}</h3>
      </div>
    </div>
    <div class="metric-value">${best.score}/100</div>
    <div class="metric-support">Modeled from payment pressure, cash-to-close coverage, and qualifying pressure.</div>
  `;

  dom.metricCash.innerHTML = `
    <div class="metric-header">
      <div>
        <span class="eyebrow">Cash to close</span>
        <h3>${formatCurrency(best.cashToClose)}</h3>
      </div>
    </div>
    <div class="metric-support">Estimated minimum down payment plus modeled closing costs for the selected home.</div>
  `;

  dom.metricComfort.innerHTML = `
    <div class="metric-header">
      <div>
        <span class="eyebrow">Comfort ceiling</span>
        <h3>${formatCurrency(comfortCeiling)}</h3>
      </div>
    </div>
    <div class="metric-support">A calmer shopping target based on the current buyer snapshot and modeled payment rules.</div>
  `;

  dom.readinessChecklist.innerHTML = `
    <span class="eyebrow">Checklist</span>
    <h3>Why the file is or is not ready</h3>
    <p>Keep the blockers specific. The user should know exactly what is helping and what is hurting the file.</p>
    <div class="checklist-list">
      ${best.checks
        .map(
          (check) => `
            <div class="checklist-item">
              <div>
                <strong>${escapeHtml(check.label)}</strong>
                <p>${escapeHtml(check.detail)}</p>
              </div>
              <span class="check-status ${check.pass ? "check-pass" : "check-fix"}">${check.pass ? "Pass" : "Fix"}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  dom.nextStepsCard.innerHTML = `
    <span class="eyebrow">How to flip the answer</span>
    <h3>Concrete next steps</h3>
    <p>The strongest portfolio projects do not just report the numbers. They explain the next move clearly.</p>
    <div class="next-steps-list">
      ${best.nextSteps
        .map(
          (step) => `
            <div class="selected-home-entry">
              <p>${escapeHtml(step)}</p>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCoachPanel() {
  const best = state.lastBestFit || (state.selectedHomes[0] ? evaluateHome(state.selectedHomes[0], state.buyerProfile) : null);

  if (!best) {
    dom.coachPanel.innerHTML = `
      <span class="eyebrow">Buyer coach</span>
      <h3>Ask once there is a shortlist</h3>
      <p>The coaching layer becomes more useful after at least one home is selected and the buyer profile is filled out.</p>
    `;
    return;
  }

  dom.coachPanel.innerHTML = `
    <span class="eyebrow">Buyer coach</span>
    <h3>Plain-language summary</h3>
    <p>${escapeHtml(best.home.address)} is the current lead file. ${escapeHtml(best.headline)}</p>

    <div class="coach-list">
      <div class="coach-item">
        <strong>Why is this not fully ready?</strong>
        <p>${escapeHtml(best.coach.why)}</p>
      </div>
      <div class="coach-item">
        <strong>How much cash is really needed?</strong>
        <p>${escapeHtml(best.coach.cash)}</p>
      </div>
      <div class="coach-item">
        <strong>What should happen this week?</strong>
        <p>${escapeHtml(best.coach.week)}</p>
      </div>
    </div>
  `;
}

function renderJourneyPanel() {
  const best = state.lastBestFit || (state.selectedHomes[0] ? evaluateHome(state.selectedHomes[0], state.buyerProfile) : null);

  if (!best) {
    dom.journeyRouteText.textContent = "Owner-occupied purchase";
    dom.journeyStageText.textContent = "Set up the buyer profile";
    dom.journeyNextText.textContent = "Pick a city, set the budget, and choose a listing from the map.";
    return;
  }

  dom.journeyRouteText.textContent = "Owner-occupied purchase";
  dom.journeyStageText.textContent = best.score >= 70 ? "Pre-approval ready" : "Compare and validate fit";
  dom.journeyNextText.textContent = best.nextSteps[0];
}

function setTab(tabName) {
  dom.tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  dom.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
}

function showStep(step) {
  state.currentStep = step;
  dom.screens.forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${step}`));
  dom.stepChips.forEach((chip) => chip.classList.toggle("active", Number(chip.dataset.stepLink) === step));

  if (step === 3 && state.map) {
    setTimeout(() => state.map.invalidateSize(), 100);
  }
  if (step === 4) renderCompareScreen();
  if (step === 5) renderAffordabilityScreen();
}

function isSelected(id) {
  return state.selectedHomes.some((home) => home.id === id);
}

function scoreClass(score) {
  if (score >= 75) return { score: "score-good", fit: "fit-good" };
  if (score >= 45) return { score: "score-mid", fit: "fit-mid" };
  return { score: "score-bad", fit: "fit-bad" };
}

function evaluateHome(home, profile) {
  const minDown = minimumDownPayment(home.price);
  const closingCosts = estimateClosingCosts(home.price);
  const effectiveDown = Math.min(profile.downPayment, home.price);
  const loanAmount = Math.max(home.price - effectiveDown, 0);
  const monthlyBase = mortgagePayment(loanAmount, profile.interestRate, profile.amortYears);
  const monthlyTax = (home.price * 0.006) / 12;
  const heating = 180;
  const allInMonthly = monthlyBase + monthlyTax + heating;
  const grossMonthly = Math.max(profile.income / 12, 1);
  const housingRatio = allInMonthly / grossMonthly;
  const totalDebtRatio = (allInMonthly + profile.monthlyDebts) / grossMonthly;

  const qualifyingRate = Math.max(profile.interestRate + 2, 5.25);
  const qualifyingMonthly = mortgagePayment(loanAmount, qualifyingRate, profile.amortYears) + monthlyTax + heating;
  const qualifyingTdsRatio = (qualifyingMonthly + profile.monthlyDebts) / grossMonthly;

  const cashToClose = minDown + closingCosts;
  const cashAvailable = profile.downPayment + profile.cashReserve;
  const cashAfterClose = cashAvailable - cashToClose;
  const rateShockMonthly =
    mortgagePayment(loanAmount, profile.interestRate + profile.rateShock, profile.amortYears) -
    mortgagePayment(loanAmount, profile.interestRate, profile.amortYears);

  const checks = [
    {
      label: "Minimum down payment covered",
      pass: profile.downPayment >= minDown,
      detail: `Need at least ${formatCurrency(minDown)} for this home.`,
    },
    {
      label: "Cash to close is covered",
      pass: cashAvailable >= cashToClose,
      detail: `Estimated cash to close is ${formatCurrency(cashToClose)}.`,
    },
    {
      label: "Housing-cost pressure",
      pass: housingRatio <= 0.39,
      detail: `Current housing ratio is ${formatRatio(housingRatio)} against a 39% planning guide.`,
    },
    {
      label: "Total-debt pressure",
      pass: totalDebtRatio <= 0.44,
      detail: `Current total debt ratio is ${formatRatio(totalDebtRatio)} against a 44% planning guide.`,
    },
    {
      label: "Qualifying-rate pressure",
      pass: qualifyingTdsRatio <= 0.44,
      detail: `At ${formatPercent(qualifyingRate)}, the modeled qualifying debt ratio is ${formatRatio(qualifyingTdsRatio)}.`,
    },
    {
      label: "Reserve after closing",
      pass: cashAfterClose >= 15000,
      detail: `Cash left after closing is ${formatCurrency(cashAfterClose)}.`,
    },
  ];

  let score = 100;
  if (profile.downPayment < minDown) score -= 40;
  if (cashAvailable < cashToClose) score -= 22;
  if (housingRatio > 0.39) score -= Math.min(18, Math.round((housingRatio - 0.39) * 100));
  if (totalDebtRatio > 0.44) score -= Math.min(18, Math.round((totalDebtRatio - 0.44) * 100));
  if (qualifyingTdsRatio > 0.44) score -= Math.min(24, Math.round((qualifyingTdsRatio - 0.44) * 130));
  if (cashAfterClose < 15000) score -= 12;
  score = Math.max(5, Math.min(100, Math.round(score)));

  const readinessLabel = score >= 75 ? "Ready" : score >= 45 ? "Needs work" : "Not ready";
  const headline =
    profile.downPayment < minDown
      ? `This home still needs about ${formatCurrency(minDown - profile.downPayment)} more down payment just to meet the modeled minimum.`
      : qualifyingTdsRatio > 0.44
      ? `At the modeled qualifying rate of ${formatPercent(qualifyingRate)}, the file still reads above the debt guide.`
      : cashAfterClose < 15000
      ? `The monthly side can work better than the cash plan. Reserve after closing still looks thin.`
      : `This is the cleanest current fit based on payment pressure, cash to close, and modeled resilience.`;

  const comfortCeiling = estimateComfortCeiling(profile);
  const nextSteps = [
    `Shopping nearer ${formatCurrency(comfortCeiling)} should materially improve the file if the current shortlist still feels tight.`,
    `Carry ${escapeHtml(home.address)} into a pre-approval conversation only after the cash-to-close number feels comfortable.`,
    `Use the lower-carry option or reduce other monthly debts first if the qualifying ratio is still elevated.`,
  ];

  return {
    home,
    minDown,
    closingCosts,
    cashToClose,
    cashAfterClose,
    allInMonthly,
    housingRatio,
    totalDebtRatio,
    qualifyingRate,
    qualifyingTdsRatio,
    rateShockMonthly,
    score,
    readinessLabel,
    headline,
    checks,
    nextSteps,
    coach: {
      why: headline,
      cash: `${escapeHtml(home.address)} currently models at ${formatCurrency(cashToClose)} between the minimum down payment and estimated closing costs.`,
      week: `Use ${escapeHtml(home.address)} as the lead file and take a cleaner budget target of about ${formatCurrency(comfortCeiling)} into the next conversation.`,
    },
  };
}

function estimateComfortCeiling(profile) {
  const maxPayment = Math.max((profile.income / 12) * 0.39 - profile.monthlyDebts, 0);
  const down = Math.max(profile.downPayment, 0);
  let low = 250000;
  let high = 2500000;
  let best = low;

  for (let i = 0; i < 32; i += 1) {
    const mid = (low + high) / 2;
    const minDown = minimumDownPayment(mid);
    if (down < minDown) {
      high = mid;
      continue;
    }

    const loan = Math.max(mid - down, 0);
    const monthly = mortgagePayment(loan, Math.max(profile.interestRate + 2, 5.25), profile.amortYears) + (mid * 0.006) / 12 + 180;
    if (monthly <= maxPayment) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round(best / 5000) * 5000;
}

function minimumDownPayment(price) {
  if (price <= 500000) return price * 0.05;
  if (price <= 1500000) return 25000 + (price - 500000) * 0.1;
  return price * 0.2;
}

function estimateClosingCosts(price) {
  const ontarioLtt =
    Math.min(price, 55000) * 0.005 +
    Math.max(Math.min(price - 55000, 195000), 0) * 0.01 +
    Math.max(Math.min(price - 250000, 150000), 0) * 0.015 +
    Math.max(Math.min(price - 400000, 2000000), 0) * 0.02 +
    Math.max(price - 2000000, 0) * 0.025;

  const torontoLtt = ontarioLtt;
  const legalAndMisc = 3100;
  return ontarioLtt + torontoLtt + legalAndMisc;
}

function estimateMonthlyPayment(price, downPayment, rate, years) {
  const effectiveDown = Math.min(downPayment, price);
  const loan = Math.max(price - effectiveDown, 0);
  const payment = mortgagePayment(loan, rate, years);
  const monthlyTax = (price * 0.006) / 12;
  return Math.round(payment + monthlyTax + 180);
}

function mortgagePayment(principal, annualRatePercent, years) {
  if (principal <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  const numberOfPayments = years * 12;
  if (monthlyRate === 0) return principal / numberOfPayments;
  return (
    principal *
    ((monthlyRate * (1 + monthlyRate) ** numberOfPayments) / ((1 + monthlyRate) ** numberOfPayments - 1))
  );
}

async function saveScenario() {
  const best = state.lastBestFit || (state.selectedHomes[0] ? evaluateHome(state.selectedHomes[0], state.buyerProfile) : null);
  if (!best) {
    alert("Select a home first.");
    return;
  }

  const scenarioName = prompt("Scenario name", `HomeAtlas scenario - ${best.home.address}`);
  if (!scenarioName) return;

  const payload = {
    scenario_name: scenarioName,
    property_id: best.home.id,
    property_address: best.home.address,
    annual_income: state.buyerProfile.income,
    monthly_debts: state.buyerProfile.monthlyDebts,
    down_payment: state.buyerProfile.downPayment,
    interest_rate: state.buyerProfile.interestRate,
    amort_years: state.buyerProfile.amortYears,
    property_tax: Number((best.home.price * 0.006).toFixed(2)),
    heating_cost: 180,
    condo_fee: 0,
  };

  try {
    const response = await fetch(`${API_BASE}/saved-scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Could not save scenario");
    alert("Scenario saved successfully.");
  } catch (error) {
    alert("Could not save the scenario. Check that the backend is running.");
  }
}

function sortLabel() {
  const map = {
    default: "Default order",
    "price-asc": "Price low to high",
    "price-desc": "Price high to low",
    "beds-desc": "Most bedrooms",
  };
  return map[dom.sortView.value] || "Sorted";
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(safeValue);
}

function formatPercent(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(2)}%`;
}

function formatRatio(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${(safeValue * 100).toFixed(1)}%`;
}

function numberWithCommas(value) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(value || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
