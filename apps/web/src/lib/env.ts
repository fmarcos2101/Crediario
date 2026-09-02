export function getPublicApiOrigin(): string {
  return process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
}
