/* ============================================================
   Controle Financeiro — app.js
   Dados salvos localmente no dispositivo (localStorage), então
   o app funciona 100% offline depois do primeiro carregamento.
   ============================================================ */

const APP_VERSION = "1.0.0";

// >>> Ajuste aqui para o seu repositório no GitHub (usuario/repositorio)
// usado pelo botão "Verificar atualização" (compara com a última release)
const GITHUB_REPO = "seu-usuario/controle-financeiro";

const STORAGE_KEY = "cf_entries_v1";
const THEME_KEY = "cf_theme_v1";

const GANHO_LABELS = { uber: "Uber", "99": "99" };
const GASTO_LABELS = {
  gasolina: "Gasolina",
  borracharia: "Borracharia",
  pecas: "Peças",
  lavagem: "Lavagem",
  outros: "Outros",
};

/* ---------------- storage ---------------- */
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
let entries = loadEntries();

function addEntry(entry) {
  entries.unshift(entry);
  saveEntries(entries);
}
function deleteEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  saveEntries(entries);
  renderToday();
  renderHome();
  renderStats();
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------------- currency mask ---------------- */
// digita apenas números; formata como R$ 0,00 em tempo real
function attachMoneyMask(input) {
  input.addEventListener("input", () => {
    let digits = input.value.replace(/\D/g, "");
    if (!digits) {
      input.value = "";
      input.dataset.raw = "0";
      input.classList.remove("invalid");
      return;
    }
    digits = digits.replace(/^0+(?=\d)/, "");
    const cents = digits.padStart(3, "0");
    const intPart = cents.slice(0, -2);
    const decPart = cents.slice(-2);
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    input.value = `R$ ${withThousands},${decPart}`;
    input.dataset.raw = (parseInt(cents, 10) / 100).toString();
    input.classList.remove("invalid");
  });
}
function readMoneyValue(input) {
  const val = parseFloat(input.dataset.raw || "0");
  return isNaN(val) ? 0 : val;
}
function clearMoneyInput(input) {
  input.value = "";
  input.dataset.raw = "0";
}
function fmtBRL(n) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ---------------- dates ---------------- */
function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // segunda-feira como início
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function isInPeriod(dateStr, period, refDate) {
  if (period === "diario") return dateStr === refDate;
  if (period === "semanal") {
    const start = startOfWeek(refDate);
    const end = new Date(start + "T00:00:00");
    end.setDate(end.getDate() + 6);
    return dateStr >= start && dateStr <= end.toISOString().slice(0, 10);
  }
  if (period === "mensal") return dateStr.slice(0, 7) === refDate.slice(0, 7);
  return true;
}

/* ---------------- toast ---------------- */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------------- tabs ---------------- */
function goToTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === `tab-${tab}`);
  });
}
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => goToTab(btn.dataset.tab));
});
document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => goToTab(btn.dataset.goto));
});

/* ---------------- diárias: date + entry cards ---------------- */
const dateInput = document.getElementById("entry-date");
dateInput.value = todayISO();
dateInput.addEventListener("change", renderToday);

document.querySelectorAll(".entry-card").forEach((card) => {
  const input = card.querySelector(".money-input");
  const btn = card.querySelector(".add-btn");
  attachMoneyMask(input);

  btn.addEventListener("click", () => {
    const val = readMoneyValue(input);
    if (!val || val <= 0) {
      input.classList.add("invalid");
      showToast("Informe um valor válido maior que zero.");
      return;
    }
    const kind = card.dataset.kind;
    const key = card.dataset.key;
    addEntry({
      id: uid(),
      kind,
      key,
      date: dateInput.value || todayISO(),
      amount: val,
      createdAt: Date.now(),
    });
    clearMoneyInput(input);
    showToast(
      kind === "ganho"
        ? `Ganho de ${GANHO_LABELS[key]} adicionado.`
        : `Gasto com ${GASTO_LABELS[key]} adicionado.`
    );
    renderToday();
    renderHome();
    renderStats();
  });
});

