import { z } from 'zod';

const address = z.string().email().max(254);
export function parseEmailRecipients(value: string, field: 'To' | 'CC' | 'BCC') {
  const recipients = [
    ...new Set(
      value
        .split(/[;,\n]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (field === 'To' && !recipients.length)
    throw new Error('Enter at least one recipient email address.');
  if (recipients.length > 20)
    throw new Error(`Enter up to 20 recipients in ${field}, separated by semicolons (;).`);
  if (recipients.some((v) => !address.safeParse(v).success))
    throw new Error(
      `Check each email address in ${field}. Separate addresses with semicolons (;).`,
    );
  return recipients;
}
