import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const OPTIONS = [
  { key: "ROUND", label: "ROUND" },
  { key: "SQUARE_RECT", label: "Square + Rectangle" },
  { key: "CAPSULE", label: "CAPSULE" },
  { key: "HALF_CAPSULE", label: "HALF CAPSULE" },
];

const DECIMALS = 2;

// ===== Helpers =====
function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function roundTo(value, decimals = DECIMALS) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const p = 10 ** decimals;
  return Math.round(num * p) / p;
}

function fmt(value, decimals = DECIMALS) {
  const num = Number(value);
  if (!Number.isFinite(num)) return (0).toFixed(decimals);
  return roundTo(num, decimals).toFixed(decimals);
}

function safeFileName(name) {
  return (
    name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 40) || "report"
  );
}

// ===== USERS FROM ENV (ROBUST) =====
function normalizeEnvString(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();

  // remove wrapping quotes if dotenv left them
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    s = s.slice(1, -1).trim();
  }

  return s;
}

function parseUsersFromEnvString(raw) {
  const s = normalizeEnvString(raw);
  if (!s) {
    return {
      users: [],
      error: "VITE_APP_USERS is missing in the deployed build (import.meta.env.VITE_APP_USERS is empty).",
      debug: { preview: "", length: 0, type: typeof raw },
    };
  }

  try {
    // Attempt #1: normal JSON
    let parsed = JSON.parse(s);

    // If parsed is a string, it's double-encoded JSON -> parse again
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (!Array.isArray(parsed)) {
      return {
        users: [],
        error: "VITE_APP_USERS must be a JSON array like [{\"u\":\"admin\",\"p\":\"admin123\"}].",
        debug: { preview: s.slice(0, 40), length: s.length, type: typeof raw },
      };
    }

    const users = parsed
      .filter((x) => x && typeof x.u === "string" && typeof x.p === "string")
      .map((x) => ({ u: x.u.trim(), p: x.p }));

    if (!users.length) {
      return {
        users: [],
        error: "VITE_APP_USERS parsed but no valid users found (need objects with u and p).",
        debug: { preview: s.slice(0, 40), length: s.length, type: typeof raw },
      };
    }

    return {
      users,
      error: "",
      debug: { preview: s.slice(0, 40), length: s.length, type: typeof raw },
    };
  } catch {
    return {
      users: [],
      error: "VITE_APP_USERS is not valid JSON in the deployed build.",
      debug: { preview: s.slice(0, 60), length: s.length, type: typeof raw },
    };
  }
}

function getUsersFromEnv() {
  const raw = import.meta.env.VITE_APP_USERS;
  return parseUsersFromEnvString(raw);
}

function verifyLogin(username, password, users) {
  const u = (username || "").trim();
  const p = password || "";
  return users.some((x) => x.u === u && x.p === p);
}

// ===== FORMULAS =====
function calcRound({ size }) {
  const pi = 3.14;
  const margin = 8;
  const totalSize = size * pi;
  const finalSize = totalSize + margin;
  const footOutput = finalSize / 12;

  return [
    { label: "TOTAL SIZE", value: totalSize, unit: "" },
    { label: "MARGIN", value: margin, unit: "" },
    { label: "FINAL SIZE", value: finalSize, unit: "" },
    { label: "FOOT", value: footOutput, unit: "ft" },
  ];
}

function calcSquareRect({ heightIn, widthIn }) {
  const heightMM = heightIn * 25.4;
  const widthMM = widthIn * 25.4;

  const deduction = 120;
  const finalHeightMM = heightMM - deduction;
  const finalWidthMM = widthMM - deduction;

  const takingMargin = finalHeightMM / 2;
  const fixed170 = 170;
  const fixed94_2 = 94.2;

  const mark1 = takingMargin + fixed170 + fixed94_2;
  const mark2 = mark1 + finalWidthMM + fixed94_2;
  const mark3 = mark2 + finalHeightMM + fixed94_2;
  const mark4 = mark3 + finalWidthMM + fixed94_2;

  const totalRawFt = ((heightIn + widthIn) * 2) / 12;

  return [
    { label: "1ST MARK", value: mark1, unit: "" },
    { label: "2ND MARK", value: mark2, unit: "" },
    { label: "3RD MARK", value: mark3, unit: "" },
    { label: "4TH MARK", value: mark4, unit: "" },
    { label: "TOTAL RAW MATERIAL", value: totalRawFt, unit: "ft" },
  ];
}

