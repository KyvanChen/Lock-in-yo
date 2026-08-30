"use client";

import { altitudeFt, distanceFlown, phaseLabel, type Route } from "@/lib/flights";

/** Point along the quadratic bezier the arc is drawn with. */
function pointAt(t: number, w: number, h: number) {
  const p0 = { x: 16, y: h - 14 };
  const p1 = { x: w / 2, y: 10 };
  const p2 = { x: w - 16, y: h - 14 };
  const inv = 1 - t;
  return {
    x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
    y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
    // Tangent, so the aircraft points where it is going.
    angle:
      (Math.atan2(
        2 * inv * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
        2 * inv * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      ) *
        180) /
      Math.PI,
  };
}

export function FlightPanel({
  route,
  progress,
  blind,
  arrived,
}: {
  route: Route;
  progress: number;
  blind: boolean;
  arrived: boolean;
}) {
  const W = 320;
  const H = 96;
  const t = Math.max(0, Math.min(1, progress));
  const plane = pointAt(t, W, H);
  const reveal = arrived || !blind;
  const km = distanceFlown(route, t);

  return (
    <section
      className="rounded-card p-4"
      style={{ background: "var(--grouped-secondary)" }}
      aria-label="Flight progress"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-footnote font-semibold uppercase tracking-[0.06em] text-label-secondary">
          {phaseLabel(t)}
        </span>
        <span className="tnum text-footnote text-label-secondary">
          {km.toLocaleString()} / {route.km.toLocaleString()} km
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-title2 font-bold tracking-[-0.01em]">{route.from}</p>
          <p className="truncate text-caption text-label-secondary">
            {route.fromCity}
          </p>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[96px] min-w-0 flex-1"
          role="img"
          aria-label={`${Math.round(t * 100)} percent of the way there`}
        >
          <path
            d={`M16 ${H - 14} Q ${W / 2} 10 ${W - 16} ${H - 14}`}
            fill="none"
            stroke="var(--separator)"
            strokeWidth={2}
            strokeDasharray="4 5"
            strokeLinecap="round"
          />
          {/* Flown portion, drawn by clipping the same curve. */}
          <path
            d={`M16 ${H - 14} Q ${W / 2} 10 ${W - 16} ${H - 14}`}
            fill="none"
            stroke="var(--blue)"
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${t} 1`}
          />
          <circle cx={16} cy={H - 14} r={4} fill="var(--label-tertiary)" />
          <circle
            cx={W - 16}
            cy={H - 14}
            r={4}
            fill={reveal ? "var(--blue)" : "var(--label-quaternary)"}
          />
          <g
            transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle})`}
            style={{ transition: "transform 0.9s linear" }}
          >
            <path
              d="M9 0 L-5 -5 L-3 0 L-5 5 Z"
              fill="var(--blue)"
              stroke="var(--blue)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </g>
        </svg>

        <div className="min-w-0 text-right">
          <p className="text-title2 font-bold tracking-[-0.01em]">
            {reveal ? route.to : "???"}
          </p>
          <p className="truncate text-caption text-label-secondary">
            {reveal ? route.toCity : "Revealed on landing"}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: "var(--separator)" }}>
        <div>
          <dt className="text-caption2 uppercase tracking-[0.06em] text-label-tertiary">
            Altitude
          </dt>
          <dd className="tnum text-subheadline font-semibold">
            {altitudeFt(t).toLocaleString()} ft
          </dd>
        </div>
        <div>
          <dt className="text-caption2 uppercase tracking-[0.06em] text-label-tertiary">
            Real block time
          </dt>
          <dd className="tnum text-subheadline font-semibold">
            {Math.floor(route.minutes / 60)}h {route.minutes % 60}m
          </dd>
        </div>
        <div>
          <dt className="text-caption2 uppercase tracking-[0.06em] text-label-tertiary">
            Progress
          </dt>
          <dd className="tnum text-subheadline font-semibold">
            {Math.round(t * 100)}%
          </dd>
        </div>
      </dl>
    </section>
  );
}
