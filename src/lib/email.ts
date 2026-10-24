/** Light client-side check; the real validation is Supabase's. Keeps typos from costing an email. */
export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
