import { newsOnlyStyle, showNewsOnly } from "./news-only.ts";

GM_addStyle(newsOnlyStyle());
showNewsOnly(document, location);
