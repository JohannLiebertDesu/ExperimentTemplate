export const Settings = {
  // Set to a number to cap enrollment at that many participants.
  // The cap is checked at consent using the batch session's "started" counter.
  // null = no cap (check is skipped entirely).
  maxParticipants: null,

  // Set to true when distributing through Prolific.
  // Prolific manages its own participant counts, so the cap check is skipped.
  useProlific: false,

  // List of condition labels to cycle through, assigned round-robin across participants.
  // e.g. ['A', 'B'] or ['control', 'treatment'] or ['0deg', '45deg', '90deg'].
  // null = no condition assignment.
  conditions: null,

  // Minimum browser window dimensions (checked after entering fullscreen).
  // If the screen is smaller, the experiment ends with "failed_resize".
  minScreenWidth: 1200,
  minScreenHeight: 700,

  // Maximum number of times a participant can leave the browser tab (blur events)
  // before the experiment ends with "failed_attention_check".
  // null = no blur tracking.
  maxBlurs: 2,
};
