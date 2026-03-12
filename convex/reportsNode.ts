"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function buildPdfBuffer(data: {
  machine: any;
  sensors: any[];
  telemetry: any[];
  alerts: any[];
  commands: any[];
  notificationLogs: any[];
  shares: any[];
  startTimestamp: number;
  endTimestamp: number;
}) {
  const {
    machine,
    sensors,
    telemetry,
    alerts,
    commands,
    notificationLogs,
    shares,
    startTimestamp,
    endTimestamp,
  } = data;
  const sensorMap = new Map<string, any>(sensors.map((s) => [s._id, s]));
  const telemetryRows = telemetry.slice(-250);
  const latestTelemetryTime = telemetry.length
    ? new Date(telemetry[telemetry.length - 1].timestamp).toLocaleString()
    : "N/A";

  const latestBySensor = new Map<string, any>();
  for (let i = telemetry.length - 1; i >= 0; i -= 1) {
    const row = telemetry[i];
    if (!latestBySensor.has(String(row.sensorId))) {
      latestBySensor.set(String(row.sensorId), row);
    }
  }

  const statsBySensor = sensors.map((sensor) => {
    const rows = telemetry.filter((t) => String(t.sensorId) === String(sensor._id));
    if (rows.length === 0) {
      return {
        sensor,
        min: "N/A",
        max: "N/A",
        avg: "N/A",
        last: "N/A",
      };
    }
    const values = rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const last = values[values.length - 1];
    return {
      sensor,
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: avg.toFixed(2),
      last: last.toFixed(2),
    };
  });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 34;
  const left = margin;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const colors = {
    text: rgb(0.08, 0.11, 0.18),
    muted: rgb(0.4, 0.45, 0.53),
    brand: rgb(0.03, 0.52, 0.68),
    card: rgb(0.95, 0.98, 1),
    headerBg: rgb(0.03, 0.09, 0.2),
    white: rgb(1, 1, 1),
    line: rgb(0.82, 0.88, 0.94),
  };

  const toText = (value: unknown) => {
    if (value == null) return "N/A";
    return String(value);
  };

  const truncateToWidth = (
    input: string,
    maxWidth: number,
    size: number,
    usedFont: typeof font,
  ) => {
    if (!input) return "";
    if (usedFont.widthOfTextAtSize(input, size) <= maxWidth) return input;
    const ellipsis = "...";
    let lo = 0;
    let hi = input.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = `${input.slice(0, mid)}${ellipsis}`;
      if (usedFont.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return `${input.slice(0, Math.max(0, lo))}${ellipsis}`;
  };

  const drawHeaderBar = () => {
    page.drawRectangle({
      x: 0,
      y: pageHeight - 94,
      width: pageWidth,
      height: 94,
      color: colors.headerBg,
    });
    page.drawText("AI Predictive Maintenance System", {
      x: left,
      y: pageHeight - 47,
      size: 16,
      font: bold,
      color: colors.white,
    });
    page.drawText("Comprehensive Machine Report", {
      x: left,
      y: pageHeight - 67,
      size: 10,
      font,
      color: rgb(0.8, 0.9, 0.98),
    });
    y = pageHeight - 112;
  };

  const ensureSpace = (heightNeeded = 56) => {
    if (y - heightNeeded > margin) return;
    page = pdf.addPage([pageWidth, pageHeight]);
    drawHeaderBar();
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(24);
    page.drawText(title, {
      x: left,
      y,
      size: 12.5,
      font: bold,
      color: colors.brand,
    });
    y -= 8;
    page.drawRectangle({
      x: left,
      y,
      width: pageWidth - left * 2,
      height: 1,
      color: colors.line,
    });
    y -= 12;
  };

  const drawKVLine = (label: string, value: string, x = left) => {
    ensureSpace(16);
    page.drawText(label, { x, y, size: 9.2, font, color: colors.muted });
    page.drawText(truncateToWidth(value, 190, 9.2, bold), {
      x: x + 95,
      y,
      size: 9.2,
      font: bold,
      color: colors.text,
    });
    y -= 13;
  };

  const drawInfoCards = (cards: Array<{ title: string; value: string }>) => {
    const cardW = 126;
    const cardH = 48;
    const gap = 8;
    const rowY = y;
    cards.slice(0, 4).forEach((card, idx) => {
      const x = left + idx * (cardW + gap);
      page.drawRectangle({
        x,
        y: rowY - cardH,
        width: cardW,
        height: cardH,
        color: colors.card,
        borderColor: colors.line,
        borderWidth: 1,
      });
      page.drawText(card.title, {
        x: x + 8,
        y: rowY - 16,
        size: 8,
        font,
        color: colors.muted,
      });
      page.drawText(truncateToWidth(card.value, cardW - 16, 10, bold), {
        x: x + 8,
        y: rowY - 33,
        size: 10,
        font: bold,
        color: colors.text,
      });
    });
    y -= cardH + 10;
  };

  const drawTableHeader = (cols: string[], widths: number[]) => {
    ensureSpace(24);
    let x = left;
    for (let i = 0; i < cols.length; i += 1) {
      page.drawRectangle({
        x,
        y: y - 16,
        width: widths[i],
        height: 16,
        color: rgb(0.92, 0.96, 0.99),
        borderColor: colors.line,
        borderWidth: 1,
      });
      page.drawText(cols[i], {
        x: x + 4,
        y: y - 11.5,
        size: 7.8,
        font: bold,
        color: colors.text,
      });
      x += widths[i];
    }
    y -= 17;
  };

  const drawTableRow = (cells: string[], widths: number[]) => {
    ensureSpace(17);
    let x = left;
    const rowHeight = 15;
    for (let i = 0; i < cells.length; i += 1) {
      page.drawRectangle({
        x,
        y: y - rowHeight,
        width: widths[i],
        height: rowHeight,
        borderColor: colors.line,
        borderWidth: 1,
      });
      page.drawText(truncateToWidth(cells[i], widths[i] - 8, 7.4, font), {
        x: x + 4,
        y: y - 10.6,
        size: 7.4,
        font,
        color: colors.text,
      });
      x += widths[i];
    }
    y -= rowHeight;
  };

  drawHeaderBar();

  drawSectionTitle("Report Summary");
  drawInfoCards([
    { title: "Machine", value: toText(machine.name) },
    { title: "Telemetry Rows", value: String(telemetry.length) },
    { title: "Alerts", value: String(alerts.length) },
    { title: "Commands", value: String(commands.length) },
  ]);

  drawSectionTitle("Machine Profile");
  const initialY = y;
  drawKVLine("Name", toText(machine.name), left);
  drawKVLine("Location", toText(machine.location), left);
  drawKVLine("Device ID", toText(machine.deviceId), left);
  drawKVLine("Status", toText(machine.status), left);
  drawKVLine("Relay State", toText(machine.relayState ?? "on"), left);
  drawKVLine("Automation Mode", toText(machine.automationMode ?? "auto"), left);

  y = initialY;
  drawKVLine("Last Data", machine.lastDataReceivedAt ? new Date(machine.lastDataReceivedAt).toLocaleString() : "N/A", left + 280);
  drawKVLine("Signal", `${toText(machine.signalStrength)}%`, left + 280);
  drawKVLine("Battery", toText(machine.batteryStatus), left + 280);
  drawKVLine("Power", toText(machine.powerStatus), left + 280);
  drawKVLine("Created At", machine.createdAt ? new Date(machine.createdAt).toLocaleString() : "N/A", left + 280);
  drawKVLine(
    "Range",
    `${new Date(startTimestamp).toLocaleString()} -> ${new Date(endTimestamp).toLocaleString()}`,
    left + 280,
  );
  y -= 6;

  drawSectionTitle("Access & Sharing");
  if (shares.length === 0) {
    drawKVLine("Shared Users", "No shared users configured.");
  } else {
    drawTableHeader(["Email", "Access", "Shared At"], [290, 90, 147]);
    for (const share of shares) {
      drawTableRow(
        [
          toText(share.email),
          toText(share.permission),
          share.createdAt ? new Date(share.createdAt).toLocaleString() : "N/A",
        ],
        [290, 90, 147],
      );
    }
  }
  y -= 6;

  drawSectionTitle("Sensor Configuration");
  drawTableHeader(["Name", "Type", "Unit", "Warn", "Critical"], [170, 95, 70, 90, 102]);
  for (const sensor of sensors) {
    drawTableRow(
      [
        toText(sensor.name ?? sensor.type),
        toText(sensor.type),
        toText(sensor.unit),
        toText(sensor.thresholdWarning),
        toText(sensor.thresholdCritical),
      ],
      [170, 95, 70, 90, 102],
    );
  }
  y -= 6;

  drawSectionTitle("Latest Sensor Snapshot");
  drawTableHeader(["Sensor", "Type", "Last Value", "Unit", "Last Seen"], [160, 80, 90, 70, 127]);
  for (const sensor of sensors) {
    const last = latestBySensor.get(String(sensor._id));
    drawTableRow(
      [
        toText(sensor.name ?? sensor.type),
        toText(sensor.type),
        last ? toText(Number(last.value).toFixed(2)) : "N/A",
        toText(sensor.unit),
        last ? new Date(last.timestamp).toLocaleString() : "N/A",
      ],
      [160, 80, 90, 70, 127],
    );
  }
  y -= 6;

  drawSectionTitle("Telemetry Statistics");
  drawTableHeader(["Sensor", "Min", "Max", "Avg", "Last"], [220, 75, 75, 75, 75]);
  for (const row of statsBySensor) {
    drawTableRow(
      [toText(row.sensor.name ?? row.sensor.type), row.min, row.max, row.avg, row.last],
      [220, 75, 75, 75, 75],
    );
  }
  y -= 8;

  drawSectionTitle("Alert History");
  if (alerts.length === 0) {
    drawKVLine("Alerts", "No alerts in selected range.");
  } else {
    drawTableHeader(["Timestamp", "Level", "Message"], [170, 90, 267]);
    for (const alert of alerts.slice(-120)) {
      drawTableRow(
        [
          alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "N/A",
          toText(alert.level),
          toText(alert.message),
        ],
        [170, 90, 267],
      );
    }
  }
  y -= 6;

  drawSectionTitle("Command History");
  if (commands.length === 0) {
    drawKVLine("Commands", "No commands in selected range.");
  } else {
    drawTableHeader(["Timestamp", "Command", "Status"], [190, 180, 157]);
    for (const command of commands.slice(-150)) {
      drawTableRow(
        [
          command.createdAt ? new Date(command.createdAt).toLocaleString() : "N/A",
          toText(command.command),
          toText(command.status),
        ],
        [190, 180, 157],
      );
    }
  }
  y -= 6;

  drawSectionTitle("Notification Logs");
  if (notificationLogs.length === 0) {
    drawKVLine("Notifications", "No notification events in selected range.");
  } else {
    drawTableHeader(["Timestamp", "Channel", "Level", "Status", "Message"], [130, 70, 70, 70, 187]);
    for (const log of notificationLogs.slice(-140)) {
      drawTableRow(
        [
          log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A",
          toText(log.channel),
          toText(log.level),
          toText(log.status),
          toText(log.message),
        ],
        [130, 70, 70, 70, 187],
      );
    }
  }
  y -= 6;

  drawSectionTitle("Telemetry Samples (Latest 250)");
  drawTableHeader(["Timestamp", "Sensor", "Type", "Value", "Unit"], [165, 145, 90, 90, 71]);
  for (const row of telemetryRows) {
    const sensor = sensorMap.get(row.sensorId);
    drawTableRow(
      [
        new Date(row.timestamp).toLocaleString(),
        toText(sensor?.name ?? sensor?.type ?? "unknown"),
        toText(sensor?.type ?? "unknown"),
        toText(Number(row.value).toFixed(3)),
        toText(sensor?.unit ?? ""),
      ],
      [165, 145, 90, 90, 71],
    );
  }

  ensureSpace(40);
  y -= 8;
  page.drawRectangle({
    x: left,
    y,
    width: pageWidth - left * 2,
    height: 1,
    color: colors.line,
  });
  y -= 14;
  page.drawText(`Generated: ${new Date().toLocaleString()} | Last Telemetry: ${latestTelemetryTime}`, {
    x: left,
    y,
    size: 8.4,
    font,
    color: colors.muted,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function makeReportFilename(machineName: string, startTimestamp: number, endTimestamp: number) {
  const safeName = machineName.replace(/[^a-z0-9-_]/gi, "_");
  const startDate = new Date(startTimestamp).toISOString().slice(0, 10);
  const endDate = new Date(endTimestamp).toISOString().slice(0, 10);
  const dateRange = `${startDate}_to_${endDate}`;
  return `${safeName}_${dateRange}_report.pdf`;
}

export const downloadMachineReportPdf: any = action({
  args: {
    machineId: v.id("machines"),
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, args): Promise<{ filename: string; pdfBase64: string }> => {
    const report: any = await ctx.runQuery(api.reports.getReportData, {
      machineId: args.machineId,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
    });

    const pdf = await buildPdfBuffer({
      ...report,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
    });

    return {
      filename: makeReportFilename(report.machine.name, args.startTimestamp, args.endTimestamp),
      pdfBase64: pdf.toString("base64"),
    };
  },
});

export const sendMachineReportEmail: any = action({
  args: {
    machineId: v.id("machines"),
    recipientEmail: v.string(),
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; messageId: string }> => {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
    if (!smtpUser || !smtpPass || !smtpFrom) {
      throw new Error("Email service is not configured. Set SMTP_USER/SMTP_PASS/SMTP_FROM.");
    }

    const report: any = await ctx.runQuery(api.reports.getReportData, {
      machineId: args.machineId,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
    });

    const pdf = await buildPdfBuffer({
      ...report,
      startTimestamp: args.startTimestamp,
      endTimestamp: args.endTimestamp,
    });

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const filename = makeReportFilename(
      report.machine.name,
      args.startTimestamp,
      args.endTimestamp,
    );
    const sensorRowsHtml = report.sensors
      .map(
        (sensor: any) => `
          <tr>
            <td style="padding:8px;border:1px solid #dbe4ef;">${sensor.name ?? sensor.type}</td>
            <td style="padding:8px;border:1px solid #dbe4ef;">${sensor.type}</td>
            <td style="padding:8px;border:1px solid #dbe4ef;">${sensor.unit}</td>
            <td style="padding:8px;border:1px solid #dbe4ef;text-align:right;">${sensor.thresholdWarning}</td>
            <td style="padding:8px;border:1px solid #dbe4ef;text-align:right;">${sensor.thresholdCritical}</td>
          </tr>
        `,
      )
      .join("");

    const recentAlertRowsHtml = (report.alerts ?? [])
      .slice(-8)
      .map(
        (alert: any) => `
          <tr>
            <td style="padding:8px;border:1px solid #dbe4ef;">${alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "N/A"}</td>
            <td style="padding:8px;border:1px solid #dbe4ef;">${alert.level ?? "N/A"}</td>
            <td style="padding:8px;border:1px solid #dbe4ef;">${alert.message ?? "N/A"}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f7fb;padding:24px;">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dce6f2;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0f172a,#0b4a6e);padding:20px 24px;color:#fff;">
            <div style="font-size:22px;font-weight:700;">Machine Report</div>
            <div style="opacity:.9;font-size:13px;margin-top:4px;">AI Predictive Maintenance System</div>
          </div>
          <div style="padding:22px 24px;color:#1e293b;">
            <p style="margin:0 0 14px 0;">Hello,</p>
            <p style="margin:0 0 16px 0;">
              Please find attached the detailed PDF report for <strong>${report.machine.name}</strong>.
            </p>

            <table style="width:100%;border-collapse:separate;border-spacing:0 10px;margin-bottom:14px;">
              <tr>
                <td style="width:33%;padding:10px;border:1px solid #dbe4ef;border-radius:8px;background:#f8fbff;">
                  <div style="font-size:12px;color:#64748b;">Status</div>
                  <div style="font-size:16px;font-weight:700;color:#0f172a;">${report.machine.status}</div>
                </td>
                <td style="width:33%;padding:10px;border:1px solid #dbe4ef;border-radius:8px;background:#f8fbff;">
                  <div style="font-size:12px;color:#64748b;">Relay / Mode</div>
                  <div style="font-size:16px;font-weight:700;color:#0f172a;">${report.machine.relayState ?? "on"} / ${report.machine.automationMode ?? "auto"}</div>
                </td>
                <td style="width:33%;padding:10px;border:1px solid #dbe4ef;border-radius:8px;background:#f8fbff;">
                  <div style="font-size:12px;color:#64748b;">Rows / Alerts</div>
                  <div style="font-size:16px;font-weight:700;color:#0f172a;">${report.telemetry.length} / ${(report.alerts ?? []).length}</div>
                </td>
              </tr>
            </table>

            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
              <tr>
                <td style="padding:8px;border:1px solid #dbe4ef;background:#f8fbff;width:180px;"><strong>Machine</strong></td>
                <td style="padding:8px;border:1px solid #dbe4ef;">${report.machine.name}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #dbe4ef;background:#f8fbff;"><strong>Location</strong></td>
                <td style="padding:8px;border:1px solid #dbe4ef;">${report.machine.location}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #dbe4ef;background:#f8fbff;"><strong>Device ID</strong></td>
                <td style="padding:8px;border:1px solid #dbe4ef;">${report.machine.deviceId}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #dbe4ef;background:#f8fbff;"><strong>Date Range</strong></td>
                <td style="padding:8px;border:1px solid #dbe4ef;">${new Date(args.startTimestamp).toLocaleString()} to ${new Date(args.endTimestamp).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #dbe4ef;background:#f8fbff;"><strong>Last Data Received</strong></td>
                <td style="padding:8px;border:1px solid #dbe4ef;">${report.machine.lastDataReceivedAt ? new Date(report.machine.lastDataReceivedAt).toLocaleString() : "N/A"}</td>
              </tr>
            </table>

            <div style="font-size:14px;font-weight:700;margin:12px 0 8px;">Sensors</div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#eff6ff;">
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:left;">Name</th>
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:left;">Type</th>
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:left;">Unit</th>
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:right;">Warn</th>
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:right;">Critical</th>
                </tr>
              </thead>
              <tbody>
                ${sensorRowsHtml}
              </tbody>
            </table>

            <p style="margin-top:16px;color:#475569;">
              Telemetry rows included in report: <strong>${report.telemetry.length}</strong> | Commands: <strong>${(report.commands ?? []).length}</strong> | Notifications: <strong>${(report.notificationLogs ?? []).length}</strong>
            </p>

            <div style="font-size:14px;font-weight:700;margin:12px 0 8px;">Recent Alerts</div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#eff6ff;">
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:left;">Timestamp</th>
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:left;">Level</th>
                  <th style="padding:8px;border:1px solid #dbe4ef;text-align:left;">Message</th>
                </tr>
              </thead>
              <tbody>
                ${recentAlertRowsHtml || `<tr><td colspan="3" style="padding:8px;border:1px solid #dbe4ef;color:#64748b;">No alerts in selected range.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const info: any = await transport.sendMail({
      from: smtpFrom,
      to: args.recipientEmail.trim().toLowerCase(),
      subject: `Machine Report - ${report.machine.name}`,
      text: `Attached is the machine report for ${report.machine.name}.`,
      html,
      attachments: [
        {
          filename,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    return {
      ok: true,
      messageId: info.messageId,
    };
  },
});
