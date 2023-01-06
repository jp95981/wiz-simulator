const { parentPort } = require("worker_threads");
const { getAllBotsFunc } = require("../controllers/botController.js");
var cluster = require("cluster");

async function botsMainThread() {
  let allBots = await getAllBotsFunc().catch((x) => console.log(x));
  if (!allBots) return;
  const numWorkers = Math.min(allBots.length, 5);
  console.log(`[BOT MASTER] Spinning up ${numWorkers} threads`);

  for (let i = 0; i < numWorkers; i++) {
    let worker_env = {};
    let data = allBots[i];
    data["id"] = i;
    worker_env["BOT_OBJ"] = JSON.stringify(data);
    cluster.setupPrimary({ exec: "./bots/botWorker.js" });
    cluster.fork(worker_env);
  }

  cluster.on("online", (worker) => {
    console.log("[BOT MASTER] Worker" + worker.process.pid + " is online");
  });
  cluster.on("exit", function (worker, code, _signal) {
    console.log(
      "[BOT MASTER] Worker " + worker.process.pid + " died with code: " + code
    );
  });
}

botsMainThread().then(() => parentPort.postMessage("Done!!"));