function labelFor(kind, key) {
  return kind === "ganho" ? GANHO_LABELS[key] : GASTO_LABELS[key];
}

function renderToday() {
  const list = document.getElementById("today-list");
  const day = dateInput.value || todayISO();
  const items = entries
    .filter((e) => e.date === day)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">Nenhum lançamento neste dia.</div>`;
    return;
  }
  list.innerHTML = items
    .map((e) => {
      const time = new Date(e.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
        <div class="list-item">
          <span class="li-title">${labelFor(e.kind, e.key)}</span>
          <span class="li-time">${time}</span>
          <span class="li-value ${e.kind === "ganho" ? "earn" : "spend"}">
            ${e.kind === "ganho" ? "+" : "-"}${fmtBRL(e.amount)}
          </span>
          <button class="li-del" data-id="${e.id}" aria-label="Excluir">
            <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0v12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
    })
    .join("");

  list.querySelectorAll(".li-del").forEach((b) => {
    b.addEventListener("click", () => deleteEntry(b.dataset.id));
  });
}

/* ---------------- home summary (hoje) ---------------- */
function renderHome() {
  const day = todayISO();
  const todays = entries.filter((e) => e.date === day);
  const ganhos = todays.filter((e) => e.kind === "ganho").reduce((s, e) => s + e.amount, 0);
  const gastos = todays.filter((e) => e.kind === "gasto").reduce((s, e) => s + e.amount, 0);
  document.getElementById("home-ganhos").textContent = fmtBRL(ganhos);
  document.getElementById("home-gastos").textContent = fmtBRL(gastos);
  document.getElementById("home-saldo").textContent = fmtBRL(ganhos - gastos);
}

/* ---------------- estatísticas ---------------- */
let statPeriod = "semanal";
let statPlatform = "todas";

document.querySelectorAll("#period-filter button").forEach((b) => {
  b.addEventListener("click", () => {
    statPeriod = b.dataset.value;
    document.querySelectorAll("#period-filter button").forEach((x) => x.classList.toggle("active", x === b));
    renderStats();
  });
});
document.querySelectorAll("#platform-filter button").forEach((b) => {
  b.addEventListener("click", () => {
    statPlatform = b.dataset.value;
    document.querySelectorAll("#platform-filter button").forEach((x) => x.classList.toggle("active", x === b));
    renderStats();
  });
});

function matchesPlatform(e) {
  if (statPlatform === "todas") return true;
  if (e.kind === "gasto") return true; // gastos não têm plataforma, sempre entram
  return e.key === statPlatform;
}

function renderStats() {
  const ref = todayISO();
  const filtered = entries.filter((e) => isInPeriod(e.date, statPeriod, ref) && matchesPlatform(e));

  const ganhos = filtered.filter((e) => e.kind === "ganho").reduce((s, e) => s + e.amount, 0);
  const gastos = filtered.filter((e) => e.kind === "gasto").reduce((s, e) => s + e.amount, 0);
  document.getElementById("stat-ganhos").textContent = fmtBRL(ganhos);
  document.getElementById("stat-gastos").textContent = fmtBRL(gastos);
  document.getElementById("stat-saldo").textContent = fmtBRL(ganhos - gastos);

  // categorias de gasto
  const catTotals = {};
  filtered.filter((e) => e.kind === "gasto").forEach((e) => {
    catTotals[e.key] = (catTotals[e.key] || 0) + e.amount;
  });
  const catWrap = document.getElementById("stat-categories");
  const catKeys = Object.keys(catTotals);
  if (catKeys.length === 0) {
    catWrap.innerHTML = `<div class="empty-state">Sem gastos no período selecionado.</div>`;
  } else {
    const max = Math.max(...Object.values(catTotals));
    catWrap.innerHTML = catKeys
      .sort((a, b) => catTotals[b] - catTotals[a])
      .map((k) => {
        const pct = max ? Math.round((catTotals[k] / max) * 100) : 0;
        return `
          <div class="cat-row">
            <div class="cat-row-top">
              <span class="cat-name">${GASTO_LABELS[k]}</span>
              <span class="cat-value">${fmtBRL(catTotals[k])}</span>
            </div>
            <div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div>
          </div>`;
      })
      .join("");
  }

  renderBarChart(filtered);
}

