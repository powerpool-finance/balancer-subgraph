import {
  BigDecimal,
  Address,
  BigInt,
  Bytes,
  dataSource,
  ethereum, log
} from '@graphprotocol/graph-ts'
import {
  Pool,
  User,
  PoolToken,
  PoolShare,
  TokenPrice,
  Transaction,
  Balancer,
  PoolPrice
} from '../types/schema'
import { BTokenBytes } from '../types/templates/Pool/BTokenBytes'
import { BToken } from '../types/templates/Pool/BToken'
import { CRPFactory } from '../types/Factory/CRPFactory'
import { ConfigurableRightsPool } from '../types/Factory/ConfigurableRightsPool'
import { PowerOracleV2 } from '../types/PowerOracleV2/PowerOracleV2'
import {ICurvePoolRegistry} from "../types/PowerOracleV2/ICurvePoolRegistry";
import {IYearnVaultV1} from "../types/templates/Pool/IYearnVaultV1";
import {IYearnVaultV2} from "../types/templates/Pool/IYearnVaultV2";

export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_ETHER = BigDecimal.fromString("1000000000000000000");
let ONE_HOUR = 3600;
let YLA_POOL = "0x9ba60ba98413a60db4c651d4afe5c937bbd8044b";

let network = dataSource.network()

export let WETH: string = (network == 'mainnet')
  ? '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  : '0xd0a1e359811322d97991e03f863a0c30c2cf029c'

export let USD: string = (network == 'mainnet')
  ? '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' // USDC
  : '0x1528f3fcc26d13f7079325fb78d9442607781c8c' // DAI

export let CRP_FACTORY: string = (network == 'mainnet')
  ? '0xb3a3f6826281525dd57f7BA837235E4Fa71C6248'
  : '0x17e8705E85aE8E3df7C5E4d3EEd94000FB30C483'

export function hexToDecimal(hexString: String, decimals: i32): BigDecimal {
  let bytes = Bytes.fromHexString(hexString).reverse() as Bytes
  let bi = BigInt.fromUnsignedBytes(bytes)
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return bi.divDecimal(scale)
}

export function bigIntToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return amount.toBigDecimal().div(scale)
}

export function tokenToDecimal(amount: BigDecimal, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return amount.div(scale)
}

export function createPoolShareEntity(id: string, pool: string, user: string): void {
  let poolShare = new PoolShare(id)

  createUserEntity(user)

  poolShare.userAddress = user
  poolShare.poolId = pool
  poolShare.balance = ZERO_BD
  poolShare.save()
}

export function createPoolTokenEntity(id: string, pool: string, address: string): void {
  let token = BToken.bind(Address.fromString(address))
  let tokenBytes = BTokenBytes.bind(Address.fromString(address))
  let symbol = ''
  let name = ''
  let decimals = 18

  // COMMENT THE LINES BELOW OUT FOR LOCAL DEV ON KOVAN

  let symbolCall = token.try_symbol()
  let nameCall = token.try_name()
  let decimalCall = token.try_decimals()

  if (symbolCall.reverted) {
    let symbolBytesCall = tokenBytes.try_symbol()
    if (!symbolBytesCall.reverted) {
      symbol = symbolBytesCall.value.toString()
    }
  } else {
    symbol = symbolCall.value
  }

  if (nameCall.reverted) {
    let nameBytesCall = tokenBytes.try_name()
    if (!nameBytesCall.reverted) {
      name = nameBytesCall.value.toString()
    }
  } else {
    name = nameCall.value
  }

  if (!decimalCall.reverted) {
    decimals = decimalCall.value
  }

  // COMMENT THE LINES ABOVE OUT FOR LOCAL DEV ON KOVAN

  // !!! COMMENT THE LINES BELOW OUT FOR NON-LOCAL DEPLOYMENT
  // This code allows Symbols to be added when testing on local Kovan
  /*
  if(address == '0xd0a1e359811322d97991e03f863a0c30c2cf029c')
    symbol = 'WETH';
  else if(address == '0x1528f3fcc26d13f7079325fb78d9442607781c8c')
    symbol = 'DAI'
  else if(address == '0xef13c0c8abcaf5767160018d268f9697ae4f5375')
    symbol = 'MKR'
  else if(address == '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5')
    symbol = 'USDC'
  else if(address == '0x1f1f156e0317167c11aa412e3d1435ea29dc3cce')
    symbol = 'BAT'
  else if(address == '0x86436bce20258a6dcfe48c9512d4d49a30c4d8c4')
    symbol = 'SNX'
  else if(address == '0x8c9e6c40d3402480ace624730524facc5482798c')
    symbol = 'REP'
  */
  // !!! COMMENT THE LINES ABOVE OUT FOR NON-LOCAL DEPLOYMENT

  let poolToken = new PoolToken(id)
  poolToken.poolId = pool
  poolToken.address = address
  poolToken.name = name
  poolToken.symbol = symbol
  poolToken.decimals = decimals
  poolToken.balance = ZERO_BD
  poolToken.denormWeight = ZERO_BD
  poolToken.save()
}

