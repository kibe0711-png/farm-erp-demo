/**
 * Maps attendance record activities to LaborSop task names for compliance checking.
 *
 * SOP tasks are high-level (e.g. "Weeding", "Spraying"), while attendance activities
 * are more granular (e.g. "Weeding and Top Dressing", "Harvesting fine beans").
 * This module handles the matching, including typo/word-order variants.
 */

// Explicit mappings for SOP tasks whose names don't match any activity via
// simple normalization. Keys are normalized SOP tasks, values are arrays of
// normalized activity patterns that should count as completing that task.
const EXPLICIT_TASK_MAPPINGS: Record<string, string[]> = {
  "carrying compost": ["carring compost", "tranporting compost", "manure transportation"],
  "fertiliza application": ["fertilizer application", "top dressing"],
  "furrow tracing": ["tracing furrows", "furrows making"],
  "holes digging": ["digging holes", "holingout"],
  "holes digging for stakes": ["digging holes", "holingout"],
  "manure incoporation": ["manure incorporation", "compost incorporation", "manure application"],
  "trelissing": ["trellising", "threllising"],
  "pitmos spreading and sowing": ["sowing", "sowing media preparation"],
  "spraying/drenching": ["spraying", "drenching"],
  "hand weeding and top dressing": ["hand weeding", "weeding and top dressing", "weeding & top dressing"],
  "weeding and top dressing": ["weeding and top dressing", "weeding & top dressing", "hand weeding"],
  "pinching of the broccoli head": ["defloration", "pruning", "prunning"],
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Returns true if the attendance activity should count as completing
 * the given SOP task for compliance purposes.
 */
export function matchActivityToTask(activity: string, sopTask: string): boolean {
  const normActivity = normalize(activity);
  const normTask = normalize(sopTask);

  // 1. Exact match (case-insensitive)
  if (normActivity === normTask) return true;

  // 2. Check explicit mapping table
  const mapped = EXPLICIT_TASK_MAPPINGS[normTask];
  if (mapped && mapped.some((m) => normActivity === m || normActivity.startsWith(m))) {
    return true;
  }

  // 3. Activity starts with the SOP task name (e.g. "Sowing media preparation" matches "Sowing")
  if (normActivity.startsWith(normTask + " ") || normActivity.startsWith(normTask + "/")) {
    return true;
  }

  // 4. SOP task starts with the activity (e.g. "Spraying/Drenching" matches "Spraying")
  if (normTask.startsWith(normActivity + " ") || normTask.startsWith(normActivity + "/")) {
    return true;
  }

  return false;
}
