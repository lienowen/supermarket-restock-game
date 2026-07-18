import Phaser from "phaser";
import { ShiftHud } from "../../game/presentation/ui/ShiftHud";
import { DAY_ONE_CONTENT } from "../content/day01";

/**
 * Compatibility adapter while the temporary game-v2 scene is migrated into
 * the project-wide presentation layer.
 */
export class ImmersiveHud extends ShiftHud {
  constructor(scene: Phaser.Scene, onAction: () => void) {
    super(
      scene,
      {
        dayLabel: DAY_ONE_CONTENT.title,
        timeLabel: DAY_ONE_CONTENT.timeLabel,
        initialObjective: DAY_ONE_CONTENT.objective,
        palette: DAY_ONE_CONTENT.palette
      },
      onAction
    );
  }
}
