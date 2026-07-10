(function () {
  "use strict";

  const controls = {
    mode: document.getElementById("operating-mode"),
    topology: document.getElementById("topology"),
    load: document.getElementById("architecture-load"),
    renewable: document.getElementById("architecture-renewable"),
    bessAvailable: document.getElementById("bess-available"),
    groundingAvailable: document.getElementById("grounding-available")
  };
  const outputs = {
    loadValue: document.getElementById("architecture-load-value"),
    renewableValue: document.getElementById("architecture-renewable-value"),
    reference: document.getElementById("reference-source"),
    served: document.getElementById("served-load"),
    ground: document.getElementById("ground-source"),
    status: document.getElementById("architecture-status"),
    componentDetail: document.getElementById("component-detail"),
    busLabel: document.getElementById("bus-label"),
    renewableLabel: document.getElementById("renewable-label"),
    bessLabel: document.getElementById("bess-label"),
    loadLabel: document.getElementById("load-label"),
    topologyLabel: document.getElementById("topology-label")
  };
  const visual = {
    svg: document.getElementById("architecture-svg"),
    flowGrid: document.getElementById("flow-grid"),
    flowLoad: document.getElementById("flow-load"),
    flowRenewable: document.getElementById("flow-renewable"),
    flowBess: document.getElementById("flow-bess"),
    breaker: document.getElementById("breaker-blade"),
    grid: document.getElementById("node-grid"),
    pcc: document.getElementById("node-pcc"),
    bus: document.getElementById("node-bus"),
    renewable: document.getElementById("node-renewable"),
    bess: document.getElementById("node-bess"),
    load: document.getElementById("node-load"),
    grounding: document.getElementById("node-grounding")
  };

  const details = {
    grid: "<strong>Red/PCC:</strong> unifilar, equivalente de red, SCR/ESCR, fallas, X/R, tensión, frecuencia, recierre y condiciones de reconexión. <span class=\"evidence-tag\">P</span>",
    bus: "<strong>Barra/BOP:</strong> transformadores, cables, switchgear, TC/TP, filtros, taps, límites térmicos, auxiliares y planos IFC/as-built. <span class=\"evidence-tag\">P</span>",
    renewable: "<strong>PV/eólica:</strong> perfiles, pronóstico, rampas, PLL, FRT, curvas P–Q, límites, firmware, PPC y modelos RMS/EMT. <span class=\"evidence-tag\">P</span>",
    bess: "<strong>BESS/PCS:</strong> MW/MWh/MVAr, SOC/SOH, sobrecarga, current limiter, control GFM, BMS, HVAC, modelos y garantías. <span class=\"evidence-tag\">P</span>",
    load: "<strong>Cargas:</strong> P/Q, criticidad, perfiles 1–15 min, motores/inrush, no lineales, tolerancia y secuencia de restauración. <span class=\"evidence-tag\">P</span>",
    grounding: "<strong>Grounding:</strong> neutros, Z0, zig-zag/NGR, malla, resistividad, TOV, paso/contacto y protección de tierra. <span class=\"evidence-tag\">P</span>"
  };

  function format(value, digits) {
    return value.toLocaleString("es-CL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function syncLabels() {
    outputs.loadValue.value = `${format(Number(controls.load.value), 1)} MW`;
    outputs.renewableValue.value = `${format(Number(controls.renewable.value), 1)} MW`;
  }

  function calculate() {
    const state = window.GFMApp.getState();
    const mode = controls.mode.value;
    const loadMW = Number(controls.load.value);
    const renewableMW = Number(controls.renewable.value);
    const bessAvailable = controls.bessAvailable.checked;
    const groundingAvailable = controls.groundingAvailable.checked;
    const bessPowerMW = state.scenario.bess.powerMW;
    let servedMW = loadMW;
    let reference = "Red";
    let ground = "PCC/red";
    let bessFlow = false;

    if (mode === "islanded") {
      reference = bessAvailable ? "BESS GFM" : "Sin referencia";
      ground = groundingAvailable ? "Zig-zag/NGR" : "No definida";
      servedMW = bessAvailable ? Math.min(loadMW, renewableMW + bessPowerMW) : 0;
      bessFlow = bessAvailable && Math.abs(loadMW - renewableMW) > 0.05;
    } else {
      bessFlow = bessAvailable && Math.abs(loadMW - renewableMW) > 0.05;
    }

    return { mode, loadMW, renewableMW, bessAvailable, groundingAvailable, bessPowerMW, servedMW, reference, ground, bessFlow };
  }

  function setFlow(element, active, reverse) {
    element.classList.toggle("is-idle", !active);
    element.classList.toggle("reverse", Boolean(reverse));
  }

  function render() {
    syncLabels();
    const result = calculate();
    const islanded = result.mode === "islanded";
    const deficitMW = Math.max(0, result.loadMW - result.renewableMW);
    const surplusMW = Math.max(0, result.renewableMW - result.loadMW);

    outputs.reference.textContent = result.reference;
    outputs.served.textContent = `${format(result.servedMW, 1)} MW`;
    outputs.ground.textContent = result.ground;
    outputs.renewableLabel.textContent = `${format(result.renewableMW, 1)} MW disponibles`;
    outputs.bessLabel.textContent = `${format(result.bessPowerMW, 1)} MW · ${format(window.GFMApp.getState().scenario.bess.energyMWh, 0)} MWh`;
    outputs.loadLabel.textContent = `${format(result.loadMW, 1)} MW`;
    outputs.topologyLabel.textContent = controls.topology.value === "ac-coupled" ? "Acoplamiento AC" : "Acoplamiento DC conceptual";

    visual.breaker.setAttribute("x2", islanded ? "300" : "304");
    visual.breaker.setAttribute("y2", islanded ? "181" : "205");
    setFlow(visual.flowGrid, !islanded, false);
    setFlow(visual.flowRenewable, result.renewableMW > 0 && result.reference !== "Sin referencia", false);
    setFlow(visual.flowBess, result.bessFlow && result.reference !== "Sin referencia", surplusMW > 0);
    setFlow(visual.flowLoad, result.servedMW > 0, false);

    visual.grid.classList.toggle("is-source", !islanded);
    visual.pcc.classList.toggle("is-warning", islanded);
    visual.bess.classList.toggle("is-source", islanded && result.bessAvailable);
    visual.bess.classList.toggle("is-warning", !result.bessAvailable);
    visual.grounding.classList.toggle("is-warning", islanded && !result.groundingAvailable);
    visual.load.classList.toggle("is-warning", result.servedMW + 0.001 < result.loadMW);

    let message;
    if (result.reference === "Sin referencia") {
      message = "el PCC está abierto y no hay BESS GFM disponible; la ERNC GFL no forma por sí sola una referencia V/f en este caso";
    } else if (result.servedMW < result.loadMW) {
      message = `la isla tiene referencia, pero faltan ${format(result.loadMW - result.servedMW, 1)} MW de capacidad instantánea para servir toda la carga`;
    } else if (islanded && !result.groundingAvailable) {
      message = "la potencia es suficiente, pero la referencia de tierra local no está definida y debe estudiarse antes de operar en isla";
    } else if (islanded) {
      message = `el BESS forma V/f; la ERNC aporta ${format(result.renewableMW, 1)} MW y el BESS cubre ${format(deficitMW, 1)} MW o absorbe hasta ${format(surplusMW, 1)} MW`;
    } else {
      message = "la red externa forma la referencia; el BESS y la ERNC operan dentro de una arquitectura que aún debe validarse con datos de proyecto";
    }
    outputs.status.innerHTML = `<strong>Lectura:</strong> ${message}.`;
    visual.svg.setAttribute("aria-label", `Unifilar ${islanded ? "en isla" : "conectado"}. Referencia ${result.reference}. Carga servida ${format(result.servedMW, 1)} de ${format(result.loadMW, 1)} megawatts.`);

    window.GFMApp.update((state) => {
      state.activeModule = "02";
      state.scenario.architecture.topology = controls.topology.value;
      state.scenario.architecture.bessAvailable = result.bessAvailable;
      state.scenario.architecture.groundingAvailable = result.groundingAvailable;
      state.scenario.grid.pccState = islanded ? "open" : "closed";
      state.scenario.load.activePowerMW = result.loadMW;
      state.scenario.renewable.pvCapacityMW = result.renewableMW * 0.65;
      state.scenario.renewable.windCapacityMW = result.renewableMW * 0.35;
      return state;
    });
  }

  function selectComponent(component) {
    document.querySelectorAll("[data-component]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.component === component));
    });
    Object.entries(visual).forEach(([key, element]) => {
      if (element && element.classList) element.classList.toggle("is-selected", key === component || (component === "grid" && key === "pcc"));
    });
    outputs.componentDetail.innerHTML = details[component];
  }

  Object.values(controls).forEach((control) => {
    control.addEventListener("input", syncLabels);
  });
  document.getElementById("apply-architecture").addEventListener("click", render);
  document.querySelectorAll("[data-component]").forEach((button) => {
    button.addEventListener("click", () => selectComponent(button.dataset.component));
  });

  const state = window.GFMApp.getState();
  controls.mode.value = state.scenario.grid.pccState === "open" ? "islanded" : "connected";
  controls.topology.value = state.scenario.architecture.topology;
  controls.load.value = state.scenario.load.activePowerMW;
  controls.renewable.value = state.scenario.renewable.pvCapacityMW + state.scenario.renewable.windCapacityMW;
  controls.bessAvailable.checked = state.scenario.architecture.bessAvailable;
  controls.groundingAvailable.checked = state.scenario.architecture.groundingAvailable;
  window.GFMApp.markComplete("02");
  selectComponent("grid");
  render();
})();
