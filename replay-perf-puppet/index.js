const puppeteer = require("puppeteer");
const crypto = require("crypto");
const fs = require("fs");
var util = require("util");
const { setInterval } = require("timers");

// Function to process metrics and extract timestamp and activeTime
function processMetrics(metrics) {
  const activeTime = metrics.metrics
    .filter((m) => m.name.includes("Duration"))
    .map((m) => m.value)
    .reduce((a, b) => a + b);

  return {
    timestamp: metrics.metrics.find((m) => m.name === "Timestamp")?.value || 0,
    activeTime,
  };
}

// Function to log CPU usage metrics at specified intervals
async function logMetrics(cdp, interval, CPUCSVpath) {
  // Enable performance monitoring
  await cdp.send("Performance.enable", {
    timeDomain: "timeTicks",
  });

  // Get initial metrics
  const { timestamp: startTime, activeTime: initialActiveTime } =
    processMetrics(await cdp.send("Performance.getMetrics"));

  const snapshots = [];
  const csvRows = [];
  let cumulativeActiveTime = initialActiveTime;
  let lastTimestamp = startTime;

  const timer = setInterval(async () => {
    const { timestamp, activeTime } = processMetrics(
      await cdp.send("Performance.getMetrics")
    );

    const frameDuration = timestamp - lastTimestamp;
    let usage = (activeTime - cumulativeActiveTime) / frameDuration;
    cumulativeActiveTime = activeTime;

    if (usage > 1) usage = 1;

    snapshots.push({
      timestamp,
      usage,
    });

    lastTimestamp = timestamp;
    csvRows.push([
      timestamp * 1000000,
      cumulativeActiveTime,
      lastTimestamp - startTime,
      frameDuration,
      usage,
    ]);
  }, interval);

  // Return a function to stop logging and get results
  return async () => {
    clearInterval(timer);
    await cdp.send("Performance.disable");

    csvRows.forEach((row) => {
      addToCSV(
        CPUCSVpath,
        row,
        "ts,cumulativeActiveTime, totalTime, frameDuration, usage\n"
      );
    });

    return {
      average: cumulativeActiveTime / (lastTimestamp - startTime),
      snapshots,
    };
  };
}

function addToCSV(filename, values, headers) {
  // Convert the values array to a CSV string
  const csvRow = values.join(",") + "\n";
  // Check if the file exists
  const fileExists = fs.existsSync(filename);
  if (!fileExists) {
    // If the file doesn't exist, create it and add a header if needed
    console.log("Creating new file");
    fs.writeFileSync(filename, headers, "utf8");
  }
  // Append the CSV row to the file
  fs.appendFileSync(filename, csvRow, "utf8");
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

async function traceRecord(traceFilePath, heapCSVpath, CPUCSVpath, url) {
  const browser = await puppeteer.launch({ headless: true, devtools: true });
  const page = await browser.newPage();
  const pageSession = await page.target().createCDPSession();
  await page.goto(url);
  const folderName = traceFilePath.split("/")[0];
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
  await page.tracing.start({ path: traceFilePath, screenshots: true });
  const stopLogging = await logMetrics(pageSession, 32, CPUCSVpath);
  for (let i = 0; i < 1000; i++) {
    await delay(200);
    console.log(i);
    await page.click("#add-elements");
  }

  const results = await stopLogging();
  console.log("Average CPU Usage:", results.average);
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
    addToCSV(
      heapCSVpath,
      [event.ts, event.tts, event.args.data.jsHeapSizeUsed],
      "ts,tts,heapSizeUsed\n"
    );
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

  return times;
}

const buildUrlParams = (recording, listSize, testNum, increment) =>
  `${trialId}/t${testNum}&replay=${recording}&listSize=${listSize}&increment=${increment}`;

(async () => {
  const increment = 1000;
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
          `ex2${onParams}.json`,
          `${onParams}HEAP.csv`,
          `${onParams}CPU.csv`,
          `http://localhost:3000?${onParams}`
        );
        console.log(`http://localhost:3000?${onParams}`);
        times.push(onDur);
      }
      console.log("times:", times);
    };
    // run 100 trials for each recording setting (on/off)
    await runTests("on");
    await runTests("off");
  }
})();
