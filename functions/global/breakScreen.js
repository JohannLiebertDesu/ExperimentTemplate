/**
 * Generates a break screen trial to insert between experiment blocks.
 *
 * Shows block progress (visual bar + text), a brief encouragement to rest,
 * and a "Continue" button that is disabled for a few seconds to ensure the
 * participant actually pauses before resuming.
 *
 * Usage in your timeline:
 *   import { makeBreakTrial } from "../../functions/global/breakScreen.js";
 *
 *   for (let i = 0; i < totalBlocks; i++) {
 *     timeline.push(blockTrials[i]);
 *     if (i < totalBlocks - 1) {
 *       timeline.push(makeBreakTrial(i + 1, totalBlocks));
 *     }
 *   }
 *
 * @param {number} completedBlocks - How many blocks have been completed (1-indexed)
 * @param {number} totalBlocks     - Total number of blocks in the experiment
 * @param {object} [options]       - Optional overrides
 * @param {number} [options.minBreakMs=5000] - Minimum ms before the button becomes clickable
 * @returns {object} A jsPsych trial configuration (html-button-response)
 */
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";

export function makeBreakTrial(completedBlocks, totalBlocks, options = {}) {
  const minBreakMs = options.minBreakMs ?? 5000;
  const pct = Math.round((completedBlocks / totalBlocks) * 100);

  return {
    type: HtmlButtonResponsePlugin,
    stimulus: `
      <div class="break-screen">
        <h2 class="break-screen-title">Break</h2>
        <p>You have completed <strong>${completedBlocks}</strong> of <strong>${totalBlocks}</strong> blocks.</p>

        <div class="break-progress-track">
          <div class="break-progress-fill" style="width: ${pct}%"></div>
        </div>

        <p class="break-screen-hint">
          Take a moment to rest your eyes — look away from the screen for a few
          seconds, take a breath, then continue when you're ready.
        </p>
      </div>
    `,
    choices: ["Continue"],
    // Enforce a minimum pause before the button becomes clickable.
    enable_button_after: minBreakMs,
  };
}
