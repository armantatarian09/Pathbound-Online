import { MapSchema, Schema, type } from "@colyseus/schema";
import { DummyState } from "./DummyState.js";
import { PlayerState } from "./PlayerState.js";

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: DummyState }) dummies = new MapSchema<DummyState>();
  @type("number") serverTime = 0;
}
