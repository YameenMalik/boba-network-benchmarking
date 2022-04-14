import BigNumber from "bignumber.js";

// ENUMS

export enum SettlementQueueMessageTypes {
  SETTLE = "SETTLE"
}

export enum TIME_IN_FORCE {
  GOOD_TILL_CANCEL = "GTC",
  IMMEDIATE_OR_CANCEL = "IOC",
  FILL_OR_KILL = "FOK"
}

export enum ORDER_TYPES {
  MARKET = "MARKET",
  LIMIT = "LIMIT"
}


// INTERFACES

export interface Order {
  // identification
  id: number;
  hash: string;
  // needed by order matching engine
  orderType: ORDER_TYPES;
  isBuy: boolean;
  price: BigNumber;
  amount: BigNumber;
  amountLeft: BigNumber;
  triggerPrice: BigNumber;
  maker: string;
  expiration: number;
  timeInForce: TIME_IN_FORCE;
  postOnly: boolean;
  requeueOnRevert: boolean;
  // needed by settlement engine
  typedSignature: string;
  byteCode: string;

  // flag indicating if the order was open at any
  // point in its lifetime on orderbook
  // undefined/false implies the order is never opened
  // on orderbook
  open?: boolean;
}

export interface SettlementRequest {
  matchCount: number;
  msgType: SettlementQueueMessageTypes;
  order: Array<OrdersToSettle>;
}

//expertimental
export interface OrdersToSettle {
  // Need to recheck order type
  takerOrder: Order;
  makerOrder: Order;
  amountToFill: string | BigNumber;
}


export interface Trade {
  makerIndex: number;
  takerIndex: number;
  trader: string;
  data: string;
  isBuy: boolean;
}


export interface TestOrder {
  maker: string;
  amount: number;
  price: number;
  isBuy: boolean;
  orderType?: ORDER_TYPES; // default order type is LIMIT
  leverage?: number; // default leverage is 1
  expiration?: number; // default expiration is set to 3153600000
  timeInForce?: TIME_IN_FORCE; // default is seto to GTC
  postOnly?: boolean; // will be set to FALSE if not provided
  id?: number; // if not provided will be generated randomly.
  requeueOnRevert?: boolean; // will be set to TRUE if not provided
}