function renderBarChart(filtered) {
  const chart = document.getElementById("stat-chart");
  // agrupa por dia (últimos 7 buckets relevantes ao período)
  const buckets = {};
  filtered.forEach((e) => {
    const k = e.date;
    if (!buckets[k]) buckets[k] = { ganhos: 0, gastos: 0 };
    buckets[k][e.kind === "ganho" ? "ganhos" : "gastos"] += e.amount;
  });
  const keys = Object.keys(buckets).sort().slice(-7);
  if (keys.length === 0) {
    chart.innerHTML = `<div class="empty-state">Sem dados para exibir.</div>`;
    return;
  }
  const maxVal = Math.max(...keys.map((k) => buckets[k].ganhos + buckets[k].gastos), 1);
  chart.innerHTML = keys
    .map((k) => {
      const { ganhos, gastos } = buckets[k];
      const hEarn = Math.max(2, Math.round((ganhos / maxVal) * 150));
      const hSpend = Math.max(ganhos > 0 || gastos > 0 ? 2 : 0, Math.round((gastos / maxVal) * 150));
      const label = new Date(k + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `
        <div class="bar-col">
          <div class="bar-stack" style="height:${hEarn + hSpend}px">
            <div class="bar-spend" style="height:${hSpend}px"></div>
            <div class="bar-earn" style="height:${hEarn}px"></div>
          </div>
          <span class="bar-label">${label}</span>
        </div>`;
    })
    .join("");
}

/* ---------------- theme ---------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("theme-label").textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
  document.getElementById("theme-icon").style.transform = theme === "dark" ? "rotate(0deg)" : "rotate(180deg)";
  localStorage.setItem(THEME_KEY, theme);
}
document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* ---------------- verificar atualização ---------------- */
document.getElementById("app-version").textContent = APP_VERSION;

document.getElementById("update-btn").addEventListener("click", async () => {
  const status = document.getElementById("status-msg");
  if (!navigator.onLine) {
    status.textContent = "Sem conexão para verificar.";
    showToast("Você está offline. Conecte-se para verificar atualizações.");
    return;
  }
  status.textContent = "Verificando…";
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    const latest = (data.tag_name || "").replace(/^v/i, "");
    if (latest && latest !== APP_VERSION) {
      status.textContent = `Nova versão: v${latest}`;
      showToast(`Nova versão disponível (v${latest}). Acesse o GitHub para atualizar.`);
    } else {
      status.textContent = "Você está atualizado.";
      showToast("Você já está usando a versão mais recente.");
    }
  } catch (err) {
    status.textContent = "Não foi possível verificar.";
    showToast("Não foi possível checar atualizações agora. Configure GITHUB_REPO em app.js.");
  }
});

/* ---------------- instalar aplicativo (PWA) ---------------- */
let deferredPrompt = null;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener("appinstalled", () => {
  showToast("Aplicativo instalado com sucesso!");
});

installBtn.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") showToast("Instalando aplicativo…");
    return;
  }
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) {
    showToast("O aplicativo já está instalado neste dispositivo.");
    return;
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    showToast('No iPhone/iPad: toque em "Compartilhar" e depois em "Adicionar à Tela de Início".');
  } else {
    showToast("Instalação não disponível neste navegador. Tente pelo Chrome ou Edge.");
  }
});

/* ---------------- service worker (offline) ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------------- init ---------------- */
renderHome();
renderToday();
renderStats();
