(function () {
  const STORAGE_KEY = "planejamento_gastos_v1";
  const CARDS = ["Itaú", "Nubank", "Mercado Pago"];

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const uid = () => "id-" + Math.random().toString(36).slice(2, 10);

  const fmtBRL = (val) => {
    const num = round2(val);
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  let state = loadState();
  let activeCardFilter = "Todos";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.months) && parsed.months.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Erro ao ler localStorage, usando dados iniciais.", e);
    }
    return structuredClone(window.INITIAL_DATA);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getMonth() {
    return state.months.find((m) => m.id === state.selectedMonthId) || state.months[0];
  }

  // Fórmulas centrais (espelhando a planilha original + cartões)
  function computeMonth(m) {
    const entrada15 = round2(m.entrada15);
    const entrada30 = round2(m.entrada30);
    const totalEntradas = round2(entrada15 + entrada30);

    const saidas15 = round2(m.gastos15.reduce((acc, g) => acc + round2(g.valor), 0));
    const saldo15 = round2(entrada15 - saidas15);

    const cardTotals = {};
    CARDS.forEach((c) => {
      cardTotals[c] = round2(
        m.cartoes.filter((item) => item.cartao === c).reduce((acc, item) => acc + round2(item.valor), 0)
      );
    });
    const totalCartoes = round2(Object.values(cardTotals).reduce((a, b) => a + b, 0));

    const manual30 = round2(m.gastos30.reduce((acc, g) => acc + round2(g.valor), 0));
    const saidas30 = round2(totalCartoes + manual30);
    const saldo30 = round2(entrada30 - saidas30);

    const totalSaidas = round2(saidas15 + saidas30);
    const saldoBase = round2(saldo15 + saldo30);

    const totalExtras = round2(m.extras.reduce((acc, e) => acc + round2(e.valor), 0));
    const totalMeta = round2(round2(m.meta15) + round2(m.meta30));
    const saldoLivre = round2(saldoBase - totalExtras - totalMeta);

    const pctComprometido = totalEntradas > 0 ? Math.min(100, Math.max(0, (totalSaidas / totalEntradas) * 100)) : 0;
    const pctMeta = totalEntradas > 0 ? (totalMeta / totalEntradas) * 100 : 0;

    return {
      entrada15,
      entrada30,
      totalEntradas,
      saidas15,
      saldo15,
      cardTotals,
      totalCartoes,
      saidas30,
      saldo30,
      totalSaidas,
      saldoBase,
      totalExtras,
      totalMeta,
      saldoLivre,
      pctComprometido,
      pctMeta,
    };
  }

  // DOM refs
  const el = {
    monthSelect: document.getElementById("monthSelect"),
    btnNewMonth: document.getElementById("btnNewMonth"),
    btnExport: document.getElementById("btnExport"),
    inputImport: document.getElementById("inputImport"),
    btnTheme: document.getElementById("btnTheme"),

    kpiEntradas: document.getElementById("kpiEntradas"),
    kpiEntradasSub: document.getElementById("kpiEntradasSub"),
    kpiSaidas: document.getElementById("kpiSaidas"),
    kpiProgressBar: document.getElementById("kpiProgressBar"),
    kpiSaidasSub: document.getElementById("kpiSaidasSub"),
    kpiSaldoBase: document.getElementById("kpiSaldoBase"),
    kpiSaldoBaseSub: document.getElementById("kpiSaldoBaseSub"),
    kpiSaldoLivre: document.getElementById("kpiSaldoLivre"),
    kpiSaldoLivreSub: document.getElementById("kpiSaldoLivreSub"),

    entrada15: document.getElementById("entrada15"),
    entrada30: document.getElementById("entrada30"),
    saidas15: document.getElementById("saidas15"),
    saldo15: document.getElementById("saldo15"),
    saidas30: document.getElementById("saidas30"),
    saldo30: document.getElementById("saldo30"),
    list15: document.getElementById("list15"),
    list30: document.getElementById("list30"),
    formAdd15: document.getElementById("formAdd15"),
    formAdd30: document.getElementById("formAdd30"),

    simRange: document.getElementById("simRange"),
    simAmountLabel: document.getElementById("simAmountLabel"),
    simSaldo15: document.getElementById("simSaldo15"),
    simSaldo30: document.getElementById("simSaldo30"),
    btnSimAuto: document.getElementById("btnSimAuto"),

    cardFilters: document.getElementById("cardFilters"),
    cardTotalsStrip: document.getElementById("cardTotalsStrip"),
    formAddCardItem: document.getElementById("formAddCardItem"),
    cardsTableBody: document.getElementById("cardsTableBody"),

    totalExtras: document.getElementById("totalExtras"),
    listExtras: document.getElementById("listExtras"),
    formAddExtra: document.getElementById("formAddExtra"),
    vltDias: document.getElementById("vltDias"),
    vltTarifa: document.getElementById("vltTarifa"),
    btnApplyVlt: document.getElementById("btnApplyVlt"),

    meta15: document.getElementById("meta15"),
    meta30: document.getElementById("meta30"),
    totalMeta: document.getElementById("totalMeta"),
    metaPercent: document.getElementById("metaPercent"),
    metaLivreMes: document.getElementById("metaLivreMes"),
    metaLivreSemana: document.getElementById("metaLivreSemana"),
    btnResetData: document.getElementById("btnResetData"),

    modalNewMonth: document.getElementById("modalNewMonth"),
    formNewMonth: document.getElementById("formNewMonth"),
    btnCancelMonth: document.getElementById("btnCancelMonth"),
  };

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme || "dark");
    el.btnTheme.textContent = state.theme === "light" ? "🌙" : "☀️";
  }

  function render() {
    applyTheme();
    const m = getMonth();
    const c = computeMonth(m);

    // Month selector
    el.monthSelect.innerHTML = state.months
      .map((mo) => `<option value="${mo.id}" ${mo.id === m.id ? "selected" : ""}>${escapeHtml(mo.label)}</option>`)
      .join("");

    // KPIs
    el.kpiEntradas.textContent = fmtBRL(c.totalEntradas);
    el.kpiEntradasSub.textContent = `Dia 15: ${fmtBRL(c.entrada15)} · Dia 30: ${fmtBRL(c.entrada30)}`;

    el.kpiSaidas.textContent = fmtBRL(c.totalSaidas);
    el.kpiProgressBar.style.width = `${c.pctComprometido.toFixed(1)}%`;
    el.kpiSaidasSub.textContent = `${c.pctComprometido.toFixed(1)}% da renda comprometida`;

    el.kpiSaldoBase.textContent = fmtBRL(c.saldoBase);
    el.kpiSaldoBase.className = `kpi-value ${c.saldoBase >= 0 ? "positive" : "negative"}`;
    el.kpiSaldoBaseSub.textContent = `Dia 15: ${fmtBRL(c.saldo15)} · Dia 30: ${fmtBRL(c.saldo30)}`;

    el.kpiSaldoLivre.textContent = fmtBRL(c.saldoLivre);
    el.kpiSaldoLivre.className = `kpi-value ${c.saldoLivre >= 0 ? "accent" : "negative"}`;
    el.kpiSaldoLivreSub.textContent = `Pix: ${fmtBRL(c.totalExtras)} · Guardar: ${fmtBRL(c.totalMeta)}`;

    // Inputs de entrada (evita perder cursor se focado)
    if (document.activeElement !== el.entrada15) el.entrada15.value = m.entrada15;
    if (document.activeElement !== el.entrada30) el.entrada30.value = m.entrada30;

    el.saidas15.textContent = fmtBRL(c.saidas15);
    el.saldo15.textContent = fmtBRL(c.saldo15);
    el.saldo15.className = c.saldo15 >= 0 ? "positive" : "negative";

    el.saidas30.textContent = fmtBRL(c.saidas30);
    el.saldo30.textContent = fmtBRL(c.saldo30);
    el.saldo30.className = c.saldo30 >= 0 ? "positive" : "negative";

    // Lista Dia 15
    renderExpenseList(el.list15, m.gastos15, "gastos15", false);

    // Lista Dia 30 (Cartões automáticos + itens manuais/reembolsos)
    renderWindow30List(m, c);

    // Simulador
    const maxSim = Math.max(0, Math.floor(c.saldo15));
    el.simRange.max = String(maxSim);
    const simVal = Math.min(maxSim, round2(m.simReserva15 || 0));
    el.simRange.value = String(simVal);
    el.simAmountLabel.textContent = fmtBRL(simVal);
    el.simSaldo15.textContent = fmtBRL(c.saldo15 - simVal);
    el.simSaldo30.textContent = fmtBRL(c.saldo30 + simVal);

    // Aba Cartões
    renderCardsTab(m, c);

    // Aba Extras & Metas
    el.totalExtras.textContent = fmtBRL(c.totalExtras);
    renderExpenseList(el.listExtras, m.extras, "extras", false);

    if (document.activeElement !== el.meta15) el.meta15.value = m.meta15;
    if (document.activeElement !== el.meta30) el.meta30.value = m.meta30;
    el.totalMeta.textContent = fmtBRL(c.totalMeta);
    el.metaPercent.textContent = `${c.pctMeta.toFixed(1)}%`;
    el.metaLivreMes.textContent = fmtBRL(c.saldoLivre);
    el.metaLivreSemana.textContent = fmtBRL(c.saldoLivre / 4);
  }

  function renderExpenseList(container, items, listKey) {
    if (!items.length) {
      container.innerHTML = `<li class="expense-item"><span class="muted">Nenhum lançamento ainda.</span></li>`;
      return;
    }
    container.innerHTML = items
      .map((item) => {
        const isCredit = item.valor < 0;
        return `
          <li class="expense-item ${item.pago ? "is-paid" : ""}">
            <div class="expense-left">
              <input type="checkbox" class="expense-check" data-list="${listKey}" data-id="${item.id}" ${item.pago ? "checked" : ""} />
              <div>
                <div class="expense-name">${escapeHtml(item.nome)}</div>
                ${isCredit ? `<div class="expense-meta">Crédito / Reembolso</div>` : ""}
              </div>
            </div>
            <div class="expense-right">
              <span class="expense-val ${isCredit ? "positive" : ""}">${fmtBRL(item.valor)}</span>
              <button class="icon-del" data-del-list="${listKey}" data-id="${item.id}" title="Remover">✕</button>
            </div>
          </li>
        `;
      })
      .join("");
  }

  function renderWindow30List(m, c) {
    const autoCardsHtml = CARDS.filter((card) => c.cardTotals[card] > 0)
      .map((card) => {
        const count = m.cartoes.filter((x) => x.cartao === card).length;
        return `
          <li class="expense-item">
            <div class="expense-left">
              <span class="badge ${cardBadgeClass(card)}">${card}</span>
              <div>
                <div class="expense-name">Fatura ${card}</div>
                <div class="expense-meta">${count} lançamento(s) · editável na aba Cartões</div>
              </div>
            </div>
            <div class="expense-right">
              <span class="expense-val">${fmtBRL(c.cardTotals[card])}</span>
            </div>
          </li>
        `;
      })
      .join("");

    const manualHtml = m.gastos30
      .map((item) => {
        const isCredit = item.valor < 0;
        return `
          <li class="expense-item ${item.pago ? "is-paid" : ""}">
            <div class="expense-left">
              <input type="checkbox" class="expense-check" data-list="gastos30" data-id="${item.id}" ${item.pago ? "checked" : ""} />
              <div>
                <div class="expense-name">${escapeHtml(item.nome)}</div>
                ${isCredit ? `<div class="expense-meta">Reembolso / Abatimento</div>` : ""}
              </div>
            </div>
            <div class="expense-right">
              <span class="expense-val ${isCredit ? "positive" : ""}">${fmtBRL(item.valor)}</span>
              <button class="icon-del" data-del-list="gastos30" data-id="${item.id}" title="Remover">✕</button>
            </div>
          </li>
        `;
      })
      .join("");

    el.list30.innerHTML =
      autoCardsHtml + manualHtml || `<li class="expense-item"><span class="muted">Nenhum lançamento no dia 30.</span></li>`;
  }

  function renderCardsTab(m, c) {
    // Totals strip
    el.cardTotalsStrip.innerHTML = `
      <div class="card-mini-box"><span>Total dos Cartões</span><strong>${fmtBRL(c.totalCartoes)}</strong></div>
      <div class="card-mini-box"><span>Itaú</span><strong>${fmtBRL(c.cardTotals["Itaú"])}</strong></div>
      <div class="card-mini-box"><span>Nubank</span><strong>${fmtBRL(c.cardTotals["Nubank"])}</strong></div>
      <div class="card-mini-box"><span>Mercado Pago</span><strong>${fmtBRL(c.cardTotals["Mercado Pago"])}</strong></div>
    `;

    const filtered =
      activeCardFilter === "Todos" ? m.cartoes : m.cartoes.filter((item) => item.cartao === activeCardFilter);

    if (!filtered.length) {
      el.cardsTableBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px;">Nenhum lançamento neste filtro.</td></tr>`;
      return;
    }

    el.cardsTableBody.innerHTML = filtered
      .sort((a, b) => b.valor - a.valor)
      .map((item) => {
        const isLast = item.tipo === "Parcelamento" && item.parcelaAtual >= item.totalParcelas;
        const remainingParc =
          item.tipo === "Parcelamento" ? Math.max(1, item.totalParcelas - item.parcelaAtual + 1) : 1;
        const restante = round2(item.valor * remainingParc);
        const parcLabel =
          item.tipo === "Parcelamento"
            ? `${item.parcelaAtual}/${item.totalParcelas}${isLast ? " 🎉" : ""}`
            : item.tipo === "Mensalidade"
            ? "Recorrente"
            : "1/1";

        return `
          <tr>
            <td><span class="badge ${cardBadgeClass(item.cartao)}">${item.cartao}</span></td>
            <td>
              <input class="editable-title" data-edit-card="${item.id}" value="${escapeAttr(item.item)}" />
              ${item.fatura ? `<span class="fatura-sub">${escapeHtml(item.fatura)}</span>` : ""}
            </td>
            <td><span class="badge ${tipoBadgeClass(item.tipo)}">${item.tipo}</span></td>
            <td>${parcLabel}</td>
            <td>${escapeHtml(item.responsavel || "Eu")}</td>
            <td class="num"><strong>${fmtBRL(item.valor)}</strong></td>
            <td class="num muted">${fmtBRL(restante)}</td>
            <td class="num">
              <button class="icon-del" data-del-card="${item.id}" title="Excluir lançamento">✕</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function cardBadgeClass(card) {
    if (card === "Itaú") return "badge-orange";
    if (card === "Nubank") return "badge-purple";
    return "badge-blue";
  }

  function tipoBadgeClass(tipo) {
    if (tipo === "Parcelamento") return "badge-orange";
    if (tipo === "Mensalidade") return "badge-red";
    return "badge-blue";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  // Event Listeners
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  el.monthSelect.addEventListener("change", () => {
    state.selectedMonthId = el.monthSelect.value;
    saveState();
    render();
  });

  el.btnTheme.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    saveState();
    applyTheme();
  });

  el.entrada15.addEventListener("input", () => {
    getMonth().entrada15 = round2(el.entrada15.value);
    saveState();
    render();
  });

  el.entrada30.addEventListener("input", () => {
    getMonth().entrada30 = round2(el.entrada30.value);
    saveState();
    render();
  });

  el.meta15.addEventListener("input", () => {
    getMonth().meta15 = round2(el.meta15.value);
    saveState();
    render();
  });

  el.meta30.addEventListener("input", () => {
    getMonth().meta30 = round2(el.meta30.value);
    saveState();
    render();
  });

  function bindQuickAdd(form, listKey) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const nome = String(fd.get("nome") || "").trim();
      const valor = round2(fd.get("valor"));
      if (!nome || isNaN(valor)) return;
      getMonth()[listKey].push({ id: uid(), nome, valor, pago: false });
      form.reset();
      saveState();
      render();
    });
  }

  bindQuickAdd(el.formAdd15, "gastos15");
  bindQuickAdd(el.formAdd30, "gastos30");
  bindQuickAdd(el.formAddExtra, "extras");

  // Delegated check / delete for lists
  document.addEventListener("change", (e) => {
    const chk = e.target.closest(".expense-check");
    if (chk) {
      const m = getMonth();
      const item = m[chk.dataset.list].find((x) => x.id === chk.dataset.id);
      if (item) {
        item.pago = chk.checked;
        saveState();
        render();
      }
    }

    const editCard = e.target.closest("[data-edit-card]");
    if (editCard) {
      const m = getMonth();
      const item = m.cartoes.find((x) => x.id === editCard.dataset.editCard);
      if (item) {
        item.item = editCard.value.trim() || item.item;
        saveState();
      }
    }
  });

  document.addEventListener("click", (e) => {
    const delListBtn = e.target.closest("[data-del-list]");
    if (delListBtn) {
      const m = getMonth();
      m[delListBtn.dataset.delList] = m[delListBtn.dataset.delList].filter((x) => x.id !== delListBtn.dataset.id);
      saveState();
      render();
      return;
    }

    const delCardBtn = e.target.closest("[data-del-card]");
    if (delCardBtn) {
      const m = getMonth();
      m.cartoes = m.cartoes.filter((x) => x.id !== delCardBtn.dataset.delCard);
      saveState();
      render();
    }
  });

  // Card Filters
  el.cardFilters.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    el.cardFilters.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    activeCardFilter = pill.dataset.card;
    render();
  });

  // Add Card Item
  el.formAddCardItem.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(el.formAddCardItem);
    const tipo = String(fd.get("tipo"));
    const parcelaAtual = Math.max(1, parseInt(fd.get("parcelaAtual"), 10) || 1);
    const totalParcelas = Math.max(parcelaAtual, parseInt(fd.get("totalParcelas"), 10) || 1);
    getMonth().cartoes.push({
      id: uid(),
      cartao: String(fd.get("cartao")),
      item: String(fd.get("item")).trim(),
      fatura: String(fd.get("fatura") || "").trim(),
      tipo,
      parcelaAtual: tipo === "Parcelamento" ? parcelaAtual : 1,
      totalParcelas: tipo === "Parcelamento" ? totalParcelas : 1,
      valor: round2(fd.get("valor")),
      responsavel: String(fd.get("responsavel")),
    });
    el.formAddCardItem.reset();
    saveState();
    render();
  });

  // Simulator
  el.simRange.addEventListener("input", () => {
    getMonth().simReserva15 = round2(el.simRange.value);
    saveState();
    render();
  });

  el.btnSimAuto.addEventListener("click", () => {
    const m = getMonth();
    const c = computeMonth(m);
    const diff = round2((c.saldo15 - c.saldo30) / 2);
    m.simReserva15 = Math.max(0, Math.round(diff / 10) * 10);
    saveState();
    render();
  });

  // VLT Calculator
  el.btnApplyVlt.addEventListener("click", () => {
    const dias = Math.max(0, parseInt(el.vltDias.value, 10) || 0);
    const tarifa = round2(el.vltTarifa.value);
    const total = round2(dias * tarifa);
    const m = getMonth();
    const nome = `Transporte VLT (${dias} dias × ${fmtBRL(tarifa)})`;
    const existing = m.extras.find((x) => x.id === "ext-vlt" || x.nome.toLowerCase().includes("vlt"));
    if (existing) {
      existing.nome = nome;
      existing.valor = total;
    } else {
      m.extras.unshift({ id: "ext-vlt", nome, valor: total, pago: false });
    }
    saveState();
    render();
  });

  // New Month Modal (com avanço automático de parcelas!)
  el.btnNewMonth.addEventListener("click", () => el.modalNewMonth.classList.remove("hidden"));
  el.btnCancelMonth.addEventListener("click", () => el.modalNewMonth.classList.add("hidden"));
  el.modalNewMonth.querySelector(".modal-backdrop").addEventListener("click", () => {
    el.modalNewMonth.classList.add("hidden");
  });

  el.formNewMonth.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(el.formNewMonth);
    const label = String(fd.get("label") || "").trim();
    const clone = fd.get("cloneCurrent") === "on";
    if (!label) return;

    const curr = getMonth();
    const newId = "m-" + Date.now();
    let newMonth;

    if (clone) {
      // Avança parcelas ativas e mantém mensalidades; descarta avulsos e parcelas encerradas
      const nextCartoes = curr.cartoes
        .filter((item) => {
          if (item.tipo === "Mensalidade") return true;
          if (item.tipo === "Parcelamento") return item.parcelaAtual < item.totalParcelas;
          return false;
        })
        .map((item) => ({
          ...item,
          id: uid(),
          parcelaAtual: item.tipo === "Parcelamento" ? item.parcelaAtual + 1 : item.parcelaAtual,
        }));

      newMonth = {
        id: newId,
        label,
        entrada15: curr.entrada15,
        entrada30: curr.entrada30,
        gastos15: curr.gastos15.map((g) => ({ ...g, id: uid(), pago: false })),
        gastos30: [],
        cartoes: nextCartoes,
        extras: curr.extras
          .filter((x) => x.nome.toLowerCase().includes("vlt"))
          .map((x) => ({ ...x, id: "ext-vlt", pago: false })),
        meta15: curr.meta15,
        meta30: curr.meta30,
        simReserva15: 0,
      };
    } else {
      newMonth = {
        id: newId,
        label,
        entrada15: curr.entrada15,
        entrada30: curr.entrada30,
        gastos15: [],
        gastos30: [],
        cartoes: [],
        extras: [],
        meta15: 0,
        meta30: 0,
        simReserva15: 0,
      };
    }

    state.months.push(newMonth);
    state.selectedMonthId = newId;
    saveState();
    el.formNewMonth.reset();
    el.modalNewMonth.classList.add("hidden");
    render();
  });

  // Export / Import / Reset
  el.btnExport.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-gastos-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  el.inputImport.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && Array.isArray(parsed.months)) {
          state = parsed;
          saveState();
          render();
          alert("Backup restaurado com sucesso!");
        }
      } catch {
        alert("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  el.btnResetData.addEventListener("click", () => {
    if (!confirm("Restaurar os dados iniciais de Novembro e Dezembro 2026?")) return;
    state = structuredClone(window.INITIAL_DATA);
    saveState();
    render();
  });

  render();
})();
