const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld("api", {
    receiveTokens: (channel, callback) => {
        let validChannels = ["fromMain"];
        if(validChannels.includes(channel)){
            ipcRenderer.on(channel, (callback));
        }
    },
    updateProgress: (channel, callback) => {
        let validChannels = ["updateProgress"];
        if(validChannels.includes(channel)){
            ipcRenderer.on(channel, (callback));
        }
    },
    sendDownload: (channel, data) => {
        let validChannels = ["sendDownload"];
        if(validChannels.includes(channel)){
            ipcRenderer.send(channel, data);
        }
    },
    signOut: (channel, data) => {
        let validChannels = ["signOut"];
        if(validChannels.includes(channel)){
            ipcRenderer.send(channel, data);
        }
    },
    requestRefreshToken: (channel, data) => {
        let validChannels = ["requestRefreshToken"];
        if(validChannels.includes(channel)){
            ipcRenderer.send(channel, data);
        }
    }
});