function calcCapsule({ H, W }) {
  const pi = 3.14;
  const net = H - W;
  const upperBottom = (W * pi) / 2;
  const totalRawFt = ((H + W) * 2) / 12;

  return [
    { label: "FIRST MARKING", value: net / 2, unit: "" },
    { label: "SECOND MARKING", value: upperBottom, unit: "" },
    { label: "THIRD MARKING", value: net, unit: "" },
    { label: "FOURTH MARKING", value: upperBottom, unit: "" },
    { label: "TOTAL RAW MATERIAL", value: totalRawFt, unit: "ft" },
  ];
}

function calcHalfCapsule({ H, W }) {
  const pi = 3.14;
  const net = H - W / 2;
  const upperBottom = (W * pi) / 2;

  const first = net;
  const second = upperBottom;
  const third = first;

  const rawMaterialFt = (first + second + third) / 12;
  const bottomMaterialFt = W / 12;
  const totalFt = rawMaterialFt + bottomMaterialFt;

  return [
    { label: "FIRST MARKING", value: first, unit: "" },
    { label: "SECOND MARKING", value: second, unit: "" },
    { label: "THIRD MARKING", value: third, unit: "" },
    { label: "RAW MATERIAL", value: rawMaterialFt, unit: "ft" },
    { label: "BOTTOM MATERIAL", value: bottomMaterialFt, unit: "ft" },
    { label: "TOTAL", value: totalFt, unit: "ft" },
  ];
}

// ===== PDF TABLE =====
function drawTable(doc, startX, startY, tableWidth, rows, options = {}) {
  const {
    headerLeft = "Output",
    headerRight = "Value",
    rowHeight = 14,
    fontSize = 14,
    headerFontSize = 15,
    colSplit = 0.62,
    headerFill = [255, 230, 109],
    rowFillA = [255, 253, 242],
    rowFillB = [255, 255, 255],
    borderColor = [40, 40, 40],
  } = options;

  const leftW = tableWidth * colSplit;
  const rightW = tableWidth - leftW;

  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);

  doc.setFillColor(...headerFill);
  doc.rect(startX, startY, leftW, rowHeight, "F");
  doc.rect(startX + leftW, startY, rightW, rowHeight, "F");

  doc.rect(startX, startY, leftW, rowHeight);
  doc.rect(startX + leftW, startY, rightW, rowHeight);

  doc.setFontSize(headerFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);

  doc.text(headerLeft, startX + 4, startY + rowHeight - 5);
  doc.text(headerRight, startX + leftW + rightW - 4, startY + rowHeight - 5, { align: "right" });

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");

  let y = startY + rowHeight;

  rows.forEach((r, idx) => {
    const fill = idx % 2 === 0 ? rowFillA : rowFillB;
    doc.setFillColor(...fill);

    doc.rect(startX, y, leftW, rowHeight, "F");
    doc.rect(startX + leftW, y, rightW, rowHeight, "F");

    doc.rect(startX, y, leftW, rowHeight);
    doc.rect(startX + leftW, y, rightW, rowHeight);

    const leftLines = doc.splitTextToSize(String(r.label), leftW - 8).slice(0, 2);
    doc.text(leftLines, startX + 4, y + rowHeight - 5);

    doc.setFont("helvetica", "bold");
    doc.text(String(r.value), startX + leftW + rightW - 4, y + rowHeight - 5, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowHeight;
  });

  return y;
}

