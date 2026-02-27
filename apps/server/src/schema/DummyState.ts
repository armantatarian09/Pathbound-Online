import { Schema, type } from "@colyseus/schema";

export class DummyState extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") hp = 100;
  @type("number") maxHp = 100;
  @type("number") respawnAt = 0;
}
