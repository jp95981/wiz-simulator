const {
  getColdestMarkets,
  getIntervalRecordsForMetric,
} = require("../controllers/botController");
const WebsocketClient = require("./WebsocketClient");
const jwt = require("jsonwebtoken");

const MINPRICE = 1;
const MAXPRICE = 99;
const PRICEMEAN = 50;
const PRICESD = 15;
const MAXQUANTITY = 10;
const OFFERTIMING = 3000;
const ONESECOND = 1000;

async function botWorker() {
  const botObj = JSON.parse(process.env["BOT_OBJ"]);
  const delta = botObj.id * ONESECOND;
  let token = jwt.sign({ sub: botObj.userid }, process.env.JWT_TOKEN);
  console.log(
    `Hi, I am ${process.pid} running ${botObj.username}'s job!, I'm the ${botObj.id}th bot`
  );

  const ws = new WebsocketClient();
  ws.token = token;
  ws.initSocket();
  console.log(`Connected to socket @ ${ws.url}`);

  let coldestMarkets = await getColdestMarkets();
  let coldestMarketsIntervalsIDs = {};
  let coldestMarketsIntervalsInfo = {};

  if (!Array.isArray(coldestMarkets)) return;
  for await (const coldMarket of coldestMarkets) {
    let intervals = await getIntervalRecordsForMetric(coldMarket.metricID);
    coldestMarketsIntervalsIDs[coldMarket.metricID] = intervals.map(
      (elem) => elem.id
    );
    coldestMarketsIntervalsInfo[coldMarket.metricID] = intervals;
  }

  let i = 0;
  setInterval(async () => {
    coldestMarkets = await getColdestMarkets();
    if (!Array.isArray(coldestMarkets)) return;
    for (const coldMarket of coldestMarkets) {
      let intervals = await getIntervalRecordsForMetric(coldMarket.metricID);
      coldestMarketsIntervalsIDs[coldMarket.metricID] = intervals.map(
        (elem) => elem.id
      );
      coldestMarketsIntervalsInfo[coldMarket.metricID] = intervals;
    }
  }, OFFERTIMING + delta);

  setInterval(async () => {
    if (
      Object.keys(coldestMarketsIntervalsIDs).length === 0 ||
      Object.keys(coldestMarketsIntervalsInfo).length === 0
    ) {
      return;
    }
    if (!Array.isArray(coldestMarkets)) return;

    i += OFFERTIMING + delta;
    console.log(`T=${i / ONESECOND}s:`);
    let chosenColdestMarket =
      coldestMarkets[Math.floor(Math.random() * coldestMarkets.length)];

    let randomIntervalIndex = Math.floor(
      Math.random() *
        coldestMarketsIntervalsIDs[chosenColdestMarket.metricID].length
    );

    let chosenIntervalID =
      coldestMarketsIntervalsIDs[chosenColdestMarket.metricID][
        randomIntervalIndex
      ];
    let chosenIntervalInfo =
      coldestMarketsIntervalsInfo[chosenColdestMarket.metricID][
        randomIntervalIndex
      ];

    let price = generateRandomPrice(
      MINPRICE,
      MAXPRICE,
      PRICEMEAN,
      PRICESD,
      randomIntervalIndex
    );

    let quantity = generateRandomQuantity(MAXQUANTITY);
    let buy = Math.random() < 0.5;
    console.log(`Making an order for: ${chosenColdestMarket.ticker} - ${
      chosenColdestMarket.metric
    } Q${chosenColdestMarket.quarter} ${chosenColdestMarket.year}
        (from ${chosenIntervalInfo.from} to ${chosenIntervalInfo.to}) ${
      buy ? "buy" : "sell"
    } at ${price} (Quantity: ${quantity})`);
    makeOrder(ws, botObj.userid, chosenIntervalID, price, quantity, buy);
  }, OFFERTIMING + delta);

  // ~~~~~~~~~~Leave this for testing purposes~~~~~~~~~~
  // console.log(botObj.userid);
  // let testIID = "47e2f6bc-6dc0-11ed-a5d4-024e257348af";
  // let testprice = generateRandomPrice(minPrice, maxPrice, mean, sd, 0);
  // let testquantity = generateRandomQuantity(maxQuantity);
  // let testbuy = true;
  //
  // makeOrder(ws, botObj.userid, testIID, testprice, testquantity, testbuy);
  // ~~~~~~~~~~Leave this for testing purposes~~~~~~~~~~
}

function makeOrder(ws, userID, intervalID, price, quantity, buy) {
  const data = {
    uid: userID,
    iid: intervalID,
    price: parseInt(price, 10),
    orderQuantity: parseInt(quantity, 10),
    forContext: buy ? 1 : 0,
  };
  ws.send("newOrder", data, (err) => {
    if (err !== "Success") {
      console.log("Error: ", err);
    }
  });
}

function generateRandomQuantity(maxQuantity) {
  return Math.ceil(Math.random() * maxQuantity);
}

function generateRandomPrice(minPrice, maxPrice, mean, sd, intervalNo) {
  let u = 1 - Math.random();
  let v = Math.random();
  let normalValue = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  let randomPrice = Math.ceil(
    Math.min(Math.max(normalValue * sd + mean, minPrice), maxPrice)
  );
  let intervalAdjustedPrice =
    intervalNo !== 4 ? randomPrice / (intervalNo - 4) ** 2 : randomPrice;
  return intervalAdjustedPrice;
}

botWorker().then(() => {});
