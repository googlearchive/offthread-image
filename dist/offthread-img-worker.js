/*!
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
!function e(t,r,n){function o(i,s){if(!r[i]){if(!t[i]){var c="function"==typeof require&&require;if(!s&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var f=r[i]={exports:{}};t[i][0].call(f.exports,function(e){var r=t[i][1][e];return o(r?r:e)},f,f.exports,e,t,r,n)}return r[i].exports}for(var u="function"==typeof require&&require,i=0;i<n.length;i++)o(n[i]);return o}({1:[function(e,t,r){"use strict";function n(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}var o=function(){function e(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}return function(t,r,n){return r&&e(t.prototype,r),n&&e(t,n),t}}(),u=(self.console.log.bind(self.console),0),i=3,s=function(){function e(t){n(this,e),this.queue=[],this.workerContext=t}return o(e,[{key:"enqueue",value:function(e){return console.log("enqueue",e,this.queue),this.queue.indexOf(e)>=0?void console.log("repeated. skip"):(this.queue.push(e),void(u<i&&this.processQueue()))}},{key:"processQueue",value:function(){var e=this;if(console.log("process",this.queue),0===this.queue.length)return void(u=0);u++;var t=this.queue.shift();return fetch(t).then(function(r){return e.workerContext.postMessage({url:t,load:!0}),200!==r.status?e.workerContext.postMessage({error:"Unable to load resource with url "+t}):r.blob()}).then(function(e){return createImageBitmap(e)}).then(function(r){e.workerContext.postMessage({url:t,imageBitmap:r},[r])},function(t){e.workerContext.postMessage({error:t.toString()})}).then(function(){return e.processQueue()})["catch"](function(){return e.processQueue()})}}]),e}(),c=new s(self);self.onmessage=function(e){return c.enqueue(e.data)}},{}]},{},[1]);