export function doPoolPriceCheckpoint(block: ethereum.Block, pool: Pool, event: ethereum.Event = null): void {
  if (pool.lastPoolPriceUpdate + ONE_HOUR > block.timestamp.toI32()) {
    log.info(
      "doPoolPriceCheckpoint()::Skipping pool {} checkpoint at {}, the last one is {}, the diff is {}",
      [
        pool.id,
        block.timestamp.toString(),
        BigInt.fromI32(pool.lastPoolPriceUpdate).toString(),
        (BigInt.fromI32(pool.lastPoolPriceUpdate).minus(block.timestamp)).toString()
      ]
    );
    //
    // let id = pool.id.concat("-").concat(BigInt.fromI32(pool.lastPoolPriceUpdate).toString());
    // let poolPrice = PoolPrice.load(id);
    // if (poolPrice == null) {
    //   return;
    // }
    //
    // if (pool.totalShares.gt(BigDecimal.fromString("0"))) {
    //   poolPrice.price = pool.liquidity.div(pool.totalShares);
    // }  else {
    //   poolPrice.price = BigDecimal.fromString("0");
    // }
    // poolPrice.totalSupply = pool.totalShares;
    // poolPrice.blockNumber = block.number.toI32();
    // poolPrice.timestamp = block.timestamp.toI32();
    // poolPrice.id = pool.id.concat("-").concat(block.timestamp.toString());
    // poolPrice.save();
    //
    // log.info(
    //   "doPoolPriceCheckpoint()::PoolPriceUpdateSkip pool_id: {} blockNumber: {} timestamp: {} totalSupply: {} liquidity: {} price: {} update: {}",
    //   [
    //     pool.id,
    //     block.number.toString(),
    //     block.timestamp.toString(),
    //     pool.totalShares.toString(),
    //     pool.liquidity.toString(),
    //     poolPrice.price.toString(),
    //     "true",
    //   ]
    // );
    //
    // pool.lastPoolPriceUpdate = block.timestamp.toI32();
    // pool.save();

    return;
  }
  updatePoolLiquidity(pool, block.number);

  let id = pool.id.concat("-").concat(block.timestamp.toString());
  let update = true;
  let poolPrice = PoolPrice.load(id);
  if (poolPrice == null) {
    poolPrice = new PoolPrice(id);
    update = false;
  }

  poolPrice.poolId = pool.id;
  if (pool.totalShares.gt(BigDecimal.fromString("0"))) {
    poolPrice.price = pool.liquidity.div(pool.totalShares);
  }  else {
    poolPrice.price = BigDecimal.fromString("0");
  }
  poolPrice.totalSupply = pool.totalShares;
  poolPrice.liquidity = pool.liquidity;
  poolPrice.blockNumber = block.number.toI32();
  poolPrice.timestamp = block.timestamp.toI32();
  poolPrice.save();
  log.info(
    "doPoolPriceCheckpoint()::PoolPriceUpdateSync pool_id: {} blockNumber: {} timestamp: {} totalSupply: {} liquidity: {} price: {} update: {}",
    [
      pool.id,
      block.number.toString(),
      block.timestamp.toString(),
      pool.totalShares.toString(),
      pool.liquidity.toString(),
      poolPrice.price.toString(),
      update ? "true" : "false",
    ]
  );

  pool.lastPoolPriceUpdate = block.timestamp.toI32();
  pool.poolPriceCount = pool.poolPriceCount.plus(BigInt.fromI32(1));
  pool.save();
}

