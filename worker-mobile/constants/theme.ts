import { Platform } from "react-native";

export const colors = {
  navy: "#3c5a1e", navyDeep: "#2a4014", ink: "#1a2a3a", body: "#4e6079",
  muted: "#63748b", blue: "#3c5a1e", blueDark: "#173b64", accent: "#dca03c", amber: "#dca03c",
  amberDark: "#b8822f", pale: "#eef3f9", line: "#dce4ee", white: "#ffffff", bg: "#f4f7fa",
  success: "#16845b", warning: "#b8822f", danger: "#b3402e",
};

export const shadow = Platform.select({
  ios: { shadowColor: "#1a2a3a", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: {},
});
