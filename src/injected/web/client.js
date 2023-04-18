class BrokerClient {
  constructor() {
    // eslint-disable-next-line no-undef
    this.port = window.chrome.runtime.connect({
      name: `GPTEA_${Math.random()}`,
    });
    this.eventListeners = new Map();
    this.requestHandlers = new Map();
    this.port.onMessage.addListener(this.handleMessage.bind(this));
  }

  handleMessage(event) {
    console.log("got event", event);
    if (event.type.startsWith("REQUEST:")) {
      this.handleRequest(event);
    } else {
      // Process non-wildcard events
      if (event.type !== "*") {
        const callbacks = this.eventListeners.get(event.type);
        if (callbacks) {
          callbacks.forEach((callback) => {
            callback(event);
          });
        }
      }

      // Process wildcard events
      const wildcardCallbacks = this.eventListeners.get("*");
      if (wildcardCallbacks) {
        wildcardCallbacks.forEach((callback) => {
          callback(event);
        });
      }
    }
  }

  handleRequest(requestEvent) {
    console.log("handleRequest", requestEvent);
    const { id, handlerName, payload } = requestEvent.payload;
    const handler = this.requestHandlers.get(handlerName);
    if (handler) {
      const sendResponse = (responsePayload) => {
        this.port.postMessage({
          type: `RESPONSE:${id}`,
          payload: responsePayload,
        });
      };
      handler(payload, sendResponse);
    }
  }

  registerHandler(name, callback) {
    this.requestHandlers.set(name, callback);
    this.port.postMessage({ type: "SUBSCRIBE", payload: `REQUEST:${name}` });
  }

  unregisterHandler(name) {
    this.requestHandlers.delete(name);
    this.port.postMessage({ type: "UNSUBSCRIBE", payload: `REQUEST:${name}` });
  }

  request(handlerName, payload) {
    return new Promise((resolve) => {
      const requestId = `${Math.random()}`;
      this.on(`RESPONSE:${requestId}`, resolve);
      this.port.postMessage({
        type: `REQUEST:${handlerName}`,
        payload: {
          id: requestId,
          handlerName,
          payload,
        },
      });
    });
  }

  connect() {
    this.port.postMessage({ type: "SUBSCRIBE", payload: "*" });
  }

  disconnect() {
    this.port.postMessage({ type: "UNSUBSCRIBE", payload: "*" });
    this.port.disconnect();
  }

  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)?.add(callback);
    this.port.postMessage({ type: "SUBSCRIBE", payload: eventType });
  }

  off(eventType, callback) {
    const callbacks = this.eventListeners.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.port.postMessage({ type: "UNSUBSCRIBE", payload: eventType });
      }
    }
  }

  dispatch(event) {
    this.port.postMessage(event);
  }
}

export class ChatBot {
  async start() {
    const newChatLink = Array.from(document.querySelectorAll("a")).find(
      (anchor) => anchor.innerText === "New Chat"
    );
    if (newChatLink) {
      newChatLink.click();
    } else {
      console.error('Could not find the "New Chat" link.');
    }
  }

  async request(text, timeout = 3000, skipChunking = false) {
    if (!skipChunking) {
      const words = text.split(" ");
      if (words.length > 4000) {
        const chunks = [];
        while (words.length > 0) {
          const chunk = words.splice(0, 4000).join(" ");
          chunks.push(chunk);
        }
        return await this.sendChunks(chunks);
      }

      text += " finish your response with 'EOF' so I know you're done";
    }

    return new Promise(async (resolve) => {
      const textbox = document.querySelector("textarea");
      const sendButton = textbox.nextElementSibling;

      if (sendButton.hasAttribute("disabled")) {
        sendButton.removeAttribute("disabled");
      }

      textbox.value = text;
      sendButton.click();

      let lastContent = "";
      let checkInterval;

      const checkLastGroup = () => {
        const lastGroup = Array.from(
          document.querySelectorAll("div.group")
        ).pop();
        const raw = lastGroup.textContent || "";
        if (lastContent !== raw) {
          lastContent = raw;
        } else {
          clearInterval(checkInterval);

          const codeElements = lastGroup.querySelectorAll("code");
          resolve({ raw, codeElements });
        }
      };

      checkInterval = setInterval(checkLastGroup, timeout);
    });
  }

  async sendChunks(chunks) {
    let combinedResponse = { raw: "", codeElements: [] };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const preamble =
        i === chunks.length - 1
          ? "This is the final chunk, please respond to all chunks."
          : `This is chunk ${i + 1} of ${
              chunks.length
            }, please respond with 'ACK' and wait for the rest.`;
      const postscript =
        i === chunks.length - 1
          ? "This is the final chunk, please respond to all chunks."
          : `End chunk ${i + 1} of ${
              chunks.length
            }, remember to respond with 'ACK' for more chunks.`;
      const response = await this.request(
        `${preamble} ${chunk} ${postscript}`,
        3000,
        true
      );

      if (response.raw.trim() !== "ACK" || i === chunks.length - 1) {
        combinedResponse.raw += response.raw + " ";
        combinedResponse.codeElements = combinedResponse.codeElements.concat(
          response.codeElements
        );
      }
    }

    return combinedResponse;
  }

  mergeText(text1, text2) {
    // Remove whitespace from the beginning and end of the strings
    const trimmedText1 = text1.trim();
    const trimmedText2 = text2.trim();

    for (let overlapLength = 200; overlapLength > 0; overlapLength--) {
      if (
        trimmedText1.slice(-overlapLength) ===
        trimmedText2.slice(0, overlapLength)
      ) {
        // Reconstruct the merged string using the original text1 and text2
        return trimmedText1 + trimmedText2.slice(overlapLength).trim();
      }
    }
    return text1 + text2;
  }

  combineCodeElementsWithClass(classStrs, codeElements) {
    const filteredElements = Array.from(codeElements).filter((el) =>
      classStrs.some((classStr) => el.classList.contains(classStr))
    );
    const combinedText = filteredElements.reduce((acc, el, idx) => {
      if (idx === 0) {
        return el.textContent;
      }
      return this.mergeText(acc, el.textContent);
    }, "");

    return combinedText;
  }
}

export default BrokerClient;
