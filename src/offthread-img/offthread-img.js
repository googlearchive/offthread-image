/**
 * Copyright 2015 Google Inc. All rights reserved.
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

'use strict';

/**
 * A helper library that decodes images off-main thread using
 * <code>createImageBitmap</code> in a worker, and then transfers them back
 * to the main thread and draws them into a canvas.
 */
export default class OffthreadImage {

  /**
   * Gets the version number.
   *
   * @type {String}
   * @const
   */
  static get version () {
    return '@VERSION@';
  }

  /**
   * Factory method to create an array of <code>OffthreadImage</code>s based
   * on existing elements in the page.
   *
   * @static
   * @example
   *   let images = OffthreadImage.createFromSelector('.offthread-img');
   * @param  {String} [selector=".offthread-img"] - The selector for existing
   *   OffthreadImage elements in the page.
   * @return {Array} - An array of OffThreadImages.
   */
  static createFromSelector (selector = '.offthread-img') {
    let images = [];
    let candidates = document.querySelectorAll(selector);
    let candidate;
    for (let c = 0; c < candidates.length; c++) {
      candidate = candidates[c];
      images.push(new OffthreadImage(candidate));
    }
    return images;
  }

  /**
   * @typedef OffthreadImageStatus
   * @type Object
   * @property {String} INERT The OffthreadImage is inert; no src applied.
   * @property {String} LOAD_STARTED src applied; load has started.
   * @property {String} LOADED The image has loaded, but not been decoded.
   * @property {String} DECODED The image has been decoded, but not painted.
   * @property {String} PAINTED The image has been painted to a canvas element.
   */

  /**
   * The enumeration of status codes an OffthreadImage can have.
   *
   * @static
   * @type {OffthreadImageStatus}
   * @const
   */
  static get STATUS () {
    return {
      INERT: 'inert',
      LOAD_STARTED: 'loadstarted',
      LOADED: 'load',
      DECODED: 'decoded',
      PAINTED: 'painted'
    };
  }

  /**
   * The minimum amount of time, in milliseconds, that drawing the image should
   * take. It's guesstimated at 10ms, and the OffthreadImage will wait for an
   * idle callback (using <code>requestIdleCallback</code>) of that length.
   *
   * @static
   * @type {Number}
   * @const
   */
  static get MIN_INSERT_IDLE_WINDOW () {
    return 10;
  }

  /**
   * Detects if createImageBitmap is available for use in the current browser.
   *
   * @static
   * @type {boolean}
   * @const
   */
  static get available () {
    return ('createImageBitmap' in window);
  }

  /**
   * Creates a new OffthreadImage around an existing element.
   *
   * @example
   * let target = document.querySelector('.offthread-img');
   * let img = new OffthreadImage(target);
   * target.addEventListener('decoded', function () {
   *   // The image has been decoded... remove the spinner.
   *   target.classList.remove('spinner');
   * });
   * img.src = 'image.png';
   *
   * @param  {HTMLElement} element The target element to use.
   */
  constructor (element=null) {

    if (element === null)
      throw new Error ('OffthreadImage() requires a target element');

    this.id_ = Math.round(Math.random() * Number.MAX_SAFE_INTEGER).toString(16);
    this.canvas_ = null;
    this.ctx_ = null;
    this.element_ = element;
    this.onLoad_ = null;
    this.onDecode_ = null;
    this.status = OffthreadImage.STATUS.INERT;
    this.src_ = null;
    this.width_ = element.getAttribute('width');
    this.height_ = element.getAttribute('height');
    this.drawWidth_ = this.width_;
    this.drawHeight_ = this.height_;
    this.background_ = false;

    if (element.getAttribute('src')) {
      this.src = element.getAttribute('src');
    } else if (element.getAttribute('bg-src')) {
      this.src = element.getAttribute('bg-src');
      this.background_ = true;
    }

    if (!(element.getAttribute('alt') || element.getAttribute('aria-label')))
      console.warn('The element does have an alt or aria-label attribute.');
    else if (!element.getAttribute('aria-label'))
      element.setAttribute('aria-label', element.getAttribute('alt'));

    if (!element.getAttribute('role'))
      element.setAttribute('role', 'img');
  }

