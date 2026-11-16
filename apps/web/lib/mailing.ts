import 'server-only';
import type { MailingCatalog } from '@easyrender/core';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export const mailingCatalog: MailingCatalog = { es: es.MailingEmails, en: en.MailingEmails };
export const mailingSystemCopies = { es: es.MailingSystem, en: en.MailingSystem };

export { mailingOriginMap } from '@/lib/mailing-origin';
