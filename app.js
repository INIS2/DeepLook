const GUIDE_PATH = "Content/CIIP Checklist.csv";
const RESULT_FILES = [
  { id: "(260101)HP_DEV_Cent7.csv", label: "260101 HP_DEV_Cent7" },
  { id: "(260102)HP_Windows.csv", label: "260102 HP_Windows" },
  { id: "(260103)HP_Window.csv", label: "260103 HP_Window" },
  { id: "(260104)HP_Windows.csv", label: "260104 HP_Windows" },
];

const STATUS_COLOR = {
  "양호": "var(--good)",
  "미흡": "var(--bad)",
  "수동점검": "var(--warn)",
  "-": "var(--neutral)",
};

const STATUS_BADGE = {
  "양호": "good",
  "미흡": "bad",
  "수동점검": "warn",
  "-": "neutral",
};

const STATE = {
  guide: [],
  guideByCode: new Map(),
  projects: [],
  currentProject: null,
  currentItem: null,
  currentTab: "overview",
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  const headers = rows.shift() || [];
  return rows.map((cells) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = (cells[idx] || "").trim();
    });
    return obj;
  });
}

async function loadCSV(path) {
  const res = await fetch(path);
  const text = await res.text();
  return parseCSV(text);
}

async function readFileText(file) {
  if (file.text) {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function setView(view) {
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("hidden", section.id !== view);
  });
}

function badge(status) {
  const cls = STATUS_BADGE[status] || "neutral";
  return `<span class="badge ${cls}">${status}</span>`;
}

function formatText(value) {
  if (value === undefined || value === null) return "-";
  const text = String(value).trim();
  if (!text) return "-";
  return text.replace(/\r?\n/g, "<br />");
}

let activeTooltip = null;

function showTooltip(target, x, y) {
  const tooltip = document.getElementById("tooltip");
  if (!tooltip) return;
  tooltip.textContent = target.dataset.tooltip || "";
  tooltip.classList.add("show");
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  activeTooltip = target;
}

function moveTooltip(x, y) {
  const tooltip = document.getElementById("tooltip");
  if (!tooltip || !activeTooltip) return;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  const tooltip = document.getElementById("tooltip");
  if (!tooltip) return;
  tooltip.classList.remove("show");
  activeTooltip = null;
}

