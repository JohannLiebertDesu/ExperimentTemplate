// This is your control flow — it decides what happens in what order. 
// The import statements at the top are like calling in actors (plugins) from their dressing rooms (node_modules). 
// The makeTimeline() function is your scene list. 
// The start() function handles the "which theatre are we in?" logic (JATOS vs local).

import { initJsPsych } from "jspsych";
import "jspsych/css/jspsych.css";

import PreloadPlugin from "@jspsych/plugin-preload";
import FullscreenPlugin from "@jspsych/plugin-fullscreen";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";

// Since we load the following import after the jspsych/css/jspsych.css import, it always wins 
// -> that way for modifications of the css we never need to kack jsPsych's own CSS
import "./style.css";
import { stampParticipantData } from "../../functions/global/participantID";
import { Settings } from "../../ExperimentSettings.js";
import { checkEnrollmentCap } from "../../functions/global/enrollmentCap.js";
import { assignCondition } from "../../functions/global/conditionAssignment.js";
import { makeScreenCheck } from "../../functions/global/screenCheck.js";
import { createBlurMonitor } from "../../functions/global/blurMonitor.js";


/**
 * Loads JATOS' runtime-injected `jatos.js` (available only when running inside JATOS).
 *
 * JATOS injects `jatos.js` at runtime on its own server — it's never in your source code.
 * This loader attempts to fetch it: it succeeds in JATOS and fails gracefully (404) locally.
 * The boolean result lets you set an `inJatos` flag and branch behavior.
 *
 * @returns {Promise<boolean>} Resolves `true` if `jatos.js` loaded, otherwise `false`.
 */
function loadJatosScript() {
  return new Promise((resolve) => {
    // Creates a new script element in memory. At this point it's just floating, not attached to the page, not doing anything.
    // Document is only the factory, the script itself is not attached to document yet!
    const s = document.createElement("script");
    // Sets the script's source URL. Still hasn't fetched anything yet.
    s.src = "jatos.js"; // exists in JATOS, 404 locally
    // Tells the browser "when you do fetch this, don't block anything else while you're doing it." Like saying "go pick this up in the background."
    s.async = true;
    // Sets up two possible outcomes: if the jatos.js script can successfully be found, resolve the Promise with true. 
    // If it fails (404 locally), resolve with false. Crucially, both paths resolve — neither rejects.
    // The promise always completes successfully; it just carries a different answer.
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    // This is the trigger. The moment you append the script element to the page's <head>, the browser actually goes out and tries to fetch jatos.js from the network. 
    // Everything before this was just preparation.
    document.head.appendChild(s);
    // If the load succeeds (we're in JATOS), the fetched script executes. That execution is what creates the window.jatos object with all its methods (onLoad, addAbortButton, startNextComponent, etc.). 
    // The window.jatos object lets us talk with the already running JATOS server.
    // document.head is the <head> section of the HTML -> the part that holds metadata, CSS links and scripts that configure the page (not stuff we "see")
  });
}

function makeTimeline(jsPsych, blurMonitor) {
  const timeline = [];

  // timeline.push({
  //   type: PreloadPlugin,
  //   // files put into public/assets/... can be referenced here, like so:
  //   images: ["assets/instructions/Slide1.gif"],
  // });

  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: "<p><strong>Experiment</strong></p><p>The experiment is about to begin. You will first enter fullscreen mode, then your screen will be checked. Press any key to continue.</p>",
  });

  // NOTE: When the browser later exits fullscreen (e.g. page navigation to debrief),
  // it briefly flashes a cached snapshot of the page from when fullscreen was entered
  // (the button/message from this trial). This is a browser compositor-level behaviour
  // that cannot be prevented from JavaScript — it's cosmetic and lasts ~1 frame.
  timeline.push({
    type: FullscreenPlugin,
    fullscreen_mode: true,
  });

  // Right after fullscreen: verify the screen is large enough, then arm blur tracking.
  timeline.push(makeScreenCheck(jsPsych, Settings, blurMonitor));

  // ── Your experiment trials go here (between screen check and fullscreen exit) ──
  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: "<p><strong>Experiment Running</strong></p><p>This is a placeholder for your experiment trials. They run in fullscreen with blur monitoring active. Press any key to continue.</p>",
  });

  timeline.push({
    type: HtmlKeyboardResponsePlugin,
    stimulus: "<p><strong>Experiment Complete</strong></p><p>You have finished the experiment. Press any key to continue to the debrief.</p>",
  });

  return timeline;
}

