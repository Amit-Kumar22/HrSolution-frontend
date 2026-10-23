export function locationOf(job) {
  return (
    job?.location ||
    [job?.city, job?.state].filter(Boolean).join(", ") ||
    "Location not stated"
  );
}