function renderDonut(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const svg = document.getElementById("statusDonut");
  svg.innerHTML = "";

  let start = 0;
  const radius = 44;
  const center = 60;

  Object.entries(counts).forEach(([status, value]) => {
    if (!value) return;
    const angle = (value / total) * Math.PI * 2;
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(start + angle);
    const y2 = center + radius * Math.sin(start + angle);
    const large = angle > Math.PI ? 1 : 0;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
    );
    path.setAttribute("fill", STATUS_COLOR[status] || "#999");
    path.classList.add("donut-slice");
    path.dataset.tooltip = `${status}: ${value}건`;
    svg.appendChild(path);
    start += angle;
  });

  svg.insertAdjacentHTML(
    "beforeend",
    `<circle cx="${center}" cy="${center}" r="26" fill="var(--card)" />`
  );

  document.getElementById("donutTotal").textContent = total;

  const legend = document.getElementById("statusLegend");
  legend.innerHTML = "";
  Object.entries(counts).forEach(([status, value]) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <div class="legend-item">
        <span class="legend-dot" style="background:${STATUS_COLOR[status] || "#999"}"></span>
        ${status}
      </div>
      <div>${value}</div>
    `;
    legend.appendChild(row);
  });
}

function renderDashboard() {
  const projects = STATE.projects;
  const empty = document.getElementById("dashboardEmpty");
  empty.classList.toggle("hidden", projects.length > 0);

  if (!projects.length) {
    document.getElementById("kpiProjects").textContent = "-";
    document.getElementById("kpiItems").textContent = "-";
    document.getElementById("kpiWeak").textContent = "-";
    document.getElementById("kpiGoodRate").textContent = "-";
    document.getElementById("statusDonut").innerHTML = "";
    document.getElementById("statusLegend").innerHTML = "";
    document.getElementById("topWeakList").innerHTML = "";
    document.getElementById("recentTable").innerHTML = "";
    document.getElementById("donutTotal").textContent = "-";
    return;
  }

  const counts = { "미흡": 0, "양호": 0, "수동점검": 0, "-": 0 };
  const weakness = new Map();
  let totalItems = 0;

  projects.forEach((project) => {
    project.items.forEach((item) => {
      const status = item["점검결과"] || "-";
      counts[status] = (counts[status] || 0) + 1;
      totalItems += 1;
      if (status === "미흡") {
        const key = item["항목코드"];
        weakness.set(key, (weakness.get(key) || 0) + 1);
      }
    });
  });

  document.getElementById("kpiProjects").textContent = projects.length;
  document.getElementById("kpiItems").textContent = totalItems;
  document.getElementById("kpiWeak").textContent = counts["미흡"];

  const goodRate = totalItems ? Math.round((counts["양호"] / totalItems) * 100) : 0;
  document.getElementById("kpiGoodRate").textContent = `${goodRate}%`;

  renderDonut(counts);

  const topWeak = Array.from(weakness.entries())
    .map(([code, count]) => ({ code, count, guide: STATE.guideByCode.get(code) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topList = document.getElementById("topWeakList");
  topList.innerHTML = "";
  const max = topWeak[0]?.count || 1;
  topWeak.forEach((item) => {
    const title = item.guide?.["점검항목"] || item.code;
    const row = document.createElement("div");
    row.className = "bar-item";
    row.innerHTML = `
      <div class="bar-label">${title} (${item.code})</div>
      <div class="bar-track"><div class="bar-fill" style="width:${
        (item.count / max) * 100
      }%"></div></div>
    `;
    topList.appendChild(row);
  });

  const recent = document.getElementById("recentTable");
  recent.innerHTML = "";
  projects.forEach((project) => {
    const counts = { "미흡": 0, "양호": 0, "수동점검": 0, "-": 0 };
    project.items.forEach((item) => {
      const status = item["점검결과"] || "-";
      counts[status] = (counts[status] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const order = ["양호", "미흡", "수동점검", "-"];
    const segments = order
      .map((status) => ({
        status,
        value: counts[status] || 0,
        pct: Math.max(0, ((counts[status] || 0) / total) * 100),
      }))
      .filter((seg) => seg.value > 0);
    const segmentHtml = segments
      .map(
        (seg) =>
          `<span class="bar-seg" style="width:${seg.pct}%; background:${STATUS_COLOR[seg.status] || "#999"}" data-tooltip="${seg.status}: ${seg.value}건"></span>`
      )
      .join("");
    const row = document.createElement("div");
    row.className = "table-row recent-row";
    row.innerHTML = `
      <div class="recent-head">
        <div class="table-title">${project.label}</div>
        <div class="check-meta">${project.items.length} 항목</div>
      </div>
      <div class="recent-bar" aria-label="상태 분포">
        ${segmentHtml || `<span class="bar-seg" style="width:100%; background: var(--line)"></span>`}
      </div>
    `;
    recent.appendChild(row);
  });
}

