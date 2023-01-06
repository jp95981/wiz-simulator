const { io } = require("socket.io-client");

class EventEmitter {
  constructor() {
    this.emitters = {};
  }

  subscribe(event, callback) {
    if (!this.emitters[event]) {
      this.emitters[event] = [];
    }

    this.emitters[event].push(callback);
  }

  unsubscribe(event) {}

  emit(event, data) {
    if (!this.emitters[event]) {
      return;
    }

    this.emitters[event].forEach((cb) => cb(data));
  }
}

class WebsocketClient extends EventEmitter {
  token;
  socket;
  constructor() {
    super();
    this.token = "";
    this.subscriptions = {};
    this.socket = io();
    this.url =
      process.env.NODE_ENV === "production"
        ? "https://wisdom-orderbook.fly.dev"
        : "http://localhost:3000";
  }

  initSocket() {
    this.socket = io(this.url, {
      auth: {
        token: this.token,
      },
    });

    this.socket.on("connect", () => {
      console.log("Connected!");

      Object.entries(this.subscriptions).forEach(([event, data]) => {
        this.socket.emit("subscribe", { event: event, args: data });
      });
    });

    this.socket.on("error", (message) => {
      console.log(message);
    });
  }

  send(event, data, callback) {
    // console.log({ event, data });
    this.socket.emit(event, data, callback);
  }

  subscribe(event, callback) {
    super.subscribe(event, callback);
    this.socket.on(event, callback);
  }

  unsubscribe(event) {
    super.unsubscribe(event);
    this.socket.off(event);
  }

  subscribeStream(event, data, callback) {
    console.log({ event, data });
    this.subscriptions[event] = data;
    this.socket.emit("subscribe", { event: event, args: data });
    this.subscribe(event, callback);
  }

  unsubscribeStream(event) {
    delete this.subscriptions[event];
    this.socket.emit("unsubscribe", event);
    this.unsubscribe(event);
  }
}

module.exports = WebsocketClient;
