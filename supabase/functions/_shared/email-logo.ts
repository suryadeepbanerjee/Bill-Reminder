/**
 * Brand logo for transactional emails — one URL, used by every email the
 * product sends (digest, invite, leave, ownership transfer). Hosted on the
 * landing site as a lightweight 96px PNG so clients can load it quickly.
 * Deployed functions reference this file at build time, not at runtime.
 */

export const EMAIL_LOGO_URL = "https://billreminder.suryadeepbanerjee.in/logo-email.png";

/** Brand logo for email headers — no chip/border, just the mark. */
export const EMAIL_LOGO_HTML = `
<img src="${EMAIL_LOGO_URL}" alt="Bill Reminder" width="52" height="52" style="
  display:block;
  width:52px;
  height:52px;
  margin:0 auto 16px;
" />`;