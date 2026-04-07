// This is your control flow — it decides what happens in what order.
// The import statements at the top are like calling in actors (plugins) from their dressing rooms (node_modules).
// The makeTimeline() function is your scene list.
// The start() function handles the "which theatre are we in?" logic (JATOS vs local).

import { initJsPsych } from "jspsych";
import "jspsych/css/jspsych.css";

import SurveyPlugin from "@jspsych/plugin-survey";
import "@jspsych/plugin-survey/css/survey.css";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";

import { Settings } from "../../ExperimentSettings.js";
import { stampParticipantData } from "../../functions/global/participantID";
import { questionnaireSurveyJSON } from "./questionnairePage.js";
import { debriefPageHTML } from "./debriefPage.js";

// Since we load the following import after the jspsych/css/jspsych.css import, it always wins
// -> that way for modifications of the css we never need to hack jsPsych's own CSS
import "../../styles/common.css";


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

function makeTimeline() {
  const timeline = [];

  // Page 1: Post-experiment questionnaire
  // Questions are defined in questionnairePage.js — edit that file to customise.
  timeline.push({
    type: SurveyPlugin,
    survey_json: questionnaireSurveyJSON(),
  });

  // Page 2: Debrief text — explains the study and provides contact info.
  // Content is defined in debriefPage.js; contact info pulled from Settings.
  timeline.push({
    type: HtmlButtonResponsePlugin,
    stimulus: debriefPageHTML(Settings),
    choices: ["Finish"],
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

  // Engine is built with its rules (abort button, on_finish). Nothing runs yet.
  const jsPsych = initJsPsych({
    // jsPsych is told here what it should do with the data once the last trial in the timeline completes.
    on_finish: async () => {
      if (inJatos) {
        // Open the file cabinet (data), grab the files (get()), and photocopy them to a document any browser can handle (.json()).
        const resultJson = jsPsych.data.get().json();

        // Increment the batch-level completion counter so we always know how many
        // participants made it all the way through. add() means "create/overwrite",
        // so the counter self-initializes to 1 on the very first completion — no
        // pre-seeding needed. Wrapped in try/catch because batchSessionVersioning
        // (on by default) rejects concurrent writes; a missed count is preferable
        // to leaving the participant stuck before endStudy.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const n = window.jatos.batchSession.get("completions") ?? 0;
            await window.jatos.batchSession.add("/completions", n + 1);
            break; // success — stop retrying
          } catch (_) {
            // Concurrent write conflict; retry once, then give up silently.
          }
        }

        // If we're in JATOS, send the json string to JATOS and tell it to end the experiment.
        window.jatos.endStudy(resultJson);
      } else {
        // This is jsPsych's useful shortcut if we want to download data in json format.
        jsPsych.data.get().localSave("json", "data.json");

        document.body.innerHTML = "<p>Study complete. You may close this tab.</p>";
      }
    },
  });

  // Trial list is assembled. Nothing runs yet.
  const timeline = makeTimeline();

  if (inJatos) {
    window.jatos.onLoad(() => {
      stampParticipantData(jsPsych, true);
      jsPsych.run(timeline);
    });
  } else {
    stampParticipantData(jsPsych, false);
    jsPsych.run(timeline);
  }
}

// Call the function. Else, we define a plan but never execute it.
start();
