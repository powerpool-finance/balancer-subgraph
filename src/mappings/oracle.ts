import { PriceUpdated } from '../types/PowerOracle/PowerOracle'
import {doPoolPriceCheckpoint, updatePoolLiquidity} from "./helpers";
import {getConfig} from "./config";
import {Pool} from "../types/schema";
import {log} from "@graphprotocol/graph-ts";

export function handleUnindexedUpdate(event: PriceUpdated): void {
  let config = getConfig();
  if (config == null) {
    return;
  }

  if (config.piptPoolId == null) {
    return;
  }

  let poolId = config.piptPoolId.toHexString()
  let pool = Pool.load(poolId);
  if (pool == null) {
    log.error("Missing pool {}", [poolId]);
    return;
  }

  updatePoolLiquidity(poolId, event.block.number);
  doPoolPriceCheckpoint(event.block, pool as Pool);
}
