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
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div>
        <div class="table-title">${project.label}</div>
        <div class="check-meta">${project.items.length} 항목</div>
      </div>
      ${badge(project.summary.main)}
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
    el.innerHTML = `
      <div class="check-row">
        <div class="check-title">${item["점검항목"]}</div>
        ${badge(status)}
      </div>
      <div class="check-row">
        <div class="check-meta">${item["중분류"]} · ${item["항목코드"]}</div>
        <div class="check-meta">중요도 ${item["중요도"] || guide["중요도"] || "-"}</div>
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

  if (!item) {
    title.textContent = "항목을 선택하세요";
    body.innerHTML = "";
    badges.innerHTML = "";
    return;
  }

  const guide = item.guide || {};
  title.textContent = item["점검항목"];
  badges.innerHTML = `
    ${badge(item["점검결과"] || "-")}
    ${badge(item["중요도"] || guide["중요도"] || "-")}
    <span class="badge neutral">${item["항목코드"]}</span>
  `;

  if (STATE.currentTab === "overview") {
    body.innerHTML = `
      <div class="detail-block">
        <h4>점검 내용</h4>
        <p>${guide["점검 내용"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>점검 목적</h4>
        <p>${guide["점검 목적"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>보안 위협</h4>
        <p>${guide["보안 위협"] || "-"}</p>
      </div>
    `;
  }

  if (STATE.currentTab === "criteria") {
    body.innerHTML = `
      <div class="detail-block">
        <h4>양호 판단</h4>
        <p>${guide["양호판단"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>취약 판단</h4>
        <p>${guide["취약판단"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>대상</h4>
        <p>${guide["대상"] || "-"}</p>
      </div>
    `;
  }

  if (STATE.currentTab === "action") {
    const steps = [];
    for (let i = 1; i <= 5; i += 1) {
      const title = guide[`점검조치 ${i} 제목`];
      const content = guide[`점검조치 ${i} 내용`];
      if (title || content) {
        steps.push({ title, content });
      }
    }

    body.innerHTML = `
      <div class="detail-block">
        <h4>조치 방법</h4>
        <p>${guide["조치방법"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>조치 시 영향</h4>
        <p>${guide["조치 시 영향"] || "-"}</p>
      </div>
      ${steps
        .map(
          (step, idx) => `
          <div class="detail-block">
            <h4>점검조치 ${idx + 1} ${step.title || ""}</h4>
            <p>${step.content || "-"}</p>
          </div>
        `
        )
        .join("")}
    `;
  }

  if (STATE.currentTab === "reference") {
    body.innerHTML = `
      <div class="detail-block">
        <h4>참고</h4>
        <p>${guide["참고"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>비고/코멘트</h4>
        <p>${item["비고/코멘트"] || "-"}</p>
      </div>
      <div class="detail-block">
        <h4>결과 덤프</h4>
        <p>${item["결과덤프"] || "-"}</p>
      </div>
    `;
  }
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
