import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import adminZhCN from "./locales/zh-CN/admin.json";
import authZhCN from "./locales/zh-CN/auth.json";
import commonZhCN from "./locales/zh-CN/common.json";
import errorsZhCN from "./locales/zh-CN/errors.json";
import homeZhCN from "./locales/zh-CN/home.json";
import learningZhCN from "./locales/zh-CN/learning.json";
import adminEnUS from "./locales/en-US/admin.json";
import authEnUS from "./locales/en-US/auth.json";
import commonEnUS from "./locales/en-US/common.json";
import errorsEnUS from "./locales/en-US/errors.json";
import homeEnUS from "./locales/en-US/home.json";
import learningEnUS from "./locales/en-US/learning.json";

export const defaultLanguage = "zh-CN";
export const fallbackLanguage = "en-US";

void i18n.use(initReactI18next).init({
  lng: defaultLanguage,
  fallbackLng: fallbackLanguage,
  defaultNS: "common",
  ns: ["common", "home", "learning", "auth", "errors", "admin"],
  resources: {
    "zh-CN": {
      admin: adminZhCN,
      auth: authZhCN,
      common: commonZhCN,
      errors: errorsZhCN,
      home: homeZhCN,
      learning: learningZhCN,
    },
    "en-US": {
      admin: adminEnUS,
      auth: authEnUS,
      common: commonEnUS,
      errors: errorsEnUS,
      home: homeEnUS,
      learning: learningEnUS,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
