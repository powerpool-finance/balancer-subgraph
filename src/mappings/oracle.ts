import {AnchorPriceUpdated} from '../types/PowerOracle/PowerOracle'
import {doPoolPriceCheckpoint, updatePoolLiquidity} from "./helpers";
import {Pool} from "../types/schema";
import {ethereum} from "@graphprotocol/graph-ts";

function updatePool(poolId: string, event: ethereum.Event): void {
  let pool = Pool.load(poolId);
  if (pool == null) {
    return;
  }
  pool = pool as Pool;

  doPoolPriceCheckpoint(event.block, pool as Pool);
}

export function handleUnindexedUpdate(event: AnchorPriceUpdated): void {
  // PIPT -
  updatePool("0x26607ac599266b21d13c7acf7942c7701a8b699c", event);
  // YETI - 0xb4bebd34f6daafd808f73de0d10235a92fbb6c3d
  updatePool("0xb4bebd34f6daafd808f73de0d10235a92fbb6c3d", event);
  // ASSY - 0xfa2562da1bba7b954f26c74725df51fb62646313
  updatePool("0xfa2562da1bba7b954f26c74725df51fb62646313", event);
}
