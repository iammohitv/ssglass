import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

export default function App() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");

  // Convert safely to numbers (empty => 0)
  const A = Number(a) || 0;
  const B = Number(b) || 0;
  const C = Number(c) || 0;

  // ✅ Replace this with YOUR real predefined formula
  const outputs = useMemo(() => {
    const out1 = A + B;
    const out2 = A - C;
    const out3 = B * C;
    const out4 = (A + B + C) / 3;

    return { out1, out2, out3, out4 };
  }, [A, B, C]);

  const downloadPdf = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Calculation Report", 14, 18);

    doc.setFontSize(12);
    doc.text("Inputs", 14, 30);
    doc.setFontSize(11);
    doc.text(`Input A: ${A}`, 14, 38);
    doc.text(`Input B: ${B}`, 14, 45);
    doc.text(`Input C: ${C}`, 14, 52);

    doc.setFontSize(12);
    doc.text("Outputs", 14, 66);
    doc.setFontSize(11);
    doc.text(`Output 1: ${outputs.out1.toFixed(2)}`, 14, 74);
    doc.text(`Output 2: ${outputs.out2.toFixed(2)}`, 14, 81);
    doc.text(`Output 3: ${outputs.out3.toFixed(2)}`, 14, 88);
    doc.text(`Output 4: ${outputs.out4.toFixed(2)}`, 14, 95);

    doc.save("calculation_report.pdf");
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Formula Calculator → PDF</h2>
      <p>Enter inputs, see 4 outputs, download PDF.</p>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          Input A
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder="e.g. 10" />
        </label>

        <label>
          Input B
          <input value={b} onChange={(e) => setB(e.target.value)} placeholder="e.g. 5" />
        </label>

        <label>
          Input C
          <input value={c} onChange={(e) => setC(e.target.value)} placeholder="e.g. 2" />
        </label>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3>Outputs</h3>
      <ul>
        <li>Output 1: {outputs.out1.toFixed(2)}</li>
        <li>Output 2: {outputs.out2.toFixed(2)}</li>
        <li>Output 3: {outputs.out3.toFixed(2)}</li>
        <li>Output 4: {outputs.out4.toFixed(2)}</li>
      </ul>

      <button onClick={downloadPdf} style={{ padding: "10px 14px", cursor: "pointer" }}>
        Download PDF
      </button>
    </div>
  );
}
