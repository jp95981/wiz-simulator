const { pool } = require("../database");

const BadRequest = 500;
const Accepted = 200;

const handleQuery = (err, results, res) => {
  if (err) {
    console.error(err);
    return res.status(BadRequest).send(err);
  }
  return res.status(Accepted).json(results.rows);
};

const handleAsyncQuery = async (query, res) => {
  pool
    .query(query)
    .then((result) => res.status(Ok).json(result.rows))
    .catch((x) => {
      console.error(x);
      res.status(BadRequest);
    });
};

const parseUUIDs = (ids) => {
  return ids
    .filter((x) => x.length > 0)
    .map((id) => {
      return `uuid('${id}')`;
    })
    .join(", ");
};

const parseData = (inputObj) => {
  let update = Object.entries(inputObj)
    .map(([columnName, value]) => {
      return `\"${columnName}\"=$$${value}$$`;
    })
    .join(", ");

  let cols = Object.entries(inputObj)
    .map(([columnName, _]) => {
      return `\"${columnName}\"`;
    })
    .join(", ");

  let values = Object.entries(inputObj)
    .map(([_, values]) => {
      if (!Number.isFinite(values)) return `$$${values}$$`;
      else return values;
    })
    .join(", ");
  return { update, cols, values };
};

module.exports = { handleQuery, parseData, parseUUIDs, handleAsyncQuery };
