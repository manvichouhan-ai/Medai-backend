export function computeAdherenceRate(logs) {
  if (!logs.length) return 0;
  const completed = logs.filter((l) => l.status === 'taken' || l.status === 'delayed').length;
  return Math.round((completed / logs.length) * 100);
}

export function computeStreak(logs) {
  const sorted = [...logs].sort((a, b) => b.scheduledTime - a.scheduledTime);
  let streak = 0;
  for (const log of sorted) {
    if (log.status === 'taken' || log.status === 'delayed') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function computeDelayMean(logs) {
  const delayed = logs.filter((l) => l.delayMinutes > 0);
  if (!delayed.length) return 0;
  const sum = delayed.reduce((acc, l) => acc + l.delayMinutes, 0);
  return Math.round(sum / delayed.length);
}
