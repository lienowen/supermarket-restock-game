import {
  levelNumberFromId,
  promotionProgress
} from "../../application/StaffProgression";

const HUD_ID = "staff-career-hud";

const ensureStyle = (): void => {
  if (document.getElementById(`${HUD_ID}-style`)) return;
  const style = document.createElement("style");
  style.id = `${HUD_ID}-style`;
  style.textContent = `
    #${HUD_ID} {
      position: fixed;
      left: max(14px, env(safe-area-inset-left));
      top: max(86px, calc(env(safe-area-inset-top) + 74px));
      z-index: 1200;
      min-width: 188px;
      padding: 8px 12px 9px;
      border: 1px solid rgba(255, 217, 94, .44);
      border-radius: 13px;
      background: rgba(7, 21, 15, .90);
      box-shadow: 0 6px 16px rgba(0, 0, 0, .22), inset 0 1px rgba(255,255,255,.06);
      color: #fff;
      font-family: Arial, sans-serif;
      pointer-events: none;
      user-select: none;
      backdrop-filter: blur(5px);
    }
    #${HUD_ID} .staff-career-title {
      color: #ffd95e;
      font-size: 11px;
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: 1.35px;
      text-transform: uppercase;
    }
    #${HUD_ID} .staff-career-progress {
      margin-top: 5px;
      color: #b8d9c4;
      font-size: 10px;
      line-height: 1.1;
      font-weight: 700;
      letter-spacing: .35px;
    }
    #${HUD_ID} .staff-career-track {
      width: 100%;
      height: 5px;
      margin-top: 6px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.10);
    }
    #${HUD_ID} .staff-career-fill {
      height: 100%;
      border-radius: inherit;
      background: #ffd95e;
      box-shadow: 0 0 8px rgba(255, 217, 94, .42);
      transition: width 220ms ease-out;
    }
    @media (max-height: 520px) {
      #${HUD_ID} {
        top: max(66px, calc(env(safe-area-inset-top) + 58px));
        min-width: 164px;
        padding: 6px 10px 7px;
        transform: scale(.9);
        transform-origin: top left;
      }
    }
  `;
  document.head.appendChild(style);
};

const render = (): void => {
  const levelId = document.body.dataset.activeLevel;
  let hud = document.getElementById(HUD_ID);
  if (!levelId) {
    hud?.remove();
    return;
  }

  const level = levelNumberFromId(levelId) ?? 1;
  const progress = promotionProgress(level);
  if (!hud) {
    hud = document.createElement("div");
    hud.id = HUD_ID;
    hud.innerHTML = `
      <div class="staff-career-title"></div>
      <div class="staff-career-progress"></div>
      <div class="staff-career-track"><div class="staff-career-fill"></div></div>
    `;
    document.body.appendChild(hud);
  }

  const title = hud.querySelector<HTMLElement>(".staff-career-title");
  const progressText = hud.querySelector<HTMLElement>(".staff-career-progress");
  const fill = hud.querySelector<HTMLElement>(".staff-career-fill");
  if (!title || !progressText || !fill) return;

  title.textContent = progress.rank.title;
  progressText.textContent = progress.nextRank
    ? `PROMOTION ${progress.completedInRank}/${progress.requiredInRank} · NEXT ${progress.nextRank.title.toUpperCase()}`
    : "FINAL RANK · SHIFT LEADER";
  fill.style.width = `${Math.round(progress.percent * 100)}%`;
  document.body.dataset.staffRank = progress.rank.id;
  document.body.dataset.staffPromotionProgress = `${progress.completedInRank}/${progress.requiredInRank}`;
};

export function installStaffCareerHud(): void {
  ensureStyle();
  render();
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "attributes" && record.attributeName === "data-active-level")) {
      render();
    }
  });
  observer.observe(document.body, { attributes: true });
  window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}
