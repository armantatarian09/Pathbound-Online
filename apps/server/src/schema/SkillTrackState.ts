import { Schema, type } from "@colyseus/schema";

export class SkillTrackState extends Schema {
  @type("number") ArcheryAccuracy = 0;
  @type("number") SwordPrecision = 0;
  @type("number") Assassination = 0;
  @type("number") MagicControl = 0;
}
