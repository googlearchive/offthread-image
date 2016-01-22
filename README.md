# Offthread Image

A helper library that decodes images off-main thread using `createImageBitmap`
in a worker, and then transfers them back to the main thread and draws them into
a canvas.

**Status: 0.1.0-alpha**

## I would like to see it now, please!

Of course. Firstly you will need Chrome Canary, and you should switch on **"Enable experimental canvas features"** in about:flags. Then head to <a href="https://googlechrome.github.io/offthread-image/test">the test page</a>.

## Docs & Usage

If you want to create a single off-thread image, you can do so by instantiating
it as a wrapper around an existing element.

```javascript
let target = document.querySelector('.offthread-img');
let img = new OffthreadImage(target);
target.addEventListener('decoded', function () {
  // The image has been decoded... remove the spinner.
  target.classList.remove('spinner');
});
img.src = 'cat.png';
```

The element itself would look something like this:

```html
<div class="offthread-img" alt="A picture of a cat."></div>
```

However you can also add the `src` attribute to the element if you prefer:

```html
<div class="offthread-img" alt="A picture of a cat." src="cat.png"></div>
```

And now you no longer need to set the `src` in your JavaScript as the library will pick it up.

### Other attributes

In addition to setting `src` you can also set `width` and `height` attributes,
much as you would do with an `<img>` element.

Both `width` and `height` attributes are optional. If only one is provided, the
other is calculated based on the one provided, and the image will be drawn in
proportion. If both are provided they will be used as-is, which may cause distortion.

```html
<!-- Draw the cat image at 300px wide, auto height. -->
<div class="offthread-img" alt="A picture of a cat." src="cat.png" width="300"></div>

<!-- Draw the cat image at 210px high, auto width. -->
<div class="offthread-img" alt="A picture of a cat." src="cat.png" height="210"></div>

<!-- Draw the cat image at 410px wide, 210 high. -->
<div class="offthread-img" alt="A picture of a cat." src="cat.png" width="410" height="210"></div>
```

### Creating multiple OffthreadImages

`OffthreadImage` also provides a factory method to bootstrap many images at once. This is done by calling `createFromSelector()`:

```javascript
OffthreadImage.createFromSelector();
```

You don't need to provide a selector (it defaults to `'.offthread-img'`), but
you can pass one if you want to.

### Background Images

If you want to use an OffthreadImage as a background image, you can do that, too. Instead of setting `src` use `bg-src` instead. The canvas will then be sized to the parent element exactly:

```html
<div class="offthread-img bg" alt="A picture of a cat." bg-src="cat.png"></div>
```

If you use a background image, the styles of the target element will be inspected for the `background-size` style, though only `cover` and `contain` are supported right now:

```css
.bg {
  width: 400px;
  height: 320px;
  background-size: cover;
}
```

Finally, if you want to read through the API, you can <a href="https://googlechrome.github.io/offthread-image">check out the docs</a>.

## Support & Issues

The library depends on `createImageBitmap`, which is behind a flag in Chrome (`--enable-experimental-canvas-features`, or "Enable experimental canvas features" in chrome://flags).

Support is therefore currently for:

* Chrome 50+.
* Firefox 42+.

For other browsers there is no fallback provided, but there is an issue filed to do that.

There are other todos and missing features:

* Support `background-size` more completely.
* Support `background-position` more completely.
* Support `background-repeat`.

License: Apache 2.0 - See [/LICENSE](/LICENSE).

Author: paullewis.

Please note: this is not an official Google product.
