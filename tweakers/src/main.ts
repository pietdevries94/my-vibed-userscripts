import style from "./style.css";

const NEWS_ONLY_CLASS = "fix-tweakers-news-only";

GM_addStyle(style);
document.documentElement.classList.toggle(NEWS_ONLY_CLASS, location.pathname === "/");
