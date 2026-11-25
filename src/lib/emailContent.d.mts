export function formatEmailText(value: string): string;
export function escapeEmail(value: string): string;
export function renderEmailContent(
  value: {
    message: string;
    signature?: string;
    logo?: string;
    color?: string;
    align?: string;
    font?: string;
  },
  imageSource?: string,
): string;
