import type { SkillKey } from "@pathbound/shared";
import { SkillTrackState } from "../schema/SkillTrackState.js";

export function getSkillValue(track: SkillTrackState, key: SkillKey): number {
  switch (key) {
    case "ArcheryAccuracy":
      return track.ArcheryAccuracy;
    case "SwordPrecision":
      return track.SwordPrecision;
    case "Assassination":
      return track.Assassination;
    case "MagicControl":
      return track.MagicControl;
  }

  return 0;
}

export function setSkillValue(track: SkillTrackState, key: SkillKey, value: number): void {
  switch (key) {
    case "ArcheryAccuracy":
      track.ArcheryAccuracy = value;
      return;
    case "SwordPrecision":
      track.SwordPrecision = value;
      return;
    case "Assassination":
      track.Assassination = value;
      return;
    case "MagicControl":
      track.MagicControl = value;
      return;
  }
}
