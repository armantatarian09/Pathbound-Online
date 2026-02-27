import { Schema, type } from "@colyseus/schema";
import { SkillTrackState } from "./SkillTrackState.js";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") archetype = "Swordsman";

  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("number") vy = 0;
  @type("boolean") onGround = true;

  @type("number") hp = 100;
  @type("number") maxHp = 100;
  @type("number") stamina = 100;
  @type("number") mana = 100;

  @type(SkillTrackState) skillXp = new SkillTrackState();
  @type(SkillTrackState) skillLevels = new SkillTrackState();
}