function renderProjectSelect() {
  const select = document.getElementById("projectSelect");
  select.innerHTML = "";
  if (!STATE.projects.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Result CSV 업로드 필요";
    select.appendChild(opt);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  STATE.projects.forEach((project, idx) => {
    const opt = document.createElement("option");
    opt.value = project.id;
    opt.textContent = project.label;
    if (idx === 0) opt.selected = true;
    select.appendChild(opt);
  });
}

function setCurrentProject(project) {
  STATE.currentProject = project;
  STATE.currentItem = null;
  if (!project) {
    document.getElementById("projectTitle").textContent = "프로젝트";
    document.getElementById("projectDesc").textContent = "프로젝트별 점검 결과와 가이드 연결";
    renderChecklist();
    return;
  }
  document.getElementById("projectTitle").textContent = project.label;
  document.getElementById("projectDesc").textContent = `${project.category} / ${project.items.length} 항목`;
  renderChecklist();
}

function renderChecklist() {
  const project = STATE.currentProject;
  const empty = document.getElementById("projectEmpty");
  empty.classList.toggle("hidden", Boolean(project));
  if (!project) {
    document.getElementById("checklist").innerHTML = "";
    document.getElementById("listMeta").textContent = "-";
    renderDetail();
    return;
  }
  const statusFilter = document.getElementById("statusFilter").value;
  const search = document.getElementById("searchInput").value.toLowerCase();
  const list = document.getElementById("checklist");
  list.innerHTML = "";

  const filtered = project.items.filter((item) => {
    const status = item["점검결과"] || "-";
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (search) {
      const target = `${item["점검항목"]} ${item["항목코드"]} ${item["중분류"]}`.toLowerCase();
      if (!target.includes(search)) return false;
    }
    return true;
  });

  document.getElementById("listMeta").textContent = `${filtered.length} / ${project.items.length} 항목 표시`;

  filtered.forEach((item, idx) => {
    const status = item["점검결과"] || "-";
    const guide = item.guide || {};
    const el = document.createElement("div");
    el.className = "check-item";
    const code = item["항목코드"] || "-";
    const importance = item["중요도"] || guide["중요도"] || "-";
    const importanceLabel = importance.replace(/[^가-힣]/g, "") || "-";
    const importanceClass =
      importanceLabel === "상" ? "high" : importanceLabel === "중" ? "mid" : "low";
    el.innerHTML = `
      <div class="check-row single-line">
        <div class="check-left">
          <span class="check-code">${code}</span>
          <span class="check-title">${item["점검항목"]}</span>
        </div>
        <div class="check-right">
          <span class="importance-pill ${importanceClass}">${importanceLabel}</span>
          ${badge(status)}
        </div>
      </div>
    `;
    el.addEventListener("click", () => {
      document.querySelectorAll(".check-item").forEach((node) => node.classList.remove("active"));
      el.classList.add("active");
      STATE.currentItem = item;
      renderDetail();
    });
    if (idx === 0 && !STATE.currentItem) {
      el.classList.add("active");
      STATE.currentItem = item;
    }
    list.appendChild(el);
  });

  renderDetail();
}

function renderDetail() {
  const item = STATE.currentItem;
  const body = document.getElementById("detailBody");
  const title = document.getElementById("detailTitle");
  const badges = document.getElementById("detailBadges");
  const meta = document.getElementById("detailMeta");

  if (!item) {
    title.textContent = "항목을 선택하세요";
    body.innerHTML = "";
    badges.innerHTML = "";
    meta.innerHTML = "";
    return;
  }

  const guide = item.guide || {};
  const itemTitle = item["점검항목"] || guide["점검항목"] || "-";
  const code = item["항목코드"] || guide["항목코드"] || "-";
  const importance = item["중요도"] || guide["중요도"] || "-";
  const status = item["점검결과"] || "-";
  const category = [guide["대분류"] || item["대분류"], guide["중분류"] || item["중분류"]]
    .filter(Boolean)
    .join(" / ");
  const page = guide["페이지"] || "-";

  title.textContent = itemTitle;
  badges.innerHTML = `
    ${badge(status)}
    ${badge(importance)}
    <span class="badge neutral">${code}</span>
  `;

  meta.innerHTML = `
    <div class="meta-item"><span class="meta-label">분류</span><span class="meta-value">${category || "-"}</span></div>
    <div class="meta-item"><span class="meta-label">페이지</span><span class="meta-value">${page}</span></div>
  `;

  const steps = [];
  for (let i = 1; i <= 5; i += 1) {
    const stepTitle = guide[`점검조치 ${i} 제목`];
    const stepContent = guide[`점검조치 ${i} 내용`];
    if (stepTitle || stepContent) {
      steps.push({ title: stepTitle, content: stepContent });
    }
  }

  const stepsHtml = steps.length
    ? `<ol class="sheet-steps">
        ${steps
          .map(
            (step, idx) => `
            <li>
              <strong>Step ${idx + 1})${step.title ? ` ${step.title}` : ""}</strong><br />
              ${formatText(step.content)}
            </li>
          `
          )
          .join("")}
      </ol>`
    : `<div class="sheet-empty">-</div>`;

  body.innerHTML = `
    <div class="detail-sheet">
      <div class="sheet-head">
        <div class="sheet-code">
          <div class="code-main">${code}</div>
          <div class="code-sub">${importance}</div>
        </div>
        <div class="sheet-title">
          <div class="sheet-category">${category || "-"}</div>
          <div class="sheet-name">${itemTitle}</div>
        </div>
      </div>

      <div class="sheet-section">개요</div>
      <div class="sheet-row">
        <div class="sheet-label">점검 내용</div>
        <div class="sheet-value">${formatText(guide["점검 내용"])}</div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">점검 목적</div>
        <div class="sheet-value">${formatText(guide["점검 목적"])}</div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">보안 위협</div>
        <div class="sheet-value">${formatText(guide["보안 위협"])}</div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">참고</div>
        <div class="sheet-value">${formatText(guide["참고"])}</div>
      </div>

      <div class="sheet-section">점검 대상 및 판단 기준</div>
      <div class="sheet-row">
        <div class="sheet-label">대상</div>
        <div class="sheet-value">${formatText(guide["대상"])}</div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">판단 기준</div>
        <div class="sheet-value">
          <div class="criteria-list">
            <div class="criteria-item">
              <span class="criteria-tag good">양호</span>
              <span>${formatText(guide["양호판단"])}</span>
            </div>
            <div class="criteria-item">
              <span class="criteria-tag bad">취약</span>
              <span>${formatText(guide["취약판단"])}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">조치 방법</div>
        <div class="sheet-value">${formatText(guide["조치방법"])}</div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">조치 시 영향</div>
        <div class="sheet-value">${formatText(guide["조치 시 영향"])}</div>
      </div>

      <div class="sheet-section">점검 결과 참고</div>
      <div class="sheet-row">
        <div class="sheet-label">비고/코멘트</div>
        <div class="sheet-value">${formatText(item["비고/코멘트"])}</div>
      </div>
      <div class="sheet-row">
        <div class="sheet-label">결과 덤프</div>
        <div class="sheet-value">${formatText(item["결과덤프"])}</div>
      </div>

      <div class="sheet-cases">
        <div class="sheet-cases-title">점검 및 조치 사례</div>
        ${stepsHtml}
      </div>
    </div>
  `;
}
function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
      STATE.currentTab = btn.dataset.tab;
      renderDetail();
    });
  });
}

