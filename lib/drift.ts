export const MIN_PRIOR_JOBS = 3;
export const MIN_STANDARD_DEVIATION_BP = 20;
export const MIN_DRIFT_BP = 50;
export const MIN_Z_SCORE = 2;

export type DriftResult = {
  alert: boolean;
  meanBp: number;
  standardDeviationBp: number;
  zScore: number;
  jobsCompared: number;
};

// Assumption: compare the latest closed job with this karigar's own earlier jobs.
// Formula: mean = sum(prior lossBp) / n; standard deviation is population SD
// of the earlier closed jobs, with a 20 bp floor;
// z = (latest lossBp - mean) / max(SD, 20 bp). Alert only when z >= 2 and
// latest lossBp is at least 50 bp above the mean, so improvement never alerts.
export function evaluateDrift(priorLossBp: number[], latestLossBp: number): DriftResult {
  if (priorLossBp.length < MIN_PRIOR_JOBS) {
    return { alert: false, meanBp: 0, standardDeviationBp: MIN_STANDARD_DEVIATION_BP, zScore: 0, jobsCompared: priorLossBp.length };
  }
  const meanBp = priorLossBp.reduce((sum, value) => sum + value, 0) / priorLossBp.length;
  const variance = priorLossBp.reduce((sum, value) => sum + (value - meanBp) ** 2, 0) / priorLossBp.length;
  const standardDeviationBp = Math.max(Math.sqrt(variance), MIN_STANDARD_DEVIATION_BP);
  const zScore = (latestLossBp - meanBp) / standardDeviationBp;
  return {
    alert: zScore >= MIN_Z_SCORE && latestLossBp - meanBp >= MIN_DRIFT_BP,
    meanBp,
    standardDeviationBp,
    zScore,
    jobsCompared: priorLossBp.length,
  };
}
