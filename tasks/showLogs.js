const fetch = require('node-fetch');

async function main() {
  const query = `query subgraphLogs($subgraphId: ID!, $first: Int!, $filters: [String], $searchText: String, $order: SubgraphLogsOrder) {
  subgraphLogs(subgraphId: $subgraphId, first: $first, filters: $filters, searchText: $searchText, order: $order) {
    id
    subgraphId
    text
    timestamp
    level
    meta {
      module
      line
      column
      __typename
    }
    __typename
  }
}
`;
  const body = {
    "operationName": "subgraphLogs",
    "variables": {
      "subgraphId": "QmfHSbbntz7yxRvUPLG23VqYW8oAGsydEhQ2eR6CEK7sit",
      "first": 200,
      "filters": ["error", "warning", "info"],
      "searchText": "PoolPriceUpdateSync",
      "order": "NewestFirst"
    },
    "query": query
  }
  const res = await fetch("https://api.thegraph.com/explorer/graphql", {
    "headers": {
      "accept": "*/*",
      "content-type": "application/json",
    },
    "referrer": "https://thegraph.com/",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": JSON.stringify(body),
    "method": "POST",
    "mode": "cors"
  });
  const json = await res.json()
  for (let msg of json.data.subgraphLogs) {
    console.log('>>>', msg.text);
  }
}
main();

