/**
 * Random flight mode.
 *
 * You pick a length, the app picks a real route, and the block becomes a
 * flight: you take off, the aircraft tracks across the map, and you land when
 * the timer ends. In "random route" you do not see the destination until you
 * arrive — the reveal is the reward for staying in your seat.
 *
 * Distances are great-circle kilometres; block times are typical scheduled
 * gate-to-gate figures. Nothing here calls a live API, so it works offline and
 * needs no keys.
 */
export interface Route {
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  /** Great-circle distance in km. */
  km: number;
  /** Typical scheduled block time in minutes. */
  minutes: number;
}

export const ROUTES: Route[] = [
  { from: "SFO", fromCity: "San Francisco", to: "SMF", toCity: "Sacramento", km: 137, minutes: 50 },
  { from: "LAX", fromCity: "Los Angeles", to: "SAN", toCity: "San Diego", km: 179, minutes: 50 },
  { from: "SIN", fromCity: "Singapore", to: "KUL", toCity: "Kuala Lumpur", km: 296, minutes: 60 },
  { from: "JFK", fromCity: "New York", to: "BOS", toCity: "Boston", km: 300, minutes: 65 },
  { from: "LHR", fromCity: "London", to: "CDG", toCity: "Paris", km: 348, minutes: 75 },
  { from: "AUH", fromCity: "Abu Dhabi", to: "MCT", toCity: "Muscat", km: 370, minutes: 65 },
  { from: "DXB", fromCity: "Dubai", to: "DOH", toCity: "Doha", km: 379, minutes: 65 },
  { from: "BOS", fromCity: "Boston", to: "YUL", toCity: "Montreal", km: 400, minutes: 90 },
  { from: "DUB", fromCity: "Dublin", to: "LHR", toCity: "London", km: 449, minutes: 80 },
  { from: "CPH", fromCity: "Copenhagen", to: "OSL", toCity: "Oslo", km: 483, minutes: 75 },
  { from: "MAD", fromCity: "Madrid", to: "LIS", toCity: "Lisbon", km: 503, minutes: 80 },
  { from: "ARN", fromCity: "Stockholm", to: "CPH", toCity: "Copenhagen", km: 522, minutes: 70 },
  { from: "SFO", fromCity: "San Francisco", to: "LAX", toCity: "Los Angeles", km: 543, minutes: 85 },
  { from: "YYZ", fromCity: "Toronto", to: "JFK", toCity: "New York", km: 570, minutes: 95 },
  { from: "VIE", fromCity: "Vienna", to: "ZRH", toCity: "Zurich", km: 600, minutes: 85 },
  { from: "SYD", fromCity: "Sydney", to: "MEL", toCity: "Melbourne", km: 705, minutes: 90 },
  { from: "HND", fromCity: "Tokyo", to: "CTS", toCity: "Sapporo", km: 820, minutes: 95 },
  { from: "SFO", fromCity: "San Francisco", to: "PDX", toCity: "Portland", km: 880, minutes: 110 },
  { from: "ATL", fromCity: "Atlanta", to: "MIA", toCity: "Miami", km: 975, minutes: 115 },
  { from: "DEN", fromCity: "Denver", to: "PHX", toCity: "Phoenix", km: 975, minutes: 125 },
  { from: "SEA", fromCity: "Seattle", to: "SFO", toCity: "San Francisco", km: 1093, minutes: 125 },
  { from: "CDG", fromCity: "Paris", to: "FCO", toCity: "Rome", km: 1105, minutes: 130 },
  { from: "BOM", fromCity: "Mumbai", to: "DEL", toCity: "Delhi", km: 1148, minutes: 130 },
  { from: "KUL", fromCity: "Kuala Lumpur", to: "BKK", toCity: "Bangkok", km: 1180, minutes: 130 },
  { from: "JFK", fromCity: "New York", to: "ORD", toCity: "Chicago", km: 1188, minutes: 155 },
  { from: "AMS", fromCity: "Amsterdam", to: "BCN", toCity: "Barcelona", km: 1240, minutes: 140 },
  { from: "ICN", fromCity: "Seoul", to: "NRT", toCity: "Tokyo", km: 1259, minutes: 140 },
  { from: "JNB", fromCity: "Johannesburg", to: "CPT", toCity: "Cape Town", km: 1270, minutes: 130 },
  { from: "MEX", fromCity: "Mexico City", to: "CUN", toCity: "Cancun", km: 1300, minutes: 140 },
  { from: "SIN", fromCity: "Singapore", to: "BKK", toCity: "Bangkok", km: 1425, minutes: 140 },
  { from: "ORD", fromCity: "Chicago", to: "DEN", toCity: "Denver", km: 1476, minutes: 155 },
  { from: "LAX", fromCity: "Los Angeles", to: "SEA", toCity: "Seattle", km: 1543, minutes: 170 },
  { from: "LHR", fromCity: "London", to: "LIS", toCity: "Lisbon", km: 1565, minutes: 165 },
  { from: "GRU", fromCity: "Sao Paulo", to: "EZE", toCity: "Buenos Aires", km: 1670, minutes: 160 },
  { from: "HKG", fromCity: "Hong Kong", to: "BKK", toCity: "Bangkok", km: 1690, minutes: 170 },
  { from: "FRA", fromCity: "Frankfurt", to: "IST", toCity: "Istanbul", km: 1868, minutes: 180 },
  { from: "DOH", fromCity: "Doha", to: "BOM", toCity: "Mumbai", km: 1927, minutes: 185 },
];

export interface Flight {
  route: Route;
  /** Hide the destination until touchdown. */
  blind: boolean;
}

/**
 * Choose a route whose real block time sits near the session length, then pick
 * randomly among the closest handful so repeat sessions still feel different.
 */
export function pickRoute(sessionMinutes: number, exclude?: string): Route {
  const ranked = [...ROUTES]
    .filter((r) => `${r.from}${r.to}` !== exclude)
    .sort(
      (a, b) =>
        Math.abs(a.minutes - sessionMinutes) -
        Math.abs(b.minutes - sessionMinutes),
    );
  const pool = ranked.slice(0, Math.min(8, ranked.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function routeKey(r: Route): string {
  return `${r.from}${r.to}`;
}

/** Kilometres covered so far, given fractional progress through the block. */
export function distanceFlown(route: Route, progress: number): number {
  return Math.round(route.km * Math.max(0, Math.min(1, progress)));
}

/** Cruise altitude ramps up over the first 12% and back down over the last 15%. */
export function altitudeFt(progress: number): number {
  const cruise = 36_000;
  if (progress <= 0) return 0;
  if (progress < 0.12) return Math.round((progress / 0.12) * cruise);
  if (progress > 0.85) return Math.round(((1 - progress) / 0.15) * cruise);
  return cruise;
}

export function phaseLabel(progress: number): string {
  if (progress <= 0) return "At the gate";
  if (progress < 0.06) return "Taking off";
  if (progress < 0.12) return "Climbing";
  if (progress > 0.99) return "Arrived";
  if (progress > 0.85) return "Descending";
  return "Cruising";
}
