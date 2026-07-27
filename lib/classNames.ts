export function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}
