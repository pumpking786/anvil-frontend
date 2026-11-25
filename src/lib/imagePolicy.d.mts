export const cloudImagePattern: RegExp;
export function isImageSource(value: unknown): value is string;
export function safeImageSource(value: unknown): string;
export function validImageData(value: string): boolean;
