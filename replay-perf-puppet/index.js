const puppeteer = require("puppeteer");
const crypto = require("crypto");
const fs = require("fs");
var util = require("util");

const trialId = 'results/' + crypto.randomUUID().slice(0, 4);
log_file = fs.createWriteStream(trialId + "/trial.log", {
  flags: "w",
});
log_stdout = process.stdout;
console.log = function () {
  log_file.write(util.format.apply(null, arguments) + "\n");
  log_stdout.write(util.format.apply(null, arguments) + "\n");
};
console.error = console.log;
const folderName = trialId;
if (!fs.existsSync(folderName)) {
  fs.mkdirSync(folderName);
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

async function traceRecord(traceFilePath, url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(url);
  await delay(1000);
  const folderName = traceFilePath.split("/")[0];
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
  await page.tracing.start({ path: traceFilePath, screenshots: true });
  await page.click("#list-button");
  await page.tracing.stop();
  await delay(1000);
  await browser.close();
  // read in the file from traceFilePath and parse as json
  const traceFile = fs.readFileSync(traceFilePath);
  const trace = JSON.parse(traceFile);
  // read in time at traceEvents.args.data.type
  const clickEvents = trace.traceEvents.filter(
    (event) => event?.args?.data?.type === "click"
  );
  if (clickEvents.length === 0) {
    throw ("no click events found in trace file:", traceFilePath);
  } else if (clickEvents.length > 1) {
    throw ("multiple click events found in trace file:", traceFilePath);
  }
  return clickEvents[0].dur;
}

const buildUrlParams = (recording, listSize, testNum) =>
  `${trialId}/t${testNum}-recording=${recording}&listSize=${listSize}`;

(async () => {
  console.log("starting simulation with id:", trialId);
  for (let i = 1; i < 10 * 10 ** 6; i *= 10) {
    const runTests = async (recording) => {
      const times = [];
      for (let x = 0; x < 10; x++) {
        console.log("running with params: ", `recording=${recording}`, `listSize=${i}`, `t${x}`);
        const onParams = buildUrlParams(`${recording}`, i, x);
        const onDur = await traceRecord(
          `${onParams}.json`,
          `http://localhost:3000?${onParams}`
        );
        times.push(onDur);
      }
      console.log("times:", times);
      console.log("avg:", times.reduce((a, b) => a + b, 0) / times.length);
    };
    // run 100 trials for each recording setting (on/off)
    await runTests("on");
    await runTests("off");
  }
})();
