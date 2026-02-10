import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const OPTIONS = [
  { key: "ROUND", label: "ROUND" },
  { key: "SQUARE_RECT", label: "Square + Rectangle" },
  { key: "CAPSULE", label: "CAPSULE" },
  { key: "HALF_CAPSULE", label: "HALF CAPSULE" },
];

const DECIMALS = 0;

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

// ===== FORMULAS =====

// ROUND: input size => ((size*3.14)+8)/12
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

// Square + Rectangle (do NOT show final size height/width in UI)
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

// CAPSULE
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

// HALF CAPSULE
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

// ===== PDF TABLE (bordered + colored background) =====
function drawTable(doc, startX, startY, tableWidth, rows, options = {}) {
  const {
    headerLeft = "Output",
    headerRight = "Value",
    rowHeight = 14,
    fontSize = 14,
    headerFontSize = 15,
    colSplit = 0.62,
    headerFill = [255, 230, 109], // yellow header
    rowFillA = [255, 253, 242],   // light yellow
    rowFillB = [255, 255, 255],   // white
    borderColor = [40, 40, 40],
  } = options;

  const leftW = tableWidth * colSplit;
  const rightW = tableWidth - leftW;

  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);

  // Header fill
  doc.setFillColor(...headerFill);
  doc.rect(startX, startY, leftW, rowHeight, "F");
  doc.rect(startX + leftW, startY, rightW, rowHeight, "F");

  // Header borders
  doc.rect(startX, startY, leftW, rowHeight);
  doc.rect(startX + leftW, startY, rightW, rowHeight);

  // Header text
  doc.setFontSize(headerFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);

  doc.text(headerLeft, startX + 4, startY + rowHeight - 5);
  doc.text(headerRight, startX + leftW + rightW - 4, startY + rowHeight - 5, { align: "right" });

  // Rows
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

    const leftText = String(r.label);
    const rightText = String(r.value);

    const leftLines = doc.splitTextToSize(leftText, leftW - 8).slice(0, 2);
    doc.text(leftLines, startX + 4, y + rowHeight - 5);

    doc.setFont("helvetica", "bold");
    doc.text(rightText, startX + leftW + rightW - 4, y + rowHeight - 5, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowHeight;
  });

  return y;
}

export default function App() {
  const [mode, setMode] = useState("ROUND");
  const [name, setName] = useState("");

  // Inputs
  const [size, setSize] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [widthIn, setWidthIn] = useState("");
  const [H, setH] = useState("");
  const [W, setW] = useState("");

  // Reset name whenever user changes dropdown or any input
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

    // Big title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("SSG Glass Frame Calculator", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(`Sheet: ${modeLabel}`, 14, 28);
    doc.text(`Name: ${name.trim()}`, 14, 36);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 44);

    doc.setLineWidth(0.4);
    doc.line(14, 49, 196, 49);

    // Inputs section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Inputs", 14, 60);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);

    let y = 70;

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

    // Outputs title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Outputs", 14, y);
    y += 10;

    const rows = outputs.map((o) => ({
      label: o.label,
      value: `${fmt(o.value)}${o.unit ? " " + o.unit : ""}`,
    }));

    // Table sizing
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
              Select a sheet → enter inputs → view outputs → enter name → download PDF.
            </p>
          </div>
          <div className="badge">{modeLabel}</div>
        </div>

        <div className="controls">
          <div className="field">
            <label>Sheet</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field grow">
            <label>Name (required for PDF)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
            {!isNameValid && <div className="hint">Enter name to enable Download PDF.</div>}
          </div>
        </div>

        <div className="divider" />

        <div className="sectionTitle">Inputs</div>

        {mode === "ROUND" && (
          <div className="grid">
            <div className="field">
              <label>Size</label>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 18"
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        {mode === "SQUARE_RECT" && (
          <div className="grid">
            <div className="field">
              <label>Height</label>
              <input
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
                placeholder="e.g. 10"
                inputMode="decimal"
              />
            </div>
            <div className="field">
              <label>Width</label>
              <input
                value={widthIn}
                onChange={(e) => setWidthIn(e.target.value)}
                placeholder="e.g. 20"
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        {(mode === "CAPSULE" || mode === "HALF_CAPSULE") && (
          <div className="grid">
            <div className="field">
              <label>H</label>
              <input
                value={H}
                onChange={(e) => setH(e.target.value)}
                placeholder="e.g. 36"
                inputMode="decimal"
              />
            </div>
            <div className="field">
              <label>W</label>
              <input
                value={W}
                onChange={(e) => setW(e.target.value)}
                placeholder="e.g. 22"
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        <div className="divider" />

        <div className="sectionTitle">Outputs (Rounded)</div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Output</th>
                <th className="right">Value</th>
              </tr>
            </thead>
            <tbody>
              {outputs.map((o) => (
                <tr key={o.label}>
                  <td className="outLabel">{o.label}</td>
                  <td className="right outValue">
                    {fmt(o.value)}
                    {o.unit ? <span className="unit"> {o.unit}</span> : null}
                  </td>
                </tr>
              ))}
              {outputs.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">No outputs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="actions">
          <button className="primary" disabled={!isNameValid} onClick={downloadPdf}>
            Download PDF
          </button>

          <button
            className="ghost"
            onClick={() => {
              setName("");
              setSize("");
              setHeightIn("");
              setWidthIn("");
              setH("");
              setW("");
            }}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
