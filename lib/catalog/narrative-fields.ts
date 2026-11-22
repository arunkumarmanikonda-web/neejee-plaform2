/** Existing merchandise titles survive creation. A house name such as “Neel” is an alias. */
export function narrativeTitleIsFinal(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const name = value.trim();
  return name.split(/\s+/).length > 1 &&
    /\b(sarees?|saris?|suits?|kurt[ai]s?|palazzos?|dupattas?|blouses?|juttis?|shirts?|dresses|dress|sets?|lamps?|vases?|bowls?|urlis?|plates?|jars?|tables?|chairs?|stools?|benches|beds?|mirrors?|earrings?|jhumkas?|pendants?|necklaces?|bangles?|rings?|perfumes?|attars?|cushions?|throws?|shelves|trays?|pots?|mugs?)\b/i.test(name);
}
