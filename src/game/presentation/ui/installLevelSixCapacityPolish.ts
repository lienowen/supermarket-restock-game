const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;

const LEVEL_SIX_CAPACITY_ASSETS = Object.freeze([
  "assets/game/missing-assets-batch-01/delivery-box-small.png",
  "assets/game/missing-assets-batch-01/delivery-box-medium.png",
  "assets/game/missing-assets-batch-01/delivery-box-large.png",
  "assets/game/missing-assets-batch-01/equipment-capacity-cart-empty.png",
  "assets/game/missing-assets-batch-01/equipment-capacity-cart-loaded.png"
]);

// Keep strong references for the lifetime of the page so the loaded-cart swap is
// instant when a 6/6 trip completes, including on slower mobile browsers.
const levelSixCapacityPreloads: HTMLImageElement[] = [];
LEVEL_SIX_CAPACITY_ASSETS.forEach((path) => {
  const image = new Image();
  image.decoding = "async";
  image.src = assetUrl(path);
  levelSixCapacityPreloads.push(image);
});

const STYLE_ID = "level-six-capacity-polish";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #cart-capacity-options [data-capacity-units="1"] > img {
      width: 50px !important;
      height: 46px !important;
    }

    #cart-capacity-options [data-capacity-units="2"] > img {
      width: 62px !important;
      height: 55px !important;
    }

    #cart-capacity-options [data-capacity-units="3"] > img {
      width: 76px !important;
      height: 64px !important;
    }

    #cart-capacity-cart-image {
      transition: transform 180ms ease, filter 180ms ease !important;
    }

    body[data-cart-capacity-state="full"] #cart-capacity-target {
      box-shadow: 0 0 0 2px rgba(255, 217, 94, 0.18), 0 0 28px rgba(255, 217, 94, 0.22);
    }

    body[data-cart-capacity-state="full"] #cart-capacity-cart-image {
      transform: scale(1.07);
      filter: drop-shadow(0 9px 14px rgba(0, 0, 0, 0.38)) brightness(1.08) !important;
    }

    body[data-cart-capacity-state="full"] #cart-capacity-target::after {
      content: "✓ 6 / 6 · PERFECT LOAD";
      position: absolute;
      left: 50%;
      top: 48%;
      z-index: 8;
      transform: translate(-50%, -50%);
      padding: 8px 12px;
      border: 1px solid rgba(255, 232, 147, 0.78);
      border-radius: 999px;
      background: rgba(12, 38, 24, 0.94);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38);
      color: #ffe993;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.7px;
      white-space: nowrap;
      pointer-events: none;
      animation: level-six-perfect-load-pop 260ms ease-out both;
    }

    body[data-cart-capacity-state="full"] #cart-capacity-feedback {
      color: #ffd95e !important;
      font-size: 12px !important;
      letter-spacing: 0.3px;
    }

    @keyframes level-six-perfect-load-pop {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.78); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    @media (max-height: 520px) and (pointer: coarse) {
      #cart-capacity-options [data-capacity-units="1"] > img {
        width: 44px !important;
        height: 40px !important;
      }

      #cart-capacity-options [data-capacity-units="2"] > img {
        width: 54px !important;
        height: 48px !important;
      }

      #cart-capacity-options [data-capacity-units="3"] > img {
        width: 66px !important;
        height: 56px !important;
      }

      body[data-cart-capacity-state="full"] #cart-capacity-target::after {
        padding: 6px 9px;
        font-size: 10px;
      }
    }
  `;
  document.head.appendChild(style);
}

export {};
