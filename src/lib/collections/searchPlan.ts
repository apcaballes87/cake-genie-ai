export type CollectionSearchPlan =
  | {
      kind: 'text';
      query: string;
      icingColor: null;
    }
  | {
      kind: 'color';
      query: string;
      icingColor: string;
    };

const COLOR_CANONICAL: Record<string, string> = {
  white: 'white',
  black: 'black',
  blue: 'blue',
  pink: 'pink',
  yellow: 'yellow',
  purple: 'purple',
  lavender: 'purple',
  red: 'red',
  green: 'green',
  sage: 'green',
  'sage green': 'green',
  emerald: 'green',
  'emerald green': 'green',
  orange: 'orange',
  brown: 'brown',
  gold: 'yellow',
  silver: 'white',
  maroon: 'red',
  teal: 'blue',
  cream: 'white',
  ivory: 'white',
};

export function cleanCollectionSearchQuery(name: string): string {
  return decodeURIComponent(name)
    .replace(/-/g, ' ')
    .replace(/(?:\s+Cakes?|\s+Themed|\s+Design|\s+Collections?)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCollectionSearchPlan(name: string): CollectionSearchPlan {
  const query = cleanCollectionSearchQuery(name);
  const icingColor = COLOR_CANONICAL[query.toLowerCase()] || null;

  return icingColor
    ? { kind: 'color', query, icingColor }
    : { kind: 'text', query, icingColor: null };
}
