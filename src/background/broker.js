/* eslint-disable no-inner-declarations */
class MessageBrokerImpl {
  constructor() {
    this.connections = new Map();
    chrome.runtime.onConnect.addListener(this.addConnection.bind(this));
  }

  generateConnectionKey(tabId, frameId, portName) {
    const sanitizedTabId = tabId !== undefined ? tabId : -1;
    const sanitizedFrameId = frameId !== undefined ? frameId : -1;
    return `${sanitizedTabId}_${sanitizedFrameId}_${portName}`;
  }

  addConnection(port) {
    if (!port.name.includes("GPTEA")) {
      return;
    }

    const portConnection = {
      port,
      subscriptions: new Set(),
    };

    const connectionKey = this.generateConnectionKey(
      port.sender?.tab?.id,
      port.sender?.frameId,
      port.name
    );

    console.log("got port", connectionKey);
    this.connections.set(connectionKey, portConnection);
    console.log(this.connections);
    port.onDisconnect.addListener(() => this.removeConnection(connectionKey));
    port.onMessage.addListener((message) =>
      this.onMessage(connectionKey, message)
    );
  }

  removeConnection(connectionKey) {
    console.log("removing connection", connectionKey);
    this.connections.delete(connectionKey);
  }

  onMessage(connectionKey, message) {
    console.log(connectionKey, message);
    switch (message.type) {
      case "SUBSCRIBE":
        this.subscribe(connectionKey, message.payload);
        break;
      case "UNSUBSCRIBE":
        this.unsubscribe(connectionKey, message.payload);
        break;
      default:
        this.dispatchMessage(message.type, message.payload, connectionKey);
        break;
    }
  }

  dispatchMessage(type, payload, _senderPortId) {
    console.log(
      "dispatchMessage",
      this.connections,
      this.connections.entries()
    );

    // Log the size of the Map and ensure it's not empty
    console.log("connections size: ", this.connections.size);

    // Try iterating over the entries of the Map and log the key and value
    this.connections.forEach((connection) => {
      console.log(
        "checking connection.subscriptions.has(type)",
        connection.subscriptions.has(type)
      );
      if (
        connection.subscriptions.has(type) ||
        connection.subscriptions.has("*")
      ) {
        connection.port.postMessage({
          type,
          payload,
          tabId: Number.parseInt(_senderPortId.split("_")[0]),
        });
      }
    });
  }

  subscribe(connectionKey, messageType) {
    const connection = this.connections.get(connectionKey);
    if (connection) {
      connection.subscriptions.add(messageType);
    }
  }

  unsubscribe(connectionKey, messageType) {
    const connection = this.connections.get(connectionKey);
    if (connection) {
      connection.subscriptions.delete(messageType);
    }
  }
}
exports.MessageBroker = MessageBrokerImpl;

// Initialize the message broker in the background script
if (chrome.runtime.id) {
  new MessageBrokerImpl();
}
