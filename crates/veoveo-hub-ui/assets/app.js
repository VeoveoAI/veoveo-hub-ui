"use strict";
// What every App on the Hub needs from its host: the MCP Apps bridge and the host's theme.
const veoveoApp = (() => {
  const PROTOCOL = "2026-01-26";
  const TIMEOUT = 30000;
  const pending = new Map();
  let nextId = 1;
  const post = (message) => window.parent.postMessage(message, "*");
  const notify = (method, params) => post({ jsonrpc: "2.0", method, params });
  const request = (method, params, timeout = TIMEOUT) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`the host did not answer ${method}`));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    post({ jsonrpc: "2.0", id, method, params });
  });
  const applyContext = (context) => {
    if (context && (context.theme === "dark" || context.theme === "light")) {
      document.documentElement.dataset.theme = context.theme;
    }
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") return;
    if (typeof message.method === "string") {
      if (message.method === "ui/notifications/host-context-changed") applyContext(message.params);
      if (message.id !== undefined && message.id !== null) post({ jsonrpc: "2.0", id: message.id, result: {} });
      return;
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timer);
    if (message.error) call.reject(new Error(message.error.message || "the request failed"));
    else call.resolve(message.result);
  });
  return {
    request,
    /** Says who this App is, and starts telling the host how tall it is. */
    connect: async (name) => {
      const initialized = await request("ui/initialize", {
        protocolVersion: PROTOCOL,
        appInfo: { name, version: "1" },
        appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] },
      });
      applyContext(initialized && initialized.hostContext);
      notify("ui/notifications/initialized", {});
      new ResizeObserver(() => {
        notify("ui/notifications/size-changed", { height: document.documentElement.scrollHeight });
      }).observe(document.body);
    },
    /** A tool of this App's own server: its structured answer, or an error with its text. */
    tool: async (name, args, timeout) => {
      const reply = await request("tools/call", { name, arguments: args }, timeout);
      if (reply.isError) throw new Error((reply.content || []).map((part) => part.text || "").join(" ") || `${name} failed`);
      return reply.structuredContent;
    },
    /** A JSON resource of this App's own server. */
    read: async (uri) => {
      const read = await request("resources/read", { uri });
      return JSON.parse(read.contents[0].text);
    },
    /** Goes to a page the host opens. */
    openLink: (url) => request("ui/open-link", { url }),
  };
})();