function wireFilters() {
  document.getElementById("searchInput").addEventListener("input", renderChecklist);
  document.getElementById("statusFilter").addEventListener("change", renderChecklist);

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
}

async function loadProjectsFromFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const projects = [];
  for (const file of files) {
    const text = await readFileText(file);
    const rows = parseCSV(text);
    const withGuide = rows.map((row) => ({
      ...row,
      guide: STATE.guideByCode.get(row["항목코드"]) || null,
    }));
    const category = rows[0]?.["대분류"] || "-";
    const summary = {
      main: rows.some((r) => r["점검결과"] === "미흡") ? "미흡" : "양호",
    };
    projects.push({
      id: file.name,
      label: file.name.replace(/\\.csv$/i, ""),
      category,
      items: withGuide,
      summary,
    });
  }

  STATE.projects = projects;
  renderProjectSelect();
  setCurrentProject(projects[0]);
  renderDashboard();
}

async function init() {
  STATE.guide = await loadCSV(GUIDE_PATH);
  STATE.guideByCode = new Map(STATE.guide.map((row) => [row["항목코드"], row]));

  wireTabs();
  wireFilters();
  renderProjectSelect();
  renderDashboard();

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (!target) return;
    showTooltip(target, e.clientX, e.clientY - 12);
  });

  document.addEventListener("mousemove", (e) => {
    if (!activeTooltip) return;
    moveTooltip(e.clientX, e.clientY - 12);
  });

  document.addEventListener("mouseout", (e) => {
    if (!activeTooltip) return;
    if (activeTooltip.contains(e.relatedTarget)) return;
    if (e.target === activeTooltip) hideTooltip();
  });

  const projectSelect = document.getElementById("projectSelect");
  projectSelect.addEventListener("change", () => {
    const project = STATE.projects.find((p) => p.id === projectSelect.value);
    setCurrentProject(project);
    if (project) setView("project");
  });

  const resultInput = document.getElementById("resultFiles");
  resultInput.addEventListener("change", async (e) => {
    await loadProjectsFromFiles(e.target.files);
    setView("project");
  });
}

init();

