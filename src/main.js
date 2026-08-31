import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Remarkable } from "remarkable";
import hljs from "highlight.js";
import hljsDarkUrl from "highlight.js/styles/github-dark.css?url";
import hljsLightUrl from "highlight.js/styles/github.css?url";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const WELCOME = [
  "# MarkUp",
  "",
  "A minimal, fast Markdown editor for macOS. Edit on the left, watch the result on the right.",
  "",
  "## Basics",
  "",
  "**Bold**, *italic*, ~~strikethrough~~, and `inline code`.",
  "",
  "## Lists",
  "",
  "1. Open a file with **⌘O** — or drag a `.md` file anywhere onto this window",
  "2. Edit away, the preview updates live",
  "3. Save with **⌘S**",
  "",
  "## Code",
  "",
  "```js",
  "function greet(name) {",
  "  return `Hello, ${name}!`;",
  "}",
  "",
  'greet("MarkUp");',
  "```",
  "",
  "## Tables",
  "",
  "| Feature | Status |",
  "| --- | --- |",
  "| Live preview | ✔ |",
  "| Syntax highlighting | ✔ |",
  "| Dark mode | ✔ |",
  "",
  "> Tip: drag and drop a Markdown file anywhere in this window to start editing it.",
  "",
  "---",
  "",
  "Built with [remarkable](https://github.com/jonschlinkert/remarkable).",
].join("\n");

const appWindow = getCurrentWindow();

const md = new Remarkable({
  html: true,
  gfm: true,
  breaks: false,
  langPrefix: "hljs language-",
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        return "";
      }
    }
    return "";
  },
});

const root = document.documentElement;
let isDark = root.dataset.theme === "dark";

const hljsThemeEl = document.createElement("link");
hljsThemeEl.rel = "stylesheet";
document.head.appendChild(hljsThemeEl);

const lightEditorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace",
    fontSize: "13.5px",
    lineHeight: "1.65",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--text-dim)",
    borderRight: "1px solid var(--border)",
  },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground": { background: "rgba(10, 132, 255, 0.18)" },
  "&.cm-focused .cm-selectionBackground": { background: "rgba(10, 132, 255, 0.3)" },
  ".cm-activeLine": { backgroundColor: "rgba(127, 127, 127, 0.08)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-placeholder": { color: "var(--text-dim)" },
});

const darkEditorTheme = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace",
    fontSize: "13.5px",
    lineHeight: "1.65",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--text-dim)",
    borderRight: "1px solid var(--border)",
  },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground": { background: "rgba(10, 132, 255, 0.25)" },
  "&.cm-focused .cm-selectionBackground": { background: "rgba(10, 132, 255, 0.4)" },
  ".cm-activeLine": { backgroundColor: "rgba(127, 127, 127, 0.12)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-placeholder": { color: "var(--text-dim)" },
});

const lightSyntax = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.operatorKeyword], color: "#cf222e" },
  { tag: t.string, color: "#0a3069" },
  { tag: t.special(t.string), color: "#0550ae" },
  { tag: t.number, color: "#0550ae" },
  { tag: t.bool, color: "#0550ae" },
  { tag: t.comment, color: "#6e7781", fontStyle: "italic" },
  { tag: t.function(t.variableName), color: "#8250df" },
  { tag: t.definition(t.variableName), color: "#953800" },
  { tag: t.variableName, color: "#24292f" },
  { tag: t.propertyName, color: "#0550ae" },
  { tag: t.attributeName, color: "#0550ae" },
  { tag: t.tagName, color: "#116329" },
  { tag: [t.typeName, t.className], color: "#953800" },
  { tag: t.operator, color: "#24292f" },
  { tag: t.punctuation, color: "#24292f" },
  { tag: t.processingInstruction, color: "#6e7781", fontStyle: "italic" },
  { tag: t.heading, color: "#8250df", fontWeight: "bold" },
  { tag: t.strong, color: "#24292f", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#0a84ff", textDecoration: "underline" },
  { tag: t.monospace, color: "#0550ae" },
  { tag: t.list, color: "#24292f" },
  { tag: t.quote, color: "#6e7781", fontStyle: "italic" },
  { tag: t.contentSeparator, color: "#57606a" },
  { tag: t.meta, color: "#6e7781" },
]);

const darkSyntax = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.operatorKeyword], color: "#ff7b72" },
  { tag: t.string, color: "#a5d6ff" },
  { tag: t.special(t.string), color: "#79c0ff" },
  { tag: t.number, color: "#79c0ff" },
  { tag: t.bool, color: "#79c0ff" },
  { tag: t.comment, color: "#8b949e", fontStyle: "italic" },
  { tag: t.function(t.variableName), color: "#d2a8ff" },
  { tag: t.definition(t.variableName), color: "#ffa657" },
  { tag: t.variableName, color: "#c9d1d9" },
  { tag: t.propertyName, color: "#79c0ff" },
  { tag: t.attributeName, color: "#79c0ff" },
  { tag: t.tagName, color: "#7ee787" },
  { tag: [t.typeName, t.className], color: "#ffa657" },
  { tag: t.operator, color: "#c9d1d9" },
  { tag: t.punctuation, color: "#c9d1d9" },
  { tag: t.processingInstruction, color: "#8b949e", fontStyle: "italic" },
  { tag: t.heading, color: "#d2a8ff", fontWeight: "bold" },
  { tag: t.strong, color: "#c9d1d9", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#58a6ff", textDecoration: "underline" },
  { tag: t.monospace, color: "#79c0ff" },
  { tag: t.list, color: "#c9d1d9" },
  { tag: t.quote, color: "#8b949e", fontStyle: "italic" },
  { tag: t.contentSeparator, color: "#8b949e" },
  { tag: t.meta, color: "#8b949e" },
]);

