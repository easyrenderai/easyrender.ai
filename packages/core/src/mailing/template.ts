import { isServiceEmailLocale } from '../service-email-locale';
import { escapeMailHtml as htmlEscape } from './security';

export const RESULT_PREVIEW_CID = 'render-preview';

export type EmailAction = { url: string; label: string };
export type BrandedEmail = {
  appUrl: string;
  lang?: string;
  title: string;
  preheader: string;
  body: string;
  action?: EmailAction;
  previewAlt?: string;
  notice?: string;
  signature?: string;
  footerReason?: string;
  footerLinks?: EmailAction[];
  identity: string;
};

// Email clients cannot load the app's CSS variables. These are the product's zinc roles
// from DESIGN.md, resolved once here; no new accent palette or remote fonts.
const color = {
  background: '#F4F4F5',
  card: '#FFFFFF',
  previewBackground: '#EEEEEE',
  foreground: '#18181B',
  muted: '#52525B',
  border: '#E4E4E7',
  primary: '#18181B',
  onPrimary: '#FAFAFA',
};
function destination(value: string, origin: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
    throw new Error('Invalid email destination');
  return htmlEscape(value);
}
function paragraphs(value: string, style: string): string {
  return value
    .split(/\n\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 20px;${style}">${htmlEscape(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}
/** Static HTML and inline styles work without JavaScript, web fonts or image loading. */
export function renderBrandedEmail(mail: BrandedEmail): string {
  const origin = new URL(mail.appUrl).origin;
  const lang = mail.lang === 'pt-PT' || isServiceEmailLocale(mail.lang) ? mail.lang : 'en';
  const home = destination(mail.appUrl, origin);
  const logo = destination(`${origin}/email/brand-mark.png`, origin);
  const bodyStyle = `font-size:16px;line-height:1.65;color:${color.foreground};overflow-wrap:anywhere;word-break:break-word`;
  const mutedStyle = `font-size:13px;line-height:1.6;color:${color.muted};overflow-wrap:anywhere`;
  const action = mail.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px"><tr><td bgcolor="${color.primary}" style="border-radius:8px;text-align:center"><a href="${destination(mail.action.url, origin)}" style="display:inline-block;background-color:${color.primary};color:${color.onPrimary};border:1px solid ${color.primary};border-radius:8px;padding:15px 24px;font-size:16px;line-height:1.5;font-weight:bold;text-decoration:none;mso-padding-alt:0;text-underline-color:${color.primary}"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt" hidden>&emsp;</i><![endif]-->${htmlEscape(mail.action.label)}<!--[if mso]><i style="mso-font-width:150%" hidden>&emsp;&#8203;</i><![endif]--></a></td></tr></table>`
    : '';
  const preview =
    mail.previewAlt && mail.action
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr><td align="center" bgcolor="${color.previewBackground}" style="border:1px solid ${color.border};border-radius:8px"><a href="${destination(mail.action.url, origin)}" style="display:block;color:${color.foreground};text-decoration:none"><img src="cid:${RESULT_PREVIEW_CID}" width="320" alt="${htmlEscape(mail.previewAlt)}" style="display:block;margin:0 auto;width:100%;max-width:320px;height:auto;border:0"></a></td></tr></table>`
      : '';
  const links = (mail.footerLinks ?? [])
    .map(
      (link) =>
        `<a href="${destination(link.url, origin)}" style="color:${color.muted};text-decoration:underline;display:inline-block;padding:6px 0">${htmlEscape(link.label)}</a>`,
    )
    .join(' &nbsp;·&nbsp; ');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${htmlEscape(mail.title)}</title></head>
<body style="margin:0;padding:0;background-color:${color.background};color:${color.foreground};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${htmlEscape(mail.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${color.background}"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${color.card}" style="max-width:600px;border:1px solid ${color.border};border-radius:12px">
<tr><td style="padding:28px 24px;border-bottom:1px solid ${color.border}"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="40" style="vertical-align:middle"><img src="${logo}" width="32" height="32" alt="" style="display:block;border:0;background-color:${color.card};border-radius:50%"></td><td style="vertical-align:middle"><a href="${home}" style="font-size:24px;line-height:32px;font-weight:bold;letter-spacing:-1px;color:${color.foreground};text-decoration:none">easyrender</a></td></tr></table></td></tr>
<tr><td style="padding:32px 24px 12px"><h1 style="margin:0 0 24px;font-size:28px;line-height:1.2;font-weight:bold;letter-spacing:-0.6px;color:${color.foreground};overflow-wrap:anywhere">${htmlEscape(mail.title)}</h1>
${paragraphs(mail.body, bodyStyle)}
${mail.signature ? paragraphs(mail.signature, bodyStyle) : ''}
${action}
${preview}
${mail.notice ? paragraphs(mail.notice, mutedStyle) : ''}
</td></tr>
<tr><td style="padding:24px;border-top:1px solid ${color.border}">
${mail.footerReason ? paragraphs(mail.footerReason, mutedStyle) : ''}
${paragraphs(mail.identity, mutedStyle)}
${links ? `<p style="margin:0;${mutedStyle}">${links}</p>` : ''}
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
