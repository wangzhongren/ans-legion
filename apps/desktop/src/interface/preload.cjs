'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('legionDesktop', Object.freeze({
  getState: (input = {}) => ipcRenderer.invoke('legion-desktop:getState', input),
  chooseProject: () => ipcRenderer.invoke('legion-desktop:chooseProject', {}),
  refreshProject: () => ipcRenderer.invoke('legion-desktop:refreshProject', {}),
  setDefaultProfile: (input) => ipcRenderer.invoke('legion-desktop:setDefaultProfile', input),
  saveProfile: (input) => ipcRenderer.invoke('legion-desktop:saveProfile', input),
  deleteProfile: (input) => ipcRenderer.invoke('legion-desktop:deleteProfile', input),
  assignProfile: (input) => ipcRenderer.invoke('legion-desktop:assignProfile', input),
  sendMessage: (input) => ipcRenderer.invoke('legion-desktop:sendMessage', input),
  selectContext: (input) => ipcRenderer.invoke('legion-desktop:selectContext', input),
  confirmPlan: (input) => ipcRenderer.invoke('legion-desktop:confirmPlan', input),
  cancelTurn: (input) => ipcRenderer.invoke('legion-desktop:cancelTurn', input),
  stopExecution: (input) => ipcRenderer.invoke('legion-desktop:stopExecution', input),
  testConnection: (input) => ipcRenderer.invoke('legion-desktop:testConnection', input),
  cancelProbe: (input) => ipcRenderer.invoke('legion-desktop:cancelProbe', input)
}));