/**
 * The entire start() function exists because of a single constraint: you don't know where your code will run until runtime (JATOS or local)
 */
async function start() {
  // The async keyword lets us use await inside the function, which lets us pause until we finish a process.
  // Loading the JATOS script takes time (the browser needs to fetch it from the network)
  await loadJatosScript();

  // If loadJatosScript() succeeeded, JATOS's script will have attached a window.jatos object.
  // This line checks: "Did that object appear?"
  // typeof is used because it wont throw an error on things that might not exist at all.
  const inJatos = typeof window.jatos !== "undefined";

  // Create the blur monitor before initJsPsych so we can pass its handler as a config option.
  // It stays dormant until activate() is called by the screen check on success,
  // so blurs during setup screens (fullscreen prompt, etc.) don't count.
  const blurMonitor = createBlurMonitor(Settings);

  const jsPsych = initJsPsych({
    // Fires every time the participant switches away from or back to the tab.
    // The blur monitor uses this to count tab-leaves and warn/end accordingly.
    on_interaction_data_update: (data) => blurMonitor.handler(data),
    // jsPsych is told here what it should do with the data once the last trial in the timeline completes.
    on_finish: async () => {
      // Check whether the experiment ended early due to a screen or attention failure.
      // addProperties() stamps every trial row, so any row carries the flag.
      const trials = jsPsych.data.get().values();
      const status = trials.length > 0 ? trials[0].experiment_status : undefined;
      const failed =
        status === "failed_resize" || status === "failed_attention_check";

      if (inJatos) {
        // Open the file cabinet (data), grab the files (get()), and photocopy them to a document any browser can handle (.json()).
        const resultJson = jsPsych.data.get().json();

        if (failed) {
          // Screen-size failures free the enrollment slot — the participant
          // never could have run, so we release the "started" count.
          if (status === "failed_resize") {
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const n = window.jatos.batchSession.get("started") ?? 0;
                if (n > 0)
                  await window.jatos.batchSession.add("/started", n - 1);
                break;
              } catch (_) {
                // Version conflict — retry once.
              }
            }
          }
          // End study directly — skip debrief. Data still reaches JATOS
          // with the experiment_status flag for filtering during analysis.
          window.jatos.endStudy(resultJson);
        } else {
          // Normal completion — proceed to debrief.
          window.jatos.startNextComponent(resultJson);
        }
      } else {
        // This is jsPsych's useful shortcut if we want to download data in json format.
        jsPsych.data.get().localSave("json", "data.json");

        // Locally, JATOS isn't available to navigate for us, so we redirect manually.
        // But only if the experiment completed normally — on failure, stay on the end message.
        if (!failed) {
          window.location.href = "/debrief.html";
        }
      }
    },
  });

  // Now that jsPsych exists, hand it to the blur monitor so it can call
  // pauseExperiment(), resumeExperiment(), and abortExperiment() when needed.
  blurMonitor.init(jsPsych);

  // Trial list is assembled. Nothing runs yet.
  const timeline = makeTimeline(jsPsych, blurMonitor);

  if (inJatos) {
    window.jatos.onLoad(async () => {
      const proceed = await checkEnrollmentCap(Settings);
      if (!proceed) return; // closed message already shown by checkEnrollmentCap
      stampParticipantData(jsPsych, true);
      const condition = await assignCondition(Settings);
      if (condition !== null) jsPsych.data.addProperties({ condition });
      jsPsych.run(timeline);
    });
  } else {
    stampParticipantData(jsPsych, false);
    const condition = await assignCondition(Settings);
    if (condition !== null) jsPsych.data.addProperties({ condition });
    jsPsych.run(timeline);
  }
}

// Call the function. Else, we define a plan but never execute it.
start();