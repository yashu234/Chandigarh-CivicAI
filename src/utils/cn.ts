/**
 * Simple, zero-dependency className utility
 * Joins class strings while filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
