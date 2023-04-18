import { EventEmitter } from "events";

class CodeElement extends EventEmitter {
  constructor(codeElement) {
    super();
    this.codeElement = codeElement;
    this.actionsDiv = undefined;
    this.setupActions();
    this.setupAutomation();
    this.setupObserver();
  }

  get language() {
    const classes = Array.from(this.codeElement.classList);
    const languageClass = classes.find((c) => c.startsWith("language-"));
    if (languageClass) {
      return languageClass.substring("language-".length);
    }
    return undefined;
  }

  async addAction(name, callback) {
    let actionsDiv = this.ensureActionsDiv();
    while (!actionsDiv) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      actionsDiv = this.ensureActionsDiv();
    }

    const button = document.createElement("button");
    button.textContent = name;
    button.addEventListener("click", () =>
      callback(this.language, this.codeElement.textContent ?? "")
    );
    button.style.backgroundColor = "white";
    button.style.color = "black";
    button.style.border = "1px solid black";
    button.style.borderRadius = "5px";
    button.style.paddingLeft = "5px";
    button.style.paddingRight = "5px";
    button.style.marginRight = "5px";
    actionsDiv.appendChild(button);
  }

  addAutomation(callback) {
    this.on("ready", () =>
      callback(this.language, this.codeElement.textContent ?? "")
    );
  }

  ensureActionsDiv() {
    const language = this.language;
    if (!language) return;

    const existingActionsDiv = this.codeElement.previousElementSibling;
    if (existingActionsDiv?.id === "actions") {
      this.actionsDiv = existingActionsDiv;
      return existingActionsDiv;
    }

    const actionsDiv = document.createElement("div");
    actionsDiv.id = "actions";
    actionsDiv.style.width = "100%";
    actionsDiv.style.height = "4em";
    actionsDiv.style.overflowX = "scroll";
    actionsDiv.style.display = "flex";
    actionsDiv.style.flexDirection = "row";
    this.codeElement.parentElement?.insertBefore(actionsDiv, this.codeElement);
    this.actionsDiv = actionsDiv;
    return actionsDiv;
  }

  setupActions() {
    // this.addAction("Copy", (language, code) =>
    //   navigator.clipboard.writeText(code)
    // );
  }

  setupAutomation() {
    // this.addAutomation((language, code) =>
    //   console.log("Automated:", language, code)
    // );
  }

  setupObserver() {
    let previousTextContent = this.codeElement.textContent;
    let timeoutHandle = setTimeout(() => this.emit("ready"), 5000);

    const onTextChanged = () => {
      const currentTextContent = this.codeElement.textContent;
      if (previousTextContent !== currentTextContent) {
        previousTextContent = currentTextContent;
        clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => this.emit("ready"), 5000);
      }
    };

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "characterData") {
          onTextChanged();
          this.ensureActionsDiv();
        }
      }
    });

    observer.observe(this.codeElement, {
      characterData: true,
      subtree: true,
    });
  }
}

class CodeElementWatcher extends EventEmitter {
  constructor() {
    super();
    this.elements = new Set();
    this.observer = new MutationObserver(this.processCodeElements.bind(this));
    this.observer.observe(document, { childList: true, subtree: true });
  }

  processCodeElements() {
    const codeElements = document.querySelectorAll("code");
    codeElements.forEach((codeElement) => {
      if (!this.elements.has(codeElement)) {
        this.elements.add(codeElement);
        const codeElementInstance = new CodeElement(codeElement);
        this.emit("code", codeElementInstance);
        codeElementInstance.on("ready", () => {
          this.emit("ready", codeElementInstance);
        });
        codeElement.dataset.processed = "true";
      }
    });
  }

  addListener(event, listener) {
    super.addListener(event, listener);
    if (event === "code") {
      this.processCodeElements();
    }
    return this;
  }

  stopWatching() {
    this.observer.disconnect();
  }
}

export default CodeElementWatcher;
