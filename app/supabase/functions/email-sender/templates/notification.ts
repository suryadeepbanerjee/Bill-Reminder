export const notificationEmailTemplate = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{{title}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #1a1a2e; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .content { padding: 24px !important; }
      .bill-table td { display: block !important; width: 100% !important; padding: 8px 0 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#1a1a2e;">
  <center>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#1a1a2e;">
      <tr>
        <td style="padding:40px 0;">
          <table class="container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="max-width:600px; margin:0 auto;">
            <!-- Header -->
            <tr>
              <td style="background-color:#b69317; padding:32px 40px; border-radius:12px 12px 0 0; text-align:center;">
                <h1 style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:26px; font-weight:700; color:#ffffff; letter-spacing:-0.5px;">
                  Bill Reminder
                </h1>
                <p style="margin:8px 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:rgba(255,255,255,0.85);">
                  {{subtitle}}
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="content" style="background-color:#ffffff; padding:32px 40px;">
                <p style="margin:0 0 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; color:#334155; line-height:1.6;">
                  {{message}}
                </p>

                <!-- Bill card -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                  <tr>
                    <td style="background-color:#fefce8; padding:16px 20px; border-bottom:1px solid #e2e8f0;">
                      <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#92400e; text-transform:uppercase; letter-spacing:0.5px;">
                        Bill Details
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <table class="bill-table" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="padding:14px 20px; border-bottom:1px solid #f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#64748b; width:40%;">
                            Bill Name
                          </td>
                          <td style="padding:14px 20px; border-bottom:1px solid #f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#0f172a; font-weight:600;">
                            {{billName}}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:14px 20px; border-bottom:1px solid #f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#64748b;">
                            Amount
                          </td>
                          <td style="padding:14px 20px; border-bottom:1px solid #f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#0f172a; font-weight:600;">
                            {{amount}}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:14px 20px; border-bottom:1px solid #f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#64748b;">
                            Due Date
                          </td>
                          <td style="padding:14px 20px; border-bottom:1px solid #f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#0f172a; font-weight:600;">
                            {{dueDate}}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:14px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#64748b;">
                            Status
                          </td>
                          <td style="padding:14px 20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; font-weight:600; color:{{statusColor}};">
                            {{status}}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CTA Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:32px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{actionUrl}}" target="_blank" style="display:inline-block; background-color:#b69317; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; font-weight:600; letter-spacing:0.3px;">
                        View Bill Details
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#f8fafc; padding:24px 40px; border-top:1px solid #e2e8f0; border-radius:0 0 12px 12px; text-align:center;">
                <p style="margin:0 0 8px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; color:#94a3b8;">
                  This is an automated reminder from Bill Reminder.
                </p>
                <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; color:#94a3b8;">
                  <a href="https://billreminder.suryadeepbanerjee.in/settings" style="color:#b69317; text-decoration:none;">Manage notification settings</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

export function renderNotificationEmail(data: {
  title: string;
  message: string;
  billName: string;
  amount: string;
  dueDate: string;
  status: string;
  actionUrl: string;
  subtitle?: string;
}): string {
  const statusColorMap: Record<string, string> = {
    overdue:          "#dc2626",
    due_today:        "#ea580c",
    expected_payment: "#b69317",
    generated:        "#2563eb",
    upcoming:         "#64748b",
    paid:             "#16a34a",
  };
  const statusColor = statusColorMap[data.status] || "#64748b";

  const subtitleMap: Record<string, string> = {
    overdue:          "Overdue — action needed",
    due_today:        "Due today",
    expected_payment: "Payment expected soon",
    generated:        "New occurrence generated",
    upcoming:         "Upcoming bill",
    paid:             "Marked as paid",
  };
  const subtitle = data.subtitle || subtitleMap[data.status] || "Bill Reminder";

  return notificationEmailTemplate
    .replace(/\{\{title\}\}/g, data.title)
    .replace(/\{\{subtitle\}\}/g, subtitle)
    .replace(/\{\{message\}\}/g, data.message)
    .replace(/\{\{billName\}\}/g, data.billName)
    .replace(/\{\{amount\}\}/g, data.amount)
    .replace(/\{\{dueDate\}\}/g, data.dueDate)
    .replace(/\{\{status\}\}/g, data.status.replace(/_/g, " "))
    .replace(/\{\{statusColor\}\}/g, statusColor)
    .replace(/\{\{actionUrl\}\}/g, data.actionUrl);
}
