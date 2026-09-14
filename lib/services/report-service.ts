import type { Analysis } from '../domain';
export async function createReport(a: Analysis, reference?: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  let y = 24;
  const line = (s: string, size = 10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(s, 170);
    if (y + lines.length * 5 > 275) {
      doc.addPage();
      y = 22;
    }
    doc.text(lines, 20, y);
    y += lines.length * 5 + 5;
  };
  line('SATQUERY AI', 24);
  line('Evidence-grounded satellite intelligence', 11);
  line(a.demo ? 'ILLUSTRATIVE DEMO REPORT' : 'ANALYSIS REPORT', 12);
  line(`Analysis ${a.id}`);
  line(`Created ${a.createdAt}`);
  line(`Query: ${a.query}`, 12);
  line(`Task: ${a.task} | Status: ${a.status}`);
  line('ANSWER', 14);
  line(a.answer);
  line(
    `Confidence: ${a.confidence === null ? 'Not available' : a.confidence + (a.demo ? '% (illustrative)' : '%')}`,
  );
  line('INPUTS', 14);
  for (const i of a.images)
    line(
      `${i.name} | ${i.format} | ${i.width} x ${i.height} | ${i.bands} bands | ${i.crs || 'CRS unavailable'} | ${i.modality}\nResolution: ${i.resolution?.join(' x ') || 'Unknown'} | Bounds: ${i.bounds?.join(', ') || 'Unknown'} | Sensor: ${i.sensor || 'Unknown'} | Date: ${i.date || 'Unknown'}`,
    );
  if (reference) {
    doc.addPage();
    y = 20;
    line('SPATIAL EVIDENCE', 16);
    doc.addImage(reference, 'JPEG', 20, y, 170, 170);
    const baseY = y;
    for (const e of a.evidence) {
      const colors = {
        built: [139, 221, 181],
        change: [235, 157, 90],
        water: [95, 170, 224],
        vegetation: [154, 206, 113],
      };
      const c = colors[e.kind];
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(0.8);
      e.points.forEach((p, j) => {
        const n = e.points[(j + 1) % e.points.length];
        doc.line(
          20 + p[0] * 170,
          baseY + p[1] * 170,
          20 + n[0] * 170,
          baseY + n[1] * 170,
        );
      });
    }
    y += 180;
    line(
      a.demo
        ? 'ESA / Copernicus Sentinel data (2022), CC BY-SA 3.0 IGO. Resized. Demo overlays are illustrative.'
        : 'Source: user-provided raster. Evidence supplied by specialist inference.',
      8,
    );
  }
  line('METRICS', 14);
  a.metrics.forEach((m) => line(`${m.label}: ${m.value}`));
  a.evidence.forEach((e) =>
    line(
      `${e.label}: ${e.area.toFixed(2)} km2 ${a.demo ? '(fixture grid)' : '(provider measurement)'}`,
    ),
  );
  line('CONFIDENCE BREAKDOWN', 14);
  a.breakdown.forEach((b) =>
    line(`${b.label}: ${b.value}% ${a.demo ? '(illustrative)' : ''}`),
  );
  line('EXECUTION', 14);
  line(`Tools: ${a.tools.join(', ')}`);
  line(
    `Parameters: tile ${a.parameters.tileSize}, overlap ${a.parameters.overlap}, threshold ${a.parameters.threshold}`,
  );
  line(`Processing: ${a.duration.toFixed(2)} seconds`);
  a.steps.forEach((s) => line(s, 9));
  line('LIMITATIONS', 14);
  a.limitations.forEach((s) => line(s));
  return doc.output('arraybuffer');
}
