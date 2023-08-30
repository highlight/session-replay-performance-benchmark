const puppeteer = require("puppeteer");
const crypto = require("crypto");
const fs = require("fs");
var util = require("util");
const { setInterval } = require("timers");

function addToCSV(filename, values) {
  // Convert the values array to a CSV string
  const csvRow = values.join(',') + '\n';
  // Check if the file exists
  const fileExists = fs.existsSync(filename);
  if (!fileExists) {
    // If the file doesn't exist, create it and add a header if needed
    console.log('Creating new file')
    fs.writeFileSync(filename, 'ts,tts,heapSizeUsed\n', 'utf8');
  }
  // Append the CSV row to the file
  fs.appendFileSync(filename, csvRow, 'utf8');
}
const trialId = "results/" + crypto.randomUUID().slice(0, 4);
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

async function traceRecord(traceFilePath, heapCSVpath,url) {
  const browser = await puppeteer.launch({ headless: "new", devtools: true});
  const page = await browser.newPage();
  await page.goto(url);
  const folderName = traceFilePath.split("/")[0];
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
  await page.tracing.start({ path: traceFilePath, screenshots: true });
  for (let i = 0; i < 20; i++) {
    await delay(100);
    console.log(i)
    await page.click("#add-elements");
  }

  await page.tracing.stop();

  const f = await page.$("#item-count");
  //obtain text
  const text = await (await f.getProperty("textContent")).jsonValue();
  console.log("Item Count: " + text);
  await browser.close();
  // read in the file from traceFilePath and parse as json
  const traceFile = fs.readFileSync(traceFilePath);
  const trace = JSON.parse(traceFile);
  // read in time at traceEvents.args.data.type
  const clickEvents = trace.traceEvents.filter(
    (event) => event?.args?.data?.type === "click"
  );

  const heapUsed = trace.traceEvents.filter(
    (event) => event?.args?.data?.jsHeapSizeUsed
  );

  heapUsed.forEach((event) => {
    addToCSV(heapCSVpath, [event.ts, event.tts, event.args.data.jsHeapSizeUsed])
  });

  // if (clickEvents.length === 0) {
  //   throw ("no click events found in trace file:", traceFilePath);
  // } else if (clickEvents.length > 1) {
  //   throw ("multiple click events found in trace file:", traceFilePath);
  // }

  let times = [];
  clickEvents.forEach((event) => {
    if (event.name === "EventDispatch") {
      times.push(event.dur);
    }
  });

  // console.log(times);
  return times;
}

const buildUrlParams = (recording, listSize, testNum, increment) =>
  `${trialId}/t${testNum}&replay=${recording}&listSize=${listSize}&increment=${increment}`;

(async () => {
  const increment = 100;
  console.log("starting simulation with id:", trialId);
  for (let i = 0; i < 1; i++) {
    const runTests = async (recording) => {
      const times = [];
      for (let x = 0; x < 1; x++) {
        const onParams = buildUrlParams(`${recording}`, i, x, increment);
        console.log(
          "running with params: ",
          `recording=${recording}`,
          `listSize=${i}`,
          `t${x}`,
          onParams
        );
        const onDur = await traceRecord(
          `${onParams}.json`,
          `${onParams}HEAP.csv`,
          `http://localhost:3000?${onParams}`,
        );
        console.log(`http://localhost:3000?${onParams}`);
        times.push(onDur);
      }
      console.log("times:", times);
      // console.log("avg:", times.reduce((a, b) => a + b, 0) / times.length);
    };
    // run 100 trials for each recording setting (on/off)
    await runTests("on");
    await runTests("off");
  }
})();
