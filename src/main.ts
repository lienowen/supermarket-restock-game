import "./styles.css";
import "./visual-comfort.css";
import "./game/presentation/actors/installRestockCartCombo";
import "./game/presentation/actors/installLevelOnePolish";
import { bootstrapGame } from "./game/bootstrap";

void bootstrapGame().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  document.body.dataset.bootstrapError = message;
  console.error("Game bootstrap failed.", error);
});
