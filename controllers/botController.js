require("dotenv").config();

const asyncHandler = require("express-async-handler");
const jwtDecode = require("jwt-decode");
const { pool } = require("../database");
const { parseData } = require("../utils/queryHandler");
const axios = require("axios");

const BadRequest = 500;
const Accepted = 200;
const userManagementEndpoint = "https://wisdom-auth.eu.auth0.com/api/v2/users";
const managementTokenEndpoint = "https://wisdom-auth.eu.auth0.com/oauth/token";

const getManagementToken = async () => {
  const getManagementTokenOptions = {
    method: "POST",
    url: managementTokenEndpoint,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "10gGl7Cmc0FZaZ9txucDf2v8hHVGKAxf",
      client_secret:
        "ut1j_mqXgsHu_aOWscNMj8q0rVbrujApi1fvurxDFJaE037pHQsY6ClJGY-mL8g7",
      audience: "https://wisdom-auth.eu.auth0.com/api/v2/",
    }),
  };

  let res = null;
  await axios
    .request(getManagementTokenOptions)
    .then((response) => {
      res = response.data;
    })
    .catch((error) => {
      console.log(error);
      return null;
    });

  return "access_token" in res ? res.access_token : null;
};

const addBotToAuth0 = asyncHandler(async (req, res, _) => {
  const { authorization } = req.headers;
  const { sub } = jwtDecode(authorization.substring(7));
  if (!(await isAdmin(sub))) {
    res.status(401).json({ msg: "You are not a site admin!" });
  }

  const { email, password } = req.body;
  let token = await getManagementToken();
  const connection = "Username-Password-Authentication";

  if (token == null) {
    res.status(500).json({ msg: "Could not get management token!" });
  }

  const userManagementAPIOptions = {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
  };
  let body = {
    ...req.body,
    connection: connection,
  };

  // console.log(body);

  let result = null;
  await axios
    .post(userManagementEndpoint, body, userManagementAPIOptions)
    .then((response) => {
      result = response.data;
    })
    .catch((error) => {
      result = error.message;
    });

  res.status(Accepted).json(result);
});

const addBotToPostgres = asyncHandler(async (req, res) => {
  const { authorization } = req.headers;
  const { sub } = jwtDecode(authorization.substring(7));
  if (!(await isAdmin(sub))) {
    res.status(401).json({ msg: "You are not a site admin!" });
  }

  let result = {};

  const { cols, values } = parseData(req.body);

  const { id } = req.body;
  let query = `
      INSERT INTO "public"."accounts" (${cols})
      VALUES (${values});

      INSERT INTO "public"."userGameStats" (userid, points)
      VALUES (\'${id}\', 10000)
      ON CONFLICT (userid)
          DO NOTHING`;

  await pool.query(query).then((res) => {
    result = res;
  });

  res.status(Accepted).json(result);
});

const isAdmin = async (sub) => {
  let query = `SELECT *
               FROM "public"."accounts"
               WHERE id = \'${sub}\'`;

  let result = null;
  await pool.query(query).then((res) => {
    result = res.rows[0];
  });
  return result.isadmin;
};

const getAllBots = async (_req, res) => {
  let query = `SELECT *
               FROM public.accounts
                        JOIN "userGameStats" u on accounts.id = u.userid
               WHERE isbot = true`;
  let result = {};
  await pool.query(query).then((res) => {
    result = res;
  });

  return res.status(Accepted).json(result);
};

const getAllBotsFunc = asyncHandler(async () => {
  let query = `SELECT *
               FROM public.accounts
                        JOIN "userGameStats" u on accounts.id = u.userid
               WHERE isbot = true`;
  let result = { rows: null };
  await pool.query(query).then((res) => {
    result = res;
  });
  // console.log(result.rows);
  return result.rows;
});

const deleteBot = asyncHandler(async (req, res) => {
  const { authorization } = req.headers;
  const { sub } = jwtDecode(authorization.substring(7));
  if (!(await isAdmin(sub))) {
    res.status(401).json({ msg: "You are not a site admin!" });
  }
  const { userid } = req.body;
  let query = `DELETE
               FROM public.accounts
               where id = \'${userid}\'
                 and isbot = true`;

  let result = {};
  await pool.query(query).then((res) => {
    result = res;
  });

  res.status(Accepted).json(result);
});

const getIntervalRecordsForMetric = async (metricID) => {
  let query = `
      SELECT *
      FROM public.intervals
      WHERE public.intervals."metricID" = uuid('${metricID}')
      ORDER BY "intervalNum"`;
  var result = null;
  await pool.query(query).then((res) => (result = res.rows));
  return result;
};

const getColdestMarkets = async () => {
  let query = `with "weeklyBetGrowth" as (select c.ticker,
                                                 name,
                                                 industry,
                                                 "logoURL",
                                                 metric,
                                                 year,
                                                 quarter,
                                                 "numBets",
                                                 weekly,
                                                 "metricID",
                                                 "numBets" - coalesce(lead("numBets")
                                                                      over (partition by c.ticker, name, industry, "logoURL", metric, year, quarter order by weekly desc),
                                                                      0) as growth
                                          from (select "numBets",
                                                       weekly,
                                                       "metricBetCount".ticker,
                                                       year,
                                                       quarter,
                                                       metric,
                                                       "metricID"
                                                from (select sum("count") as "numBets",
                                                             weekly,
                                                             "metricID",
                                                             "ticker",
                                                             "year",
                                                             "quarter"
                                                      from (select "intervalID",
                                                                   date_trunc('week', bets."updatedAt"::date) as weekly,
                                                                   count(*)
                                                            from bets
                                                            group by weekly, id
                                                            order by weekly)
                                                               as "intervalBetCount"
                                                               join intervals i on "intervalBetCount"."intervalID" = i."id"
                                                      group by "metricID", weekly, ticker, year, quarter)
                                                         as "metricBetCount"
                                                         join "companyMetrics" cm on "metricBetCount"."metricID" = cm.id)
                                                   as "metricBetCountNamed"
                                                   join companies c on "metricBetCountNamed".ticker = c.ticker
                                          where weekly >= date_trunc('week', '2022-12-01'::date) - interval '7 days'
                                          group by c.ticker, name, industry, metric, year, quarter, weekly, "numBets",
                                                   "metricID"
                                          order by "numBets")
               select ticker,
                      name,
                      industry,
                      "logoURL",
                      metric,
                      year,
                      quarter,
                      "numBets",
                      growth,
                      "metricID"
               from "weeklyBetGrowth"
               where weekly >= date_trunc('week', current_date)
               limit 7;`;

  return await pool.query(query).then((res) => res.rows);
};

module.exports = {
  addBotToAuth0,
  addBotToPostgres,
  getAllBots,
  deleteBot,
  getAllBotsFunc,
  getIntervalRecordsForMetric,
  getColdestMarkets,
};
