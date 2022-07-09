import BigNumber from "bignumber.js";
import _ from "lodash";
import { OrdersToSettle, Trade, Order, SettlementRequest, TestOrder, ORDER_TYPES, TIME_IN_FORCE, SettlementQueueMessageTypes } from "./types";
import {
    SignedSolidityOrder,
    Order as OnChainOrder,
    RawOrder
  } from "@firefly-exchange/library/dist/src/interfaces";

import {
    Price,
    OrderSigner,
    Fee,  
  } from "@firefly-exchange/library/dist/src/classes";

import {
    SigningMethod,
  } from "@firefly-exchange/library/dist/src/enums";

export function toBigNumber(num: number): BigNumber {
    return new BigNumber(num).shiftedBy(18);
}

export function toBigNumberStr(num: number): string {
    return toBigNumber(num).toFixed(0);
  }

export function randomDecimal(min: number, max: number): number {
    return Math.random() * (max - min + 1) + min;
  }
  
export function randomBigNumber(min: number, max: number): BigNumber {
    return toBigNumber(randomDecimal(min, max));
  }

  export function randomInteger(min: number, max: number): number {
    return Math.floor(randomDecimal(min, max));
  }

  export function randomHex(size = 66): string {
    return (
      "0x" +
      [...Array(size - 2)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join("")
    );
  }

export function ternary(val: any, toReturn: any): any {
    return val == undefined ? toReturn : val;
  }

  export function createOrder(options: any = {}): Order {
    options.amount = options?.amount || randomBigNumber(1, 100);
  
    // if the caller provided amount and price in number, big numberify it.
  
    if (typeof options.amount === "number") {
      options.amount = toBigNumber(options.amount);
    }
  
    if (typeof options.price === "number") {
      options.price = toBigNumber(options.price);
    }
  
    const order = {
      id: ternary(options?.id, randomInteger(0, 100)),
      hash: options?.hash || randomHex(),
      orderType: options?.orderType || ORDER_TYPES.LIMIT,
      isBuy: ternary(options?.isBuy, randomInteger(0, 1)),
      price: options?.price || randomBigNumber(1, 1000),
      amount: options.amount,
      amountLeft: options.amount,
      maker: options?.maker || randomHex(42),
      expiration: options?.expiration || 3153600000,
      typedSignature: options?.typedSignature || randomHex(),
      byteCode: options?.byteCode || randomHex(),
      timeInForce: options?.timeInForce || TIME_IN_FORCE.GOOD_TILL_CANCEL,
      triggerPrice: options?.price || 0,
      postOnly: options?.postOnly || false,
      requeueOnRevert: options?.requeueOnRevert || true,
      open: false
    } as Order;
  
    return order;
  }

export async function createSignedOrder(
    orderSigner: OrderSigner,
    order: TestOrder
  ): Promise<Order> {
    // Create on chain order payload to to generate typed signature
    const onChainOrder: OnChainOrder = {
      limitPrice: new Price(order.price),
      isBuy: order.isBuy,
      quantity: toBigNumber(order.amount),
      maker: order.maker,
      leverage: toBigNumber(order?.leverage || 1),
      expiration: new BigNumber(order?.expiration || 3153600000), // ????
      reduceOnly: false,
      limitFee: new Fee(0),
      triggerPrice: new Price(0),
      taker: "0x0000000000000000000000000000000000000000",
      salt: new BigNumber(new Date().getTime())
    };
  
    const generatedSignature = await orderSigner.signOrder(
      onChainOrder,
      SigningMethod.Hash
    );
  
    // create raw order, used to generate order hash
    const rawOrder: RawOrder = {
      isBuy: onChainOrder.isBuy,
      reduceOnly: onChainOrder.reduceOnly,
      quantity: onChainOrder.quantity.toFixed(0),
      limitPrice: onChainOrder.limitPrice.value.times(1e18).toFixed(0),
      triggerPrice: onChainOrder.triggerPrice.value.times(1e18).toFixed(0),
      limitFee: onChainOrder.limitFee.value.times(1e18).toFixed(0),
      leverage: onChainOrder.leverage.toFixed(0),
      maker: onChainOrder.maker,
      taker: onChainOrder.taker,
      expiration: Number(onChainOrder.expiration.toFixed(0)),
      salt: Number(onChainOrder.salt.toFixed(0)) as any,
      typedSignature: generatedSignature
    };
  
    const hash = OrderSigner.getRawOrderHash(
      rawOrder,
      orderSigner.getDomainHash()
    );
  
    // Create signed solidity order to generate bytecode
    const signedOrder: SignedSolidityOrder = {
      isBuy: onChainOrder.isBuy,
      reduceOnly: onChainOrder.reduceOnly,
      quantity: onChainOrder.quantity,
      limitPrice: onChainOrder.limitPrice.value.times(1e18), // on chain order limitPrice is not in 10^18 format
      triggerPrice: onChainOrder.triggerPrice.value.times(1e18),
      limitFee: onChainOrder.limitFee.value.times(1e18),
      leverage: onChainOrder.leverage,
      maker: onChainOrder.maker,
      taker: onChainOrder.taker,
      expiration: onChainOrder.expiration,
      salt: onChainOrder.salt,
      typedSignature: generatedSignature
    };
  
    const byteCode = orderSigner.toSolidityByteOrder(signedOrder);
  
    // create order for orderbook
    order.maker = order.maker.toLowerCase();
    const orderbookOrder: Order = createOrder({
      ...order,
      hash: hash,
      byteCode: byteCode,
      typedSignature: generatedSignature
    });
  
    return orderbookOrder;
}

export async function generateOrdersWithSettlementSize(
  orderSigner:OrderSigner,
  accounts:any[],
  settlementQueueSize: number
): Promise<SettlementRequest> {
  const makerOrder = await createSignedOrder(orderSigner, {
    maker: accounts[0].address,
    price: 10,
    amount: settlementQueueSize,
    isBuy: false
  } as TestOrder);

  const ordersToSettle: OrdersToSettle[] = [];
  while (--settlementQueueSize >= 0) {
    const takerOrder = await createSignedOrder(orderSigner, {
      maker: accounts[1].address,
      price: 10,
      amount: 1,
      isBuy: true
    } as TestOrder)

    ordersToSettle.push({
        makerOrder: makerOrder,
        takerOrder: takerOrder,
        amountToFill: toBigNumberStr(1)
      } as OrdersToSettle
    );
  }

  return {
    msgType: SettlementQueueMessageTypes.SETTLE,
    matchCount: settlementQueueSize,
    order: ordersToSettle
  };
}

export async function generateOrders(
  orderSigner:OrderSigner,
  accounts:any[],
  numOrders: number
): Promise<Array<SettlementRequest>> {
  console.log("generating orders")
  const requests = new Array<SettlementRequest>(numOrders);
  while (--numOrders >= 0) {
    // create a signed order from addr 1
    const o1 = await createSignedOrder(orderSigner, {
      maker: accounts[0].address,
      price: 10,
      amount: 1,
      isBuy: false
    } as TestOrder);

    // create a signed order from addr 2
    const o2 = await createSignedOrder(orderSigner, {
      maker: accounts[1].address,
      price: 10,
      amount: 1,
      isBuy: true
    } as TestOrder);

    const orderToSettle = {
      makerOrder: o1,
      takerOrder: o2,
      amountToFill: toBigNumberStr(1)
    } as OrdersToSettle;

    requests[numOrders] = {
      msgType: SettlementQueueMessageTypes.SETTLE,
      matchCount: 1,
      order: [orderToSettle]
    };
  }
  return requests;
}

export function transformRawOrderTx(txs: OrdersToSettle[], orderSigner:OrderSigner) {
  
    // Get all maker addresses
    const makerAddress: string[] = [];
    const trades: Trade[] = [];
    txs.map((f) => {
      makerAddress.push(f.makerOrder.maker);
    });

    // Taker address will be same for all taker orders so just take from the first one
    // Create accounts array
    const accounts = _.chain([txs[0].takerOrder.maker, ...makerAddress])
      .map(_.toLower)
      .sort()
      .sortedUniq()
      .value();

    for (let i = 0; i < txs.length; i++) {
      trades.push(
        setUpTrade(
          orderSigner,
          txs[i].takerOrder,
          txs[i].makerOrder,
          txs[i].takerOrder.maker,
          txs[i].makerOrder.maker,
          new BigNumber(txs[i].amountToFill),
          accounts
        )
      );
    }
    return { accounts, trades };
  }

function setUpTrade(
    orderSigner:OrderSigner,
    takerOrder: Order,
    makerOrder: Order,
    takerAddress: string,
    makerAddress: string,
    amountToFill: BigNumber,
    accounts: string[]
  ): Trade {
    const tradeData = orderSigner.fillSolidityByteOrderToTradeData(
      makerOrder.byteCode,
      takerOrder.byteCode,
      makerOrder.typedSignature,
      takerOrder.typedSignature,
      amountToFill,
      new BigNumber(makerOrder.price), // maker's price point
      new BigNumber(0)
    );

    return {
      makerIndex: accounts.indexOf(makerAddress.toLowerCase()),
      takerIndex: accounts.indexOf(takerAddress.toLowerCase()),
      trader: orderSigner.address.toLowerCase(),
      data: tradeData,
      isBuy: makerOrder.isBuy // from maker's perspective
    } as Trade;
  }