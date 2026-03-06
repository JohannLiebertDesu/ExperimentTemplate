export const Settings = {
  // Set to a number to cap enrollment at that many participants.
  // The cap is checked at consent using the batch session's "started" counter.
  // null = no cap (check is skipped entirely).
  maxParticipants: null,

  // Set to true when distributing through Prolific.
  // Prolific manages its own participant counts, so the cap check is skipped.
  useProlific: false,
};