  /**
   * The source URL of the image.
   *
   * @property {String} - The image URL.
   */
  get src () {
    return this.src_;
  }

  set src (src_) {
    this.src_ = src_;
    this.status_ = OffthreadImage.STATUS.LOAD_STARTED;
    imgHandler.enqueue(this);
  }

  /**
   * Sets and gets the current status of the image
   *
   * @property {OffthreadImageStatus} - The image's status.
   */
  set status (status_) {

    switch (status_) {
      case OffthreadImage.STATUS.INERT:
      case OffthreadImage.STATUS.LOAD_STARTED:
      case OffthreadImage.STATUS.LOADED:
      case OffthreadImage.STATUS.DECODED:
      case OffthreadImage.STATUS.PAINTED:
        this.fire_(status_);
        break;

      default:
        throw new Error(`Unknown status: ${status_}`);
    }

    this.status_ = status_;
  }

  get status () {
    return this.status_;
  }

  /**
   * Sets the ImageBitmap on the canvas. The bitmap data is discarded
   * immediately after it has been drawn so as to keep memory usage down.
   * Therefore calling the <code>imageBitmap</code> getter will always return
   * null.
   *
   * @property {ImageBitmap} - The ImageBitmap data to draw to the canvas.
   */
  set imageBitmap (imageBitmap_) {

    let renderBitmapData = (deadline) => {

      // Make sure there is enough time to insert the image. Anything less than
      // the minimum window is unlikely to be enough, so hold reschedule if
      // needed.
      if (deadline.timeRemaining() < OffthreadImage.MIN_INSERT_IDLE_WINDOW)
        return requestIdleCallback(renderBitmapData);

      if (this.canvas_ === null) {
        this.canvas_ = document.createElement('canvas');
        this.canvas_.setAttribute('aria-hidden', 'true');
      }

      if (this.ctx_ === null)
        this.ctx_ = this.canvas_.getContext('2d');

      // Set the dimensions of the canvas.
      this.setCanvasDimensions_(imageBitmap_);
      this.ctx_.drawImage(imageBitmap_, 0, 0,
          this.drawWidth_, this.drawHeight_);

      this.element_.appendChild(this.canvas_);
      this.status = OffthreadImage.STATUS.PAINTED;
    }

    requestIdleCallback(renderBitmapData);
  }

  get imageBitmap () {
    return null;
  }

  /**
   * Sets the canvas's dimensions based on the ImageBitmap data provided.
   *
   * @private
   * @param {ImageBitmap} imageBitmap - The ImageBitmap to use for resizing the
   *   canvas (if necessary).
   */
  setCanvasDimensions_ (imageBitmap_) {

    if (this.background_) {
      // If this is a background image, default the canvas to the dimensions of
      // the container element.
      this.width_ = this.element_.offsetWidth;
      this.height_ = this.element_.offsetHeight;

      this.drawWidth_ = imageBitmap_.width;
      this.drawHeight_ = imageBitmap_.height;

      let backgroundSize =
          window.getComputedStyle(this.element_).backgroundSize;
      let ratio = 1;

      switch (backgroundSize) {

        case 'contain':
          ratio = Math.min(this.width_ / this.drawWidth_,
              this.height_ / this.drawHeight_);
          break;

        case 'cover':
          ratio = Math.max(this.width_ / this.drawWidth_,
              this.height_ / this.drawHeight_);
          break;

      }

      this.drawWidth_ *= ratio;
      this.drawHeight_ *= ratio;

    } else {

      // This is an inline image so now we need to account for it as such.
      // Firstly, if the width is set, but not the height, set the height based
      // on the width. And then do the same in reverse for height but not width
      // and finally default to whatever the image's natural dimensions were.
      if (this.width_ !== null && this.height_ === null) {
        this.height_ = this.width_ * (imageBitmap_.height / imageBitmap_.width);
      } else if (this.width_ === null && this.height_ !== null) {
        this.width_ = this.height_ * (imageBitmap_.width / imageBitmap_.height);
      } else if (this.width_ === null && this.height_ === null) {
        this.width_ = imageBitmap_.width;
        this.height_ = imageBitmap_.height;
      }

      this.width_ = parseInt(this.width_);
      this.height_ = parseInt(this.height_);

      this.drawWidth_ = this.width_;
      this.drawHeight_ = this.height_;
    }

    // Now resize the canvas appropriately.
    this.canvas_.width = this.width_;
    this.canvas_.height = this.height_;

  }

