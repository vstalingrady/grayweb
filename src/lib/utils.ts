type ClassValue = string | number | null | false | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).map(String).join(" ");
}
