/**
 * Self-contained Free Spaced Repetition Scheduler, FSRS-4.5 model.
 * Parameter defaults and update equations from the open-spaced-repetition project.
 * https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
 * Time-of-day learning/relearning steps (1m / 10m) are a UI policy layered on the
 * FSRS memory-state model. No network calls or runtime dependencies.
 */
export const MODEL = 'FSRS-4.5';
export const WEIGHTS = Object.freeze([0.4872,1.4003,3.7145,13.8206,5.1618,1.2298,0.8975,0.031,1.6474,0.1367,1.0461,2.1072,0.0793,0.3246,1.587,0.2272,2.8755]);
const DAY = 86400000;
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
const initialDifficulty = (g) => clamp(WEIGHTS[4] - (g - 3) * WEIGHTS[5], 1, 10);
const initialStability = (g) => WEIGHTS[g - 1];

export function retrievability(schedule, now = Date.now()) {
  if (!schedule?.lastReviewedAt || !schedule?.stability) return null;
  const elapsedDays = Math.max(0, (now - Date.parse(schedule.lastReviewedAt)) / DAY);
  return Math.pow(1 + 19 * elapsedDays / (81 * schedule.stability), -0.5);
}

export function scheduleReview(previous, grade, now = Date.now(), retention = 0.9) {
  if (![1,2,3,4].includes(grade)) throw new Error('Rating must be 1, 2, 3, or 4');
  if (!Number.isFinite(now)) throw new Error('Invalid review timestamp');
  const before = previous || {};
  const seen = !!(before.reps > 0 && before.lastReviewedAt);
  const R = seen ? retrievability(before, now) : 1;
  let stability, difficulty;
  if (!seen) {
    stability = initialStability(grade);
    difficulty = initialDifficulty(grade);
  } else {
    const S = clamp(Number(before.stability) || 0.1, 0.01, 36500);
    const D = clamp(Number(before.difficulty) || 5, 1, 10);
    const adjusted = D - WEIGHTS[6] * (grade - 3);
    difficulty = clamp(WEIGHTS[7] * WEIGHTS[4] + (1 - WEIGHTS[7]) * adjusted, 1, 10);
    if (grade === 1) {
      stability = Math.min(WEIGHTS[11] * Math.pow(D, -WEIGHTS[12]) *
        (Math.pow(S + 1, WEIGHTS[13]) - 1) * Math.exp(WEIGHTS[14] * (1 - R)), S);
    } else {
      stability = S * (1 + Math.exp(WEIGHTS[8]) * (11 - D) * Math.pow(S, -WEIGHTS[9]) *
        (Math.exp(WEIGHTS[10] * (1 - R)) - 1) *
        (grade === 2 ? WEIGHTS[15] : 1) * (grade === 4 ? WEIGHTS[16] : 1));
    }
  }
  stability = clamp(stability, 0.01, 36500);
  retention = clamp(retention, 0.7, 0.97);
  const days = Math.max(1, Math.min(36500, Math.round(81 * stability / 19 * (Math.pow(retention,-2)-1))));
  let intervalMinutes = days * 1440;
  let learning = false;
  if (grade === 1) {
    intervalMinutes = 1;
    learning = true;
  } else if (grade === 2 && (!seen || before.learning || (before.reps || 0) < 2)) {
    intervalMinutes = 10;
    learning = true;
  }
  const dueAt = new Date(now + intervalMinutes * 60000).toISOString();
  return {
    dueAt, lastReviewedAt: new Date(now).toISOString(), stability, difficulty,
    reps: (before.reps || 0) + 1, lapses: (before.lapses || 0) + (grade === 1 ? 1 : 0),
    lastRating: grade, learning, intervalMinutes, model: MODEL
  };
}

export function dueLabel(schedule, now=Date.now()) {
  if (!schedule) return 'New';
  const diff = Date.parse(schedule.dueAt) - now;
  if (diff <= 0) return 'Due now';
  if (diff < 3600000) return `In ${Math.max(1, Math.ceil(diff/60000))}m`;
  if (diff < DAY) return `In ${Math.ceil(diff/3600000)}h`;
  return `In ${Math.ceil(diff/DAY)}d`;
}

export function previewIntervals(previous, now=Date.now(), retention=0.9) {
  return [1,2,3,4].map(g => {
    const s = scheduleReview(previous,g,now,retention);
    const m = s.intervalMinutes;
    return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m/60)}h` : `${Math.round(m/1440)}d`;
  });
}
