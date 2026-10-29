import { Platform } from "react-native";

export const colors = {
  ink: "#0c2748", muted: "#63748b", blue: "#0c2748", blueDark: "#173b64",
  accent: "#f9a006", pale: "#eef3f9", line: "#dce4ee", white: "#ffffff", bg: "#f7f9fc",
  success: "#16845b", warning: "#a96b08", danger: "#bd3e49",
};

export const shadow = Platform.select({
  ios: { shadowColor: "#132238", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: {},
});