export function updatePoolLiquidity(pool: Pool, blockNumber: BigInt): void {
  let tokensList: Array<Bytes> = pool.tokensList

  if (!tokensList || pool.tokensCount.lt(BigInt.fromI32(2)) || !pool.publicSwap) return;

  let poolLiquidity = ZERO_BD

  // Create or update token price

  // v1 - after PowerOracleV1 had been deployed
  // if (blockNumber.gt(BigInt.fromI32(11146897))) {
  // v2 - after PowerOracleV2 had been deployed
  if (blockNumber.gt(BigInt.fromI32(11829649))) {
    // V1:
    // let powerOracle = PowerOracleV1.bind(Address.fromString('0x019e14DA4538ae1BF0BCd8608ab8595c6c6181FB'));
    // V2:

    for (let i: i32 = 0; i < tokensList.length; i++) {
      let tokenPriceId = tokensList[i].toHexString()
      let tokenPrice = TokenPrice.load(tokenPriceId)
      if (tokenPrice == null) {
        tokenPrice = new TokenPrice(tokenPriceId)
        tokenPrice.poolTokenId = ''
      }

      let poolTokenId = pool.id.concat('-').concat(tokenPriceId)
      let poolToken = PoolToken.load(poolTokenId)
      let priceSource = "";

      // add pool and new price getters
      if (pool.id == YLA_POOL) {
        priceSource = "yearn-vault-v1";
        if (poolToken.address == '0x2994529c0652d127b7842094103715ec5299bbed'
          || poolToken.address == '0xcc7e70a958917cce67b4b87a8c30e6297451ae98'
          || poolToken.address == '0x629c759d1e83efbf63d84eb3868b564d9521c129'
          || poolToken.address == '0x5dbcf33d8c2e976c6b560249878e6f1491bca25c'
          || poolToken.address == '0x9ca85572e6a3ebf24dedd195623f188735a5179f'
        ) {
          tokenPrice.price = getVaultV1Price(Address.fromString(poolToken.address));
        } else {
          priceSource = "yearn-vault-v2";
          tokenPrice.price = getVaultV2Price(Address.fromString(poolToken.address));
        }
      } else {
        priceSource = "p-oracle";
        let symbol = poolToken.symbol;
        if (poolToken.symbol == 'piSushi') {
          symbol = 'SUSHI';
        }
        tokenPrice.price = getOraclePrice(symbol);
      }

      let tokenLiquidity = poolToken.balance.times(tokenPrice.price);
      if (tokenPrice.price.gt(ZERO_BD)) {
        poolLiquidity = poolLiquidity.plus(tokenLiquidity);
      }

      log.info(
        "updatePoolLiquidity()::tokenLiquidity: poolId: {}, poolToken: {}, poolTokenId: {}, tokenPrice: {}, tokenLiquidity: {}, priceSource: {}",
        [pool.id, poolToken.symbol, poolToken.address, tokenPrice.price.toString(), tokenLiquidity.toString(), priceSource]
      );

      tokenPrice.symbol = poolToken.symbol
      tokenPrice.name = poolToken.name
      tokenPrice.decimals = poolToken.decimals
      tokenPrice.poolTokenId = poolTokenId
      tokenPrice.save()
    }
  }

  let factory = Balancer.load('1')
  factory.totalLiquidity = factory.totalLiquidity.minus(pool.liquidity).plus(poolLiquidity)
  factory.save()
  log.info(
    "updatePoolLiquidity()::poolLiquidity: poolId: {}, factoryLiquidity: {}, oldLiquidity: {}, newLiquidity: {}",
    [pool.id, factory.totalLiquidity.toString(), pool.liquidity.toString(), poolLiquidity.toString()]
  );

  pool.liquidity = poolLiquidity
  pool.save()
}

let powerOracle = PowerOracleV2.bind(Address.fromString('0x50f8D7f4db16AA926497993F020364f739EDb988'));

function getOraclePrice(tokenSymbol: string): BigDecimal {
  let res = powerOracle.try_getPriceBySymbol(tokenSymbol);
  if (res.reverted) {
    log.warning("Missing oracle info for token {}", [tokenSymbol])
    return ZERO_BD
  } else {
    return res.value.toBigDecimal().div(BigDecimal.fromString("1000000"))
  }
}

let curveRegistry = ICurvePoolRegistry.bind(Address.fromString('0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5'));