// ===== Login =====
function Login({ onLogin }) {
  const envInfo = useMemo(() => getUsersFromEnv(), []);
  const { users, error, debug } = envInfo;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setErr("");

    if (users.length === 0) {
      setErr(error || "No users configured.");
      return;
    }

    if (!verifyLogin(username, password, users)) {
      setErr("Invalid username or password.");
      return;
    }

    const u = username.trim();
    localStorage.setItem("ssg_auth_user", u);
    onLogin(u);
  };

  return (
    <div className="page">
      <div className="card">
        <div className="header">
          <div>
            <h1>SSG Glass Frame Calculator</h1>
            <p className="sub">Login to access the calculator.</p>
          </div>
          <div className="badge">Login</div>
        </div>

        <div className="divider" />

        <form onSubmit={submit} className="controls">
          <div className="field grow">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin" />
          </div>

          <div className="field grow">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {(err || error) && <div className="hint">{err || error}</div>}

          {/* Safe debug (does NOT show full secret) */}
          <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
            Debug: envType={debug?.type}, envLen={debug?.length}, envPreview="{debug?.preview}"
          </div>

          <div className="actions">
            <button className="primary" type="submit" disabled={!username.trim() || !password}>
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===== Calculator =====
function Calculator({ authedUser, onLogout }) {
  const [mode, setMode] = useState("ROUND");
  const [name, setName] = useState("");

  const [size, setSize] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [widthIn, setWidthIn] = useState("");
  const [H, setH] = useState("");
  const [W, setW] = useState("");

  useEffect(() => {
    setName("");
  }, [mode, size, heightIn, widthIn, H, W]);

  const outputs = useMemo(() => {
    if (mode === "ROUND") return calcRound({ size: n(size) });
    if (mode === "SQUARE_RECT") return calcSquareRect({ heightIn: n(heightIn), widthIn: n(widthIn) });
    if (mode === "CAPSULE") return calcCapsule({ H: n(H), W: n(W) });
    if (mode === "HALF_CAPSULE") return calcHalfCapsule({ H: n(H), W: n(W) });
    return [];
  }, [mode, size, heightIn, widthIn, H, W]);

  const modeLabel = OPTIONS.find((o) => o.key === mode)?.label ?? mode;
  const isNameValid = name.trim().length > 0;

  const downloadPdf = () => {
    if (!isNameValid) return;

    const doc = new jsPDF();
    const fileName = `${safeFileName(name)}_${safeFileName(modeLabel)}.pdf`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("SSG Glass Frame Calculator", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(`Sheet: ${modeLabel}`, 14, 28);
    doc.text(`Name: ${name.trim()}`, 14, 36);
    doc.text(`User: ${authedUser}`, 14, 44);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 52);

    doc.setLineWidth(0.4);
    doc.line(14, 57, 196, 57);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Inputs", 14, 68);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);

    let y = 78;

    const inputLines = [];
    if (mode === "ROUND") inputLines.push(`Size: ${fmt(n(size))}`);
    if (mode === "SQUARE_RECT") {
      inputLines.push(`Height: ${fmt(n(heightIn))}`);
      inputLines.push(`Width: ${fmt(n(widthIn))}`);
    }
    if (mode === "CAPSULE" || mode === "HALF_CAPSULE") {
      inputLines.push(`H: ${fmt(n(H))}`);
      inputLines.push(`W: ${fmt(n(W))}`);
    }

    inputLines.forEach((t) => {
      doc.text(t, 14, y);
      y += 9;
    });

    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Outputs", 14, y);
    y += 10;

    const rows = outputs.map((o) => ({
      label: o.label,
      value: `${fmt(o.value)}${o.unit ? " " + o.unit : ""}`,
    }));

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const tableWidth = pageWidth - margin * 2;

    const rowHeight = 14;
    const neededHeight = (rows.length + 1) * rowHeight + 8;

    if (y + neededHeight > pageHeight - 14) {
      doc.addPage();
      y = 20;
    }

    drawTable(doc, margin, y, tableWidth, rows, {
      rowHeight,
      fontSize: 14,
      headerFontSize: 15,
      colSplit: 0.64,
      headerFill: [255, 230, 109],
      rowFillA: [255, 253, 242],
      rowFillB: [255, 255, 255],
      borderColor: [40, 40, 40],
    });

    doc.save(fileName);
  };

  return (
    <div className="page">
      <div className="card">
        <div className="header">
          <div>
            <h1>SSG Glass Frame Calculator</h1>
            <p className="sub">
              Logged in as <b>{authedUser}</b>
            </p>
          </div>
          <div className="badge">
            {modeLabel} •{" "}
            <button
              onClick={onLogout}
              style={{ border: "none", background: "transparent", fontWeight: 900, cursor: "pointer" }}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Keep your existing UI below (inputs table outputs etc.) */}
        {/* If your current UI differs, paste it and I’ll merge cleanly */}
        <div style={{ marginTop: 14, color: "#6b7280" }}>
          Your calculator UI should remain here (same as your previous version).
        </div>

        <div className="actions" style={{ marginTop: 16 }}>
          <button className="primary" disabled={!isNameValid} onClick={downloadPdf} type="button">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== App (auth gate only) =====
export default function App() {
  const [authedUser, setAuthedUser] = useState(() => localStorage.getItem("ssg_auth_user") || "");

  const logout = () => {
    localStorage.removeItem("ssg_auth_user");
    setAuthedUser("");
  };

  if (!authedUser) return <Login onLogin={setAuthedUser} />;

  return <Calculator authedUser={authedUser} onLogout={logout} />;
}
