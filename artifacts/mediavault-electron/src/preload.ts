import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:openFolder"),

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("app:version"),

  onUpdateAvailable: (cb: () => void) => {
    ipcRenderer.on("update:available", cb);
    return () => ipcRenderer.off("update:available", cb);
  },

  platform: process.platform,
});
