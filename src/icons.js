import soundOn from "@phosphor-icons/core/assets/regular/speaker-simple-high.svg?raw";
import soundOff from "@phosphor-icons/core/assets/regular/speaker-simple-slash.svg?raw";
import pause from "@phosphor-icons/core/assets/regular/pause.svg?raw";
import play from "@phosphor-icons/core/assets/regular/play.svg?raw";
import fullscreen from "@phosphor-icons/core/assets/regular/arrows-out.svg?raw";
import menu from "@phosphor-icons/core/assets/regular/list.svg?raw";
import stack from "@phosphor-icons/core/assets/regular/stack-simple.svg?raw";
import camera from "@phosphor-icons/core/assets/regular/camera.svg?raw";
import close from "@phosphor-icons/core/assets/regular/x.svg?raw";
import spark from "@phosphor-icons/core/assets/regular/sparkle.svg?raw";
export const ICONS = Object.fromEntries(
  Object.entries({
    "sound-on": soundOn,
    "sound-off": soundOff,
    pause,
    play,
    fullscreen,
    menu,
    stack,
    camera,
    close,
    spark,
  }).map(([key, value]) => [
    key,
    value.replace("<svg ", '<svg aria-hidden="true" focusable="false" '),
  ]),
);
export function applyIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((n) => {
    n.innerHTML = ICONS[n.dataset.icon] || "";
  });
}