function getVaultV1Price(vaultAddress: Address): BigDecimal {
  let yearnVault = IYearnVaultV1.bind(vaultAddress);
  let res = yearnVault.try_getPricePerFullShare();

  if (res.reverted) {
    log.warning("Error getting pricePerFullShare for vault {}", [vaultAddress.toHexString()])
    return ZERO_BD;
  }
  let pricePerShare = res.value.toBigDecimal().div(ONE_ETHER);

  let res2: ethereum.CallResult<Address> = yearnVault.try_token();
  if (res2.reverted) {
    log.warning("Error getting token info  for vault:{}", [vaultAddress.toHexString()])
    return ZERO_BD;
  }
  let crvToken = res2.value.toHexString();

  let res3 = curveRegistry.try_get_virtual_price_from_lp_token(Address.fromString(crvToken));
  if (res3.reverted) {
    log.warning("Failed getting virtual for token:{}", [crvToken])
    return ZERO_BD;
  }
  let virtualPrice = res3.value.toBigDecimal();

  log.debug(
    "getVaultPrice()::info: {}, pricePerShare {}, virtualPrice: {}",
    [vaultAddress.toHexString(), pricePerShare.toString(), virtualPrice.toString()]
  )

  return pricePerShare.times(virtualPrice).div(ONE_ETHER);
}

function getVaultV2Price(vaultAddress: Address): BigDecimal {
  let yearnVault = IYearnVaultV2.bind(vaultAddress);
  let res = yearnVault.try_pricePerShare();

  if (res.reverted) {
    log.warning("Error getting pricePerShare for vault {}", [vaultAddress.toHexString()])
    return ZERO_BD;
  }
  let pricePerShare = res.value.toBigDecimal().div(ONE_ETHER);

  let res2: ethereum.CallResult<Address> = yearnVault.try_token();
  if (res2.reverted) {
    log.warning("Error getting token info  for vault:{}", [vaultAddress.toHexString()])
    return ZERO_BD;
  }
  let crvToken = res2.value.toHexString();

  let res3 = curveRegistry.try_get_virtual_price_from_lp_token(Address.fromString(crvToken));
  if (res3.reverted) {
    log.warning("Failed getting virtual for token:{}", [crvToken])
    return ZERO_BD;
  }
  let virtualPrice = res3.value.toBigDecimal();

  log.debug(
    "getVaultPrice()::info: {}, pricePerShare {}, virtualPrice: {}",
    [vaultAddress.toHexString(), pricePerShare.toString(), virtualPrice.toString()]
  )

  return pricePerShare.times(virtualPrice).div(ONE_ETHER);
}

export function saveTransaction(event: ethereum.Event, eventName: string): void {
  let tx = event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString())
  let userAddress = event.transaction.from.toHex()
  let transaction = Transaction.load(tx)
  if (transaction == null) {
    transaction = new Transaction(tx)
  }
  transaction.event = eventName
  transaction.poolAddress = event.address.toHex()
  transaction.userAddress = userAddress
  transaction.gasUsed = event.transaction.gasUsed.toBigDecimal()
  transaction.gasPrice = event.transaction.gasPrice.toBigDecimal()
  transaction.tx = event.transaction.hash
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.block = event.block.number.toI32()
  transaction.save()

  createUserEntity(userAddress)
}

export function createUserEntity(address: string): void {
  if (User.load(address) == null) {
    let user = new User(address)
    user.save()
  }
}

export function isCrp(address: Address): boolean {
  let crpFactory = CRPFactory.bind(Address.fromString(CRP_FACTORY))
  let isCrp = crpFactory.try_isCrp(address)
  if (isCrp.reverted) return false
  return isCrp.value
}

export function getCrpController(crp: ConfigurableRightsPool): string | null {
  let controller = crp.try_getController()
  if (controller.reverted) return null;
  return controller.value.toHexString()
}

export function getCrpSymbol(crp: ConfigurableRightsPool): string {
  let symbol = crp.try_symbol()
  if (symbol.reverted) return ''
  return symbol.value
}

export function getCrpName(crp: ConfigurableRightsPool): string {
  let name = crp.try_name()
  if (name.reverted) return ''
  return name.value
}

export function getCrpCap(crp: ConfigurableRightsPool): BigInt {
  let cap = crp.try_getCap()
  if (cap.reverted) return BigInt.fromI32(0)
  return cap.value
}

export function getCrpRights(crp: ConfigurableRightsPool): string[] {
  let rights = crp.try_rights()
  if (rights.reverted) return []
  let rightsArr: string[] = []
  if (rights.value.value0) rightsArr.push('canPauseSwapping')
  if (rights.value.value1) rightsArr.push('canChangeSwapFee')
  if (rights.value.value2) rightsArr.push('canChangeWeights')
  if (rights.value.value3) rightsArr.push('canAddRemoveTokens')
  if (rights.value.value4) rightsArr.push('canWhitelistLPs')
  if (rights.value.value5) rightsArr.push('canChangeCap')
  return rightsArr
}