  /**
   * Fires an event on the element.
   *
   * @private
   * @param {String} eventName - The name of the event.
   * @param {} [detail=null] - The data to include in the event.
   * @param {Boolean} [bubbles=true] - Whether the event should bubble.
   * @param {Boolean} [cancelable=true] - Whether the event is cancelable.
   */
  fire_ (eventName, detail=null, bubbles=true, cancelable=true) {
    let evt = new CustomEvent(eventName, { detail, bubbles, cancelable });
    this.element_.dispatchEvent(evt);
  }

}

class OffthreadImageHandler {

  /**
   * The coordinator for all <code>OffthreadImage</code> instances. Spins up the
   * worker and has it enqueue image loads by URL. When an ImageBitmap is
   * returned from the worker it notifies all <code>OffthreadImage</code>s. It
   * is also responsible for setting the status of all
   * <code>OffthreadImage</code>s, i.e. loaded, decoded, etc.
   *
   * @private
   */
  constructor () {

    let currentScriptDir =
        this.getDirectoryName_(
          this.convertURLToAbsolute_(document.currentScript.src)
        );

    this.worker = new Worker(`${currentScriptDir}/offthread-img-worker.js`);
    this.worker.onmessage = (evt) => this.handleIncomingMessage_(evt.data);
    this.jobs = {};
  }

  /**
   * Enqueues an element, storing a reference to it against its URL. When the
   * worker returns the ImageBitmap data for the URL, it (and any other
   * elements) waiting for that ImageBitmap will be notified.
   *
   * @param  {OffthreadImage} offthreadImage - The OffthreadImage instance.
   */
  enqueue (offthreadImage) {
    if (!(offthreadImage instanceof OffthreadImage))
      throw new Error('Enqueue expects an OffthreadImage');

    // Ensure the URL is absolute.
    let src = this.convertURLToAbsolute_(offthreadImage.src);

    if (typeof this.jobs[src] === 'undefined')
      this.jobs[src] = [];

    this.jobs[src].push(offthreadImage);
    this.worker.postMessage(src);

    offthreadImage.status = OffthreadImage.STATUS.LOAD_STARTED;
  }

  /**
   * Gets the directory name from a URL.
   *
   * @private
   * @param  {String} url - The URL to start with.
   * @return {String} The URL excluding the basename.
   */
  getDirectoryName_ (url) {
    return url.replace(/[^\/]*$/, '');
  }

  /**
   * Converts a URL to an absolute one. This is to ensure that paths work based
   * on the current page's URL.
   *
   * @private
   * @param  {String} url - The URL to convert.
   * @return {String} - An absolute URL.
   */
  convertURLToAbsolute_ (url) {

    if (typeof url !== 'string')
      throw new Error ('convertURLToAbsolute_ expects a string');

    if (url.startsWith('http'))
      return url;
    else {
      let currentPath = this.getDirectoryName_(window.location.href);
      let absoluteURL = new URL(currentPath + url);
      return absoluteURL.toString();
    }
  }

  /**
   * Handles the incoming messages from the worker.
   *
   * @private
   * @param  {Object} message - The message from the worker.
   */
  handleIncomingMessage_ (message) {

    if (message.error) {
      return console.warn(message.error);
    }

    let url = message.url;
    let elements = this.jobs[url];
    let element;

    if (message.load) {
      for (let e = 0; e < elements.length; e++) {
        element = elements[e];
        element.status = OffthreadImage.STATUS.LOADED;
      }
      return;
    }

    let imageBitmap = message.imageBitmap;

    for (let e = 0; e < elements.length; e++) {
      element = elements[e];
      element.status = OffthreadImage.STATUS.DECODED;
      element.imageBitmap = imageBitmap;
    }

    // These elements no longer need updating, so purge the list.
    this.jobs[url].length = 0;
  }
}

let imgHandler = new OffthreadImageHandler();
