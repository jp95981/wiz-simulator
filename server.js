require("dotenv").config();

const { createServer } = require("http");

const PORT = process.env.PORT || 3069;
const server = createServer();
const { Worker } = require("worker_threads");
const botWorkerFilePath = "./bots/botMainThread.js";

function botRunner() {
  console.log("Here comes the calvary...");
  let worker = new Worker(botWorkerFilePath, {
    workerData: {
      path: "./bots/botMainThread.js",
    },
  });
  worker.on("exit", () => {
    console.log(`Main Bot worker finished!`);
  });
  worker.on("error", (err) => {
    console.log(`Main Bot worker errored with message: ${err}`);
    console.log(err);
  });
}

server.listen(PORT);
setTimeout(botRunner, 1000);
console.log("Simulator listening at: ", PORT);