const themeCompartment = new Compartment();
const editorView = new EditorView({
  doc: WELCOME,
  parent: document.getElementById("editor"),
  extensions: [
    basicSetup,
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    themeCompartment.of(
      isDark ? [darkEditorTheme, syntaxHighlighting(darkSyntax)] : [lightEditorTheme, syntaxHighlighting(lightSyntax)]
    ),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        dirty = true;
        syncStatus();
      }
      if (update.docChanged || update.selectionSet) {
        const { head } = update.state.selection.main;
        const line = update.state.doc.lineAt(head);
        cursorPos.textContent = `Ln ${line.number}, Col ${head - line.from + 1}`;
      }
    }),
  ],
});

function applyTheme(next) {
  isDark = next;
  root.dataset.theme = next ? "dark" : "light";
  hljsThemeEl.href = next ? hljsDarkUrl : hljsLightUrl;
  editorView.dispatch({
    effects: themeCompartment.reconfigure(
      next
        ? [darkEditorTheme, syntaxHighlighting(darkSyntax)]
        : [lightEditorTheme, syntaxHighlighting(lightSyntax)]
    ),
  });
}

document.getElementById("btnTheme").addEventListener("click", () => applyTheme(!isDark));
applyTheme(isDark);

const wordCount = document.getElementById("wordCount");
const charCount = document.getElementById("charCount");
const cursorPos = document.getElementById("cursorPos");
const dirtyDot = document.getElementById("dirtyDot");
const fileName = document.getElementById("fileName");
const preview = document.getElementById("preview");
const toastEl = document.getElementById("toast");

let currentPath = null;
let dirty = false;
let renderTimer = null;
let toastTimer = null;

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    preview.innerHTML = md.render(editorView.state.doc.toString());
  }, 100);
}

function syncStatus() {
  const text = editorView.state.doc.toString();
  const words = (text.match(/\S+/g) || []).length;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  charCount.textContent = `${text.length} characters`;
  dirtyDot.style.visibility = dirty ? "visible" : "hidden";
  scheduleRender();
}

function setFileLabel(name) {
  fileName.textContent = name;
  appWindow.setTitle(name);
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

async function loadFile(path) {
  try {
    const content = await readTextFile(path);
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: content },
    });
    currentPath = path;
    dirty = false;
    setFileLabel(path.split("/").pop());
    syncStatus();
    return true;
  } catch (err) {
    toast(`Could not open file: ${err}`);
    return false;
  }
}

let dropLogReady = appDataDir().then(async (dir) => {
  await mkdir(dir, { recursive: true }).catch(() => {});
  return join(dir, "drop.log");
});
async function dropLog(line) {
  try {
    const logPath = await dropLogReady;
    let existing = "";
    try {
      existing = await readTextFile(logPath);
    } catch {
      /* first entry */
    }
    await writeTextFile(logPath, existing + `${new Date().toISOString()}\t${line}\n`);
  } catch {
    /* diagnostics only */
  }
}

async function openFile() {
  if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
  const path = await openDialog({
    multiple: false,
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (typeof path === "string" && path) await loadFile(path);
}

async function saveFile() {
  let path = currentPath;
  if (!path) {
    path = await saveDialog({
      defaultPath: "untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!path) return;
    currentPath = path;
  }
  try {
    await writeTextFile(path, editorView.state.doc.toString());
    dirty = false;
    setFileLabel(path.split("/").pop());
    syncStatus();
  } catch (err) {
    toast(`Could not save file: ${err}`);
  }
}

async function newFile() {
  if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: "" },
  });
  currentPath = null;
  dirty = false;
  setFileLabel("untitled");
  syncStatus();
}

document.getElementById("btnNew").addEventListener("click", newFile);
document.getElementById("btnOpen").addEventListener("click", openFile);
document.getElementById("btnSave").addEventListener("click", saveFile);

window.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === "n") {
    e.preventDefault();
    newFile();
  } else if (key === "o") {
    e.preventDefault();
    openFile();
  } else if (key === "s") {
    e.preventDefault();
    saveFile();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

listen("markup://open-file", (event) => {
  const path = event.payload;
  if (dirty && !confirm("You have unsaved changes. Discard them?")) return;
  loadFile(path);
});

invoke("drain_opened_files")
  .then((paths) => {
    const last = paths[paths.length - 1];
    if (last) loadFile(last);
  })
  .catch(() => {});

const divider = document.getElementById("divider");
const editorPane = document.getElementById("editorPane");
let dragging = false;
divider.addEventListener("pointerdown", (e) => {
  dragging = true;
  divider.classList.add("active");
  divider.setPointerCapture(e.pointerId);
});
divider.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const rect = document.getElementById("panes").getBoundingClientRect();
  const pct = ((e.clientX - rect.left) / rect.width) * 100;
  editorPane.style.flexBasis = `${Math.min(80, Math.max(20, pct))}%`;
});
divider.addEventListener("pointerup", () => {
  dragging = false;
  divider.classList.remove("active");
});

let dragDepth = 0;
getCurrentWebviewWindow().onDragDropEvent(async (event) => {
  const { type } = event.payload;
  if (type === "enter") {
    dragDepth += 1;
    document.body.classList.add("dragging");
  } else if (type === "over") {
    document.body.classList.add("dragging");
  } else if (type === "leave") {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove("dragging");
  } else if (type === "drop") {
    dragDepth = 0;
    document.body.classList.remove("dragging");
    const paths = event.payload.paths || [];
    dropLog(`DROP paths=${JSON.stringify(paths)}`);
    const path = paths[paths.length - 1];
    if (path) {
      if (await loadFile(path)) {
        toast(`Opened ${path.split("/").pop()}`);
      }
    } else {
      toast("Drop was empty");
    }
  }
});

syncStatus();
