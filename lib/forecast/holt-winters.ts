// Holt-Winters triple exponential smoothing — additive seasonality.
// Implementation is self-contained (no external numerical library) so it runs
// in serverless cold starts without bloating the bundle.
//
// Usage:
//   const fit = fitHoltWinters(series, { seasonLength: 7 }); // weekly seasonality
//   const next30 = fit.forecast(30);
//   const diag   = fit.diagnostics();
//
// We use additive (not multiplicative) seasonality because order counts can be
// zero on slow days, and the additive form is well-defined at zero. For revenue
// series, additive in log-space could be better — left as a future tweak.

export type HwOptions = {
  seasonLength?: number;     // typical 7 (weekly) or 30 (monthly). default 7.
  alpha?: number;            // level smoothing 0..1
  beta?: number;             // trend smoothing 0..1
  gamma?: number;            // seasonal smoothing 0..1
};

export type HwPoint = { date: string; value: number };
export type HwForecastPoint = { date: string; predicted: number; lower: number; upper: number };

export type HwFit = {
  level: number;
  trend: number;
  seasonalIndices: number[];   // length = seasonLength
  residuals: number[];         // fit error for confidence band
  forecast: (horizon: number) => HwForecastPoint[];
  diagnostics: () => {
    seasonLength: number;
    alpha: number;
    beta: number;
    gamma: number;
    level: number;
    trend: number;
    seasonalIndices: number[];
    rmse: number;
    mape: number;             // mean absolute percentage error (0..1)
    dataPoints: number;
    z95: number;
  };
};

const DEFAULTS: Required<HwOptions> = {
  seasonLength: 7,
  alpha: 0.3,
  beta: 0.1,
  gamma: 0.2,
};

/** ISO date for the day `n` days after `base`. */
function addDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fit Holt-Winters on a daily time series. Series must be evenly-spaced days. */
export function fitHoltWinters(series: HwPoint[], opts: HwOptions = {}): HwFit | null {
  const o = { ...DEFAULTS, ...opts };
  const n = series.length;
  // Need at least 2 full seasons to estimate seasonal indices reliably.
  if (n < o.seasonLength * 2) return null;

  const values = series.map(p => p.value);

  // Initial level = mean of first season
  let level = values.slice(0, o.seasonLength).reduce((s, v) => s + v, 0) / o.seasonLength;
  // Initial trend = average per-period change between season 1 and season 2
  let trend =
    (values.slice(o.seasonLength, o.seasonLength * 2).reduce((s, v) => s + v, 0) -
      values.slice(0, o.seasonLength).reduce((s, v) => s + v, 0)) /
    (o.seasonLength * o.seasonLength);

  // Initial seasonal indices = avg-detrended for each position
  const seasons = Math.floor(n / o.seasonLength);
  const seasonalIndices = new Array(o.seasonLength).fill(0) as number[];
  for (let i = 0; i < o.seasonLength; i++) {
    let sum = 0;
    let cnt = 0;
    for (let k = 0; k < seasons; k++) {
      const idx = k * o.seasonLength + i;
      if (idx < n) {
        const seasonMean =
          values.slice(k * o.seasonLength, (k + 1) * o.seasonLength).reduce((s, v) => s + v, 0) /
          o.seasonLength;
        sum += values[idx] - seasonMean;
        cnt++;
      }
    }
    seasonalIndices[i] = cnt > 0 ? sum / cnt : 0;
  }

  // Recursive smoothing through the series
  const residuals: number[] = [];
  for (let t = 0; t < n; t++) {
    const seasIdx = t % o.seasonLength;
    const yhat = level + trend + seasonalIndices[seasIdx];
    const y = values[t];
    residuals.push(y - yhat);
    const prevLevel = level;
    level = o.alpha * (y - seasonalIndices[seasIdx]) + (1 - o.alpha) * (level + trend);
    trend = o.beta * (level - prevLevel) + (1 - o.beta) * trend;
    seasonalIndices[seasIdx] =
      o.gamma * (y - level) + (1 - o.gamma) * seasonalIndices[seasIdx];
  }

  // Residual variance → 95% confidence interval
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const rmse = Math.sqrt(sse / Math.max(1, residuals.length - o.seasonLength - 2));
  const z95 = 1.96;
  const mape =
    residuals.reduce((s, r, i) => s + (values[i] === 0 ? 0 : Math.abs(r / values[i])), 0) /
    Math.max(1, residuals.length);

  const lastDate = new Date(series[n - 1].date + 'T00:00:00Z');

  const forecast = (horizon: number): HwForecastPoint[] => {
    const out: HwForecastPoint[] = [];
    for (let h = 1; h <= horizon; h++) {
      const seasIdx = (n + h - 1) % o.seasonLength;
      const predicted = Math.max(0, level + h * trend + seasonalIndices[seasIdx]);
      // CI grows with horizon (sqrt(h) heuristic)
      const band = z95 * rmse * Math.sqrt(h);
      out.push({
        date: addDays(lastDate, h),
        predicted: Math.round(predicted * 100) / 100,
        lower: Math.max(0, Math.round((predicted - band) * 100) / 100),
        upper: Math.round((predicted + band) * 100) / 100,
      });
    }
    return out;
  };

  const diagnostics = () => ({
    seasonLength: o.seasonLength,
    alpha: o.alpha,
    beta: o.beta,
    gamma: o.gamma,
    level,
    trend,
    seasonalIndices: seasonalIndices.slice(),
    rmse,
    mape,
    dataPoints: n,
    z95,
  });

  return { level, trend, seasonalIndices, residuals, forecast, diagnostics };
}

/** Fill missing dates with zero so HW gets a uniformly-spaced series. */
export function densifyDailySeries(
  rows: Array<{ date: string; value: number }>,
  start: Date,
  end: Date
): HwPoint[] {
  const map = new Map(rows.map(r => [r.date, r.value]));
  const out: HwPoint[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (cur <= last) {
    const iso = cur.toISOString().slice(0, 10);
    out.push({ date: iso, value: map.get(iso) || 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
