export const notificationEmailTemplate = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>{{title}}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG />
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body, table, td, a {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        body {
            margin: 0;
            padding: 0;
            width: 100% !important;
            height: 100% !important;
            background-color: #000000;
        }

        .font-sans {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        @media only screen and (max-width: 620px) {
            .container {
                width: 100% !important;
                min-width: 100% !important;
            }
            .header-cell {
                padding: 32px 20px 28px !important;
                border-radius: 16px 16px 0 0 !important;
            }
            .body-cell {
                padding: 28px 16px !important;
            }
            .footer-cell {
                padding: 22px 16px !important;
                border-radius: 0 0 16px 16px !important;
            }
            .bill-label, .bill-value {
                display: block !important;
                width: 100% !important;
                padding: 10px 16px !important;
                text-align: left !important;
                box-sizing: border-box !important;
            }
            .bill-label {
                border-bottom: none !important;
                padding-bottom: 2px !important;
                font-size: 10px !important;
                letter-spacing: 0.8px !important;
            }
            .bill-value {
                border-bottom: 1px solid #2a2a2a !important;
                padding-top: 0 !important;
                font-size: 15px !important;
            }
            .cta-btn {
                display: block !important;
                width: 100% !important;
                box-sizing: border-box !important;
                text-align: center !important;
                padding: 15px 0 !important;
                font-size: 15px !important;
            }
            .message-text {
                font-size: 14px !important;
            }
            .card-title {
                font-size: 10px !important;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#000000;">
    <center>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#000000;">
            <tr>
                <td style="padding:40px 12px 32px;">
                    <table class="container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" align="center" style="max-width:540px; margin:0 auto;">

                        <!-- HEADER -->
                        <tr>
                            <td class="header-cell" style="
                                background: #111111;
                                padding: 40px 36px 36px;
                                border-radius: 16px 16px 0 0;
                                text-align: center;
                                border: 1px solid #222222;
                                border-bottom: none;
                            ">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 16px;">
                                    <tr>
                                        <td style="
                                            width: 52px;
                                            height: 52px;
                                            background-color: rgba(182,147,24,0.1);
                                            border-radius: 50%;
                                            text-align: center;
                                            vertical-align: middle;
                                        ">
                                            <span style="font-size:24px; line-height:52px;">🔔</span>
                                        </td>
                                    </tr>
                                </table>
                                <p style="
                                    margin:0 0 12px;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                    font-size:10px;
                                    font-weight:700;
                                    color:#b69318;
                                    text-transform:uppercase;
                                    letter-spacing:2.5px;
                                    display:inline-block;
                                    background-color:rgba(182,147,24,0.12);
                                    padding:5px 14px;
                                    border-radius:20px;
                                ">
                                    BILL REMINDER
                                </p>
                                <h1 style="
                                    margin:0 0 8px;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                    font-size:22px;
                                    font-weight:700;
                                    color:#ffffff;
                                    line-height:1.3;
                                    letter-spacing:-0.2px;
                                ">
                                    {{title}}
                                </h1>
                                <p style="
                                    margin:0;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                    font-size:14px;
                                    color:rgba(255,255,255,0.65);
                                    line-height:1.5;
                                ">
                                    {{subtitle}}
                                </p>
                            </td>
                        </tr>

                        <!-- BODY -->
                        <tr>
                            <td class="body-cell" style="
                                background-color:#0a0a0a;
                                padding:32px 36px;
                                border-left:1px solid #222222;
                                border-right:1px solid #222222;
                            ">
                                <p class="message-text" style="
                                    margin:0 0 28px;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                    font-size:15px;
                                    color:#dddddd;
                                    line-height:1.7;
                                    letter-spacing:0.1px;
                                ">
                                    {{message}}
                                </p>

                                <!-- BILL CARD -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="
                                    margin:0 0 28px;
                                    border:1px solid #2a2a2a;
                                    border-radius:12px;
                                    overflow:hidden;
                                    background-color:#111111;
                                ">
                                    <tr>
                                        <td style="
                                            background-color:#1a1a1a;
                                            padding:14px 20px;
                                            border-bottom:1px solid #2a2a2a;
                                        ">
                                            <p class="card-title" style="
                                                margin:0;
                                                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                font-size:11px;
                                                font-weight:700;
                                                color:#b69318;
                                                text-transform:uppercase;
                                                letter-spacing:1.2px;
                                            ">
                                                Bill Details
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td class="bill-label" style="
                                                        padding:16px 20px;
                                                        border-bottom:1px solid #1e1e1e;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:11px;
                                                        color:#888888;
                                                        text-transform:uppercase;
                                                        letter-spacing:0.7px;
                                                        width:36%;
                                                        vertical-align:top;
                                                        background-color:#0f0f0f;
                                                    ">
                                                        Bill Name
                                                    </td>
                                                    <td class="bill-value" style="
                                                        padding:16px 20px;
                                                        border-bottom:1px solid #1e1e1e;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:15px;
                                                        color:#ffffff;
                                                        font-weight:600;
                                                        vertical-align:top;
                                                    ">
                                                        {{billName}}
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td class="bill-label" style="
                                                        padding:16px 20px;
                                                        border-bottom:1px solid #1e1e1e;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:11px;
                                                        color:#888888;
                                                        text-transform:uppercase;
                                                        letter-spacing:0.7px;
                                                        width:36%;
                                                        vertical-align:top;
                                                        background-color:#0f0f0f;
                                                    ">
                                                        Amount
                                                    </td>
                                                    <td class="bill-value" style="
                                                        padding:16px 20px;
                                                        border-bottom:1px solid #1e1e1e;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:18px;
                                                        color:#ffffff;
                                                        font-weight:700;
                                                        vertical-align:top;
                                                        letter-spacing:-0.3px;
                                                    ">
                                                        {{amount}}
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td class="bill-label" style="
                                                        padding:16px 20px;
                                                        border-bottom:1px solid #1e1e1e;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:11px;
                                                        color:#888888;
                                                        text-transform:uppercase;
                                                        letter-spacing:0.7px;
                                                        width:36%;
                                                        vertical-align:top;
                                                        background-color:#0f0f0f;
                                                    ">
                                                        Due Date
                                                    </td>
                                                    <td class="bill-value" style="
                                                        padding:16px 20px;
                                                        border-bottom:1px solid #1e1e1e;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:15px;
                                                        color:#ffffff;
                                                        font-weight:600;
                                                        vertical-align:top;
                                                    ">
                                                        {{dueDate}}
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td class="bill-label" style="
                                                        padding:16px 20px;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:11px;
                                                        color:#888888;
                                                        text-transform:uppercase;
                                                        letter-spacing:0.7px;
                                                        width:36%;
                                                        vertical-align:top;
                                                        background-color:#0f0f0f;
                                                        border-bottom:none !important;
                                                    ">
                                                        Status
                                                    </td>
                                                    <td class="bill-value" style="
                                                        padding:16px 20px;
                                                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                        font-size:13px;
                                                        font-weight:700;
                                                        vertical-align:top;
                                                        border-bottom:none !important;
                                                    ">
                                                        <span style="
                                                            display:inline-block;
                                                            background-color:{{statusColor}}20;
                                                            color:{{statusColor}};
                                                            padding:6px 14px;
                                                            border-radius:20px;
                                                            font-size:11px;
                                                            letter-spacing:0.6px;
                                                            text-transform:uppercase;
                                                            border:1px solid {{statusColor}}40;
                                                        ">
                                                            {{status}}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <!-- CTA BUTTON -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0;">
                                    <tr>
                                        <td align="center" style="padding:0;">
                                            <a href="{{actionUrl}}" target="_blank" class="cta-btn" style="
                                                display:inline-block;
                                                background-color:#b69318;
                                                color:#000000;
                                                text-decoration:none;
                                                padding:15px 44px;
                                                border-radius:8px;
                                                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                                font-size:15px;
                                                font-weight:700;
                                                letter-spacing:0.4px;
                                                text-align:center;
                                                box-shadow:0 4px 14px rgba(182,147,24,0.25);
                                            ">
                                                View Bill Details →
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td class="footer-cell" style="
                                background-color:#0a0a0a;
                                padding:22px 36px;
                                border-left:1px solid #222222;
                                border-right:1px solid #222222;
                                border-bottom:1px solid #222222;
                                border-radius:0 0 16px 16px;
                                text-align:center;
                            ">
                                <p style="
                                    margin:0;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                    font-size:12px;
                                    color:#666666;
                                    letter-spacing:0.2px;
                                ">
                                    Automated reminder from <strong style="color:#888888;">Bill Reminder</strong>
                                </p>
                            </td>
                        </tr>

                        <!-- TINY COPYRIGHT -->
                        <tr>
                            <td style="padding:16px 0 0; text-align:center;">
                                <p style="
                                    margin:0;
                                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                    font-size:10px;
                                    color:#444444;
                                    letter-spacing:0.4px;
                                ">
                                    © {{year}} Bill Reminder
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
		overdue: "#dc2626",
		due_today: "#ea580c",
		expected_payment: "#b69317",
		generated: "#2563eb",
		upcoming: "#64748b",
		paid: "#16a34a",
	};
	const statusColor = statusColorMap[data.status] || "#64748b";

	const subtitleMap: Record<string, string> = {
		overdue: "Overdue — action needed",
		due_today: "Due today",
		expected_payment: "Payment expected soon",
		generated: "New occurrence generated",
		upcoming: "Upcoming bill",
		paid: "Marked as paid",
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
