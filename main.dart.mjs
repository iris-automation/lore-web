// Compiles a dart2wasm-generated main module from `source` which can then
// instantiatable via the `instantiate` method.
//
// `source` needs to be a `Response` object (or promise thereof) e.g. created
// via the `fetch()` JS API.
export async function compileStreaming(source) {
  const builtins = {builtins: ['js-string']};
  return new CompiledApp(
      await WebAssembly.compileStreaming(source, builtins), builtins);
}

// Compiles a dart2wasm-generated wasm modules from `bytes` which is then
// instantiatable via the `instantiate` method.
export async function compile(bytes) {
  const builtins = {builtins: ['js-string']};
  return new CompiledApp(await WebAssembly.compile(bytes, builtins), builtins);
}

// DEPRECATED: Please use `compile` or `compileStreaming` to get a compiled app,
// use `instantiate` method to get an instantiated app and then call
// `invokeMain` to invoke the main function.
export async function instantiate(modulePromise, importObjectPromise) {
  var moduleOrCompiledApp = await modulePromise;
  if (!(moduleOrCompiledApp instanceof CompiledApp)) {
    moduleOrCompiledApp = new CompiledApp(moduleOrCompiledApp);
  }
  const instantiatedApp = await moduleOrCompiledApp.instantiate(await importObjectPromise);
  return instantiatedApp.instantiatedModule;
}

// DEPRECATED: Please use `compile` or `compileStreaming` to get a compiled app,
// use `instantiate` method to get an instantiated app and then call
// `invokeMain` to invoke the main function.
export const invoke = (moduleInstance, ...args) => {
  moduleInstance.exports.$invokeMain(args);
}

class CompiledApp {
  constructor(module, builtins) {
    this.module = module;
    this.builtins = builtins;
  }

  // The second argument is an options object containing:
  // `loadDeferredModules` is a JS function that takes an array of module names
  //   matching wasm files produced by the dart2wasm compiler. It also takes a
  //   callback that should be invoked for each loaded module with 2 arugments:
  //   (1) the module name, (2) the loaded module in a format supported by
  //   `WebAssembly.compile` or `WebAssembly.compileStreaming`. The callback
  //   returns a Promise that resolves when the module is instantiated.
  //   loadDeferredModules should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  // `loadDeferredId` is a JS function that takes load ID produced by the
  //   compiler when the `load-ids` option is passed. Each load ID maps to one
  //   or more wasm files as specified in the emitted JSON file. It also takes a
  //   callback that should be invoked for each loaded module with 2 arugments:
  //   (1) the module name, (2) the loaded module in a format supported by
  //   `WebAssembly.compile` or `WebAssembly.compileStreaming`. The callback
  //   returns a Promise that resolves when the module is instantiated.
  //   loadDeferredModules should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  // `loadDynamicModule` is a JS function that takes two string names matching,
  //   in order, a wasm file produced by the dart2wasm compiler during dynamic
  //   module compilation and a corresponding js file produced by the same
  //   compilation. It also takes a callback that should be invoked with the
  //   loaded module in a format supported by `WebAssembly.compile` or
  //   `WebAssembly.compileStreaming` and the result of using the JS 'import'
  //   API on the js file path. It should return a Promise that resolves when
  //   all the modules have been loaded and the callback promises have resolved.
  async instantiate(additionalImports,
      {loadDeferredModules, loadDynamicModule, loadDeferredId} = {}) {
    let dartInstance;

    // Prints to the console
    function printToConsole(value) {
      if (typeof dartPrint == "function") {
        dartPrint(value);
        return;
      }
      if (typeof console == "object" && typeof console.log != "undefined") {
        console.log(value);
        return;
      }
      if (typeof print == "function") {
        print(value);
        return;
      }

      throw "Unable to print message: " + value;
    }

    // A special symbol attached to functions that wrap Dart functions.
    const jsWrappedDartFunctionSymbol = Symbol("JSWrappedDartFunction");

    function finalizeWrapper(dartFunction, wrapped) {
      wrapped.dartFunction = dartFunction;
      wrapped[jsWrappedDartFunctionSymbol] = true;
      return wrapped;
    }

    // Imports
    const dart2wasm = {
            _1: (decoder, codeUnits) => decoder.decode(codeUnits),
      _2: () => new TextDecoder("utf-8", {fatal: true}),
      _3: () => new TextDecoder("utf-8", {fatal: false}),
      _4: (s) => +s,
      _5: x0 => new Uint8Array(x0),
      _6: (x0,x1,x2) => x0.set(x1,x2),
      _7: (x0,x1) => x0.transferFromImageBitmap(x1),
      _8: x0 => x0.arrayBuffer(),
      _9: (x0,x1,x2) => x0.slice(x1,x2),
      _10: (x0,x1) => x0.decode(x1),
      _11: (x0,x1) => x0.segment(x1),
      _12: () => new TextDecoder(),
      _14: x0 => x0.buffer,
      _15: x0 => x0.wasmMemory,
      _16: () => globalThis.window._flutter_skwasmInstance,
      _17: x0 => x0.rasterStartMilliseconds,
      _18: x0 => x0.rasterEndMilliseconds,
      _19: x0 => x0.imageBitmaps,
      _135: (x0,x1) => x0.appendChild(x1),
      _166: (x0,x1,x2) => x0.addEventListener(x1,x2),
      _167: (x0,x1,x2) => x0.removeEventListener(x1,x2),
      _168: (x0,x1) => new OffscreenCanvas(x0,x1),
      _169: x0 => x0.remove(),
      _170: (x0,x1) => x0.append(x1),
      _172: x0 => x0.unlock(),
      _173: x0 => x0.getReader(),
      _174: (x0,x1) => x0.item(x1),
      _175: x0 => x0.next(),
      _176: x0 => x0.now(),
      _177: (x0,x1) => x0.revokeObjectURL(x1),
      _178: x0 => x0.close(),
      _179: (x0,x1,x2,x3,x4) => ({type: x0,data: x1,premultiplyAlpha: x2,colorSpaceConversion: x3,preferAnimation: x4}),
      _180: x0 => new window.ImageDecoder(x0),
      _181: (x0,x1) => ({frameIndex: x0,completeFramesOnly: x1}),
      _182: (x0,x1) => x0.decode(x1),
      _183: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._183(f,arguments.length,x0) }),
      _184: (x0,x1,x2,x3) => x0.addEventListener(x1,x2,x3),
      _186: (x0,x1) => x0.getModifierState(x1),
      _187: x0 => x0.preventDefault(),
      _188: x0 => x0.stopPropagation(),
      _189: (x0,x1) => x0.removeProperty(x1),
      _190: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._190(f,arguments.length,x0) }),
      _191: x0 => new window.FinalizationRegistry(x0),
      _192: (x0,x1,x2,x3) => x0.register(x1,x2,x3),
      _194: (x0,x1) => x0.unregister(x1),
      _195: (x0,x1) => x0.prepend(x1),
      _196: x0 => new Intl.Locale(x0),
      _197: (x0,x1) => x0.observe(x1),
      _198: x0 => x0.disconnect(),
      _199: (x0,x1) => x0.getAttribute(x1),
      _200: (x0,x1) => x0.contains(x1),
      _201: (x0,x1) => x0.querySelector(x1),
      _202: (x0,x1) => x0.matchMedia(x1),
      _203: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._203(f,arguments.length,x0) }),
      _204: (x0,x1,x2) => x0.call(x1,x2),
      _205: x0 => x0.blur(),
      _206: x0 => x0.hasFocus(),
      _207: (x0,x1) => x0.removeAttribute(x1),
      _208: (x0,x1,x2) => x0.insertBefore(x1,x2),
      _209: (x0,x1) => x0.hasAttribute(x1),
      _210: (x0,x1) => x0.getModifierState(x1),
      _211: (x0,x1) => x0.createTextNode(x1),
      _212: x0 => x0.getBoundingClientRect(),
      _213: (x0,x1) => x0.replaceWith(x1),
      _214: (x0,x1) => x0.contains(x1),
      _215: (x0,x1) => x0.closest(x1),
      _216: () => new Array(),
      _653: x0 => new Uint8Array(x0),
      _656: () => globalThis.window.flutterConfiguration,
      _658: x0 => x0.assetBase,
      _663: x0 => x0.canvasKitMaximumSurfaces,
      _664: x0 => x0.debugShowSemanticsNodes,
      _665: x0 => x0.hostElement,
      _666: x0 => x0.multiViewEnabled,
      _667: x0 => x0.nonce,
      _669: x0 => x0.fontFallbackBaseUrl,
      _679: x0 => x0.console,
      _680: x0 => x0.devicePixelRatio,
      _681: x0 => x0.document,
      _682: x0 => x0.history,
      _683: x0 => x0.innerHeight,
      _684: x0 => x0.innerWidth,
      _685: x0 => x0.location,
      _686: x0 => x0.navigator,
      _687: x0 => x0.visualViewport,
      _688: x0 => x0.performance,
      _689: x0 => x0.parent,
      _691: x0 => x0.URL,
      _693: (x0,x1) => x0.getComputedStyle(x1),
      _694: x0 => x0.screen,
      _695: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._695(f,arguments.length,x0) }),
      _696: (x0,x1) => x0.requestAnimationFrame(x1),
      _700: (x0,x1) => x0.warn(x1),
      _703: x0 => globalThis.parseFloat(x0),
      _704: () => globalThis.window,
      _705: () => globalThis.Intl,
      _706: () => globalThis.Symbol,
      _707: (x0,x1,x2,x3,x4) => globalThis.createImageBitmap(x0,x1,x2,x3,x4),
      _709: x0 => x0.clipboard,
      _710: x0 => x0.maxTouchPoints,
      _711: x0 => x0.vendor,
      _712: x0 => x0.language,
      _713: x0 => x0.platform,
      _714: x0 => x0.userAgent,
      _715: (x0,x1) => x0.vibrate(x1),
      _716: x0 => x0.languages,
      _717: x0 => x0.documentElement,
      _718: (x0,x1) => x0.querySelector(x1),
      _719: (x0,x1) => x0.querySelectorAll(x1),
      _721: (x0,x1) => x0.createElement(x1),
      _724: (x0,x1) => x0.createEvent(x1),
      _725: x0 => x0.activeElement,
      _728: x0 => x0.head,
      _729: x0 => x0.body,
      _731: (x0,x1) => { x0.title = x1 },
      _734: x0 => x0.visibilityState,
      _735: () => globalThis.document,
      _736: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._736(f,arguments.length,x0) }),
      _737: (x0,x1) => x0.dispatchEvent(x1),
      _745: x0 => x0.target,
      _747: x0 => x0.timeStamp,
      _748: x0 => x0.type,
      _750: (x0,x1,x2,x3) => x0.initEvent(x1,x2,x3),
      _757: x0 => x0.firstChild,
      _761: x0 => x0.parentElement,
      _763: (x0,x1) => { x0.textContent = x1 },
      _764: x0 => x0.parentNode,
      _766: (x0,x1) => x0.removeChild(x1),
      _767: x0 => x0.isConnected,
      _775: x0 => x0.clientHeight,
      _776: x0 => x0.clientWidth,
      _777: x0 => x0.offsetHeight,
      _778: x0 => x0.offsetWidth,
      _779: x0 => x0.id,
      _780: (x0,x1) => { x0.id = x1 },
      _783: (x0,x1) => { x0.spellcheck = x1 },
      _784: x0 => x0.tagName,
      _785: x0 => x0.style,
      _787: (x0,x1) => x0.querySelectorAll(x1),
      _788: (x0,x1,x2) => x0.setAttribute(x1,x2),
      _789: x0 => x0.tabIndex,
      _790: (x0,x1) => { x0.tabIndex = x1 },
      _791: (x0,x1) => x0.focus(x1),
      _792: x0 => x0.scrollTop,
      _793: (x0,x1) => { x0.scrollTop = x1 },
      _794: (x0,x1) => { x0.scrollLeft = x1 },
      _795: x0 => x0.scrollLeft,
      _796: x0 => x0.classList,
      _797: (x0,x1) => x0.scrollIntoView(x1),
      _800: (x0,x1) => { x0.className = x1 },
      _802: (x0,x1) => x0.getElementsByClassName(x1),
      _803: x0 => x0.click(),
      _804: (x0,x1) => x0.attachShadow(x1),
      _807: x0 => x0.computedStyleMap(),
      _808: (x0,x1) => x0.get(x1),
      _814: (x0,x1) => x0.getPropertyValue(x1),
      _815: (x0,x1,x2,x3) => x0.setProperty(x1,x2,x3),
      _816: x0 => x0.offsetLeft,
      _817: x0 => x0.offsetTop,
      _818: x0 => x0.offsetParent,
      _820: (x0,x1) => { x0.name = x1 },
      _821: x0 => x0.content,
      _822: (x0,x1) => { x0.content = x1 },
      _826: (x0,x1) => { x0.src = x1 },
      _827: x0 => x0.naturalWidth,
      _828: x0 => x0.naturalHeight,
      _832: (x0,x1) => { x0.crossOrigin = x1 },
      _834: (x0,x1) => { x0.decoding = x1 },
      _835: x0 => x0.decode(),
      _840: (x0,x1) => { x0.nonce = x1 },
      _845: (x0,x1) => { x0.width = x1 },
      _847: (x0,x1) => { x0.height = x1 },
      _850: (x0,x1) => x0.getContext(x1),
      _918: x0 => x0.width,
      _919: x0 => x0.height,
      _921: (x0,x1) => x0.fetch(x1),
      _922: x0 => x0.status,
      _924: x0 => x0.body,
      _925: x0 => x0.arrayBuffer(),
      _928: x0 => x0.read(),
      _929: x0 => x0.value,
      _930: x0 => x0.done,
      _937: x0 => x0.name,
      _938: x0 => x0.x,
      _939: x0 => x0.y,
      _942: x0 => x0.top,
      _943: x0 => x0.right,
      _944: x0 => x0.bottom,
      _945: x0 => x0.left,
      _955: x0 => x0.height,
      _956: x0 => x0.width,
      _957: x0 => x0.scale,
      _958: (x0,x1) => { x0.value = x1 },
      _961: (x0,x1) => { x0.placeholder = x1 },
      _963: (x0,x1) => { x0.name = x1 },
      _964: x0 => x0.selectionDirection,
      _965: x0 => x0.selectionStart,
      _966: x0 => x0.selectionEnd,
      _969: x0 => x0.value,
      _971: (x0,x1,x2) => x0.setSelectionRange(x1,x2),
      _972: x0 => x0.readText(),
      _973: (x0,x1) => x0.writeText(x1),
      _975: x0 => x0.altKey,
      _976: x0 => x0.code,
      _977: x0 => x0.ctrlKey,
      _978: x0 => x0.key,
      _979: x0 => x0.keyCode,
      _980: x0 => x0.location,
      _981: x0 => x0.metaKey,
      _982: x0 => x0.repeat,
      _983: x0 => x0.shiftKey,
      _984: x0 => x0.isComposing,
      _986: x0 => x0.state,
      _987: (x0,x1) => x0.go(x1),
      _989: (x0,x1,x2,x3) => x0.pushState(x1,x2,x3),
      _990: (x0,x1,x2,x3) => x0.replaceState(x1,x2,x3),
      _991: x0 => x0.pathname,
      _992: x0 => x0.search,
      _993: x0 => x0.hash,
      _997: x0 => x0.state,
      _1000: (x0,x1) => x0.createObjectURL(x1),
      _1002: x0 => new Blob(x0),
      _1012: x0 => x0.matches,
      _1016: x0 => x0.matches,
      _1020: x0 => x0.relatedTarget,
      _1022: x0 => x0.clientX,
      _1023: x0 => x0.clientY,
      _1024: x0 => x0.offsetX,
      _1025: x0 => x0.offsetY,
      _1028: x0 => x0.button,
      _1029: x0 => x0.buttons,
      _1030: x0 => x0.ctrlKey,
      _1034: x0 => x0.pointerId,
      _1035: x0 => x0.pointerType,
      _1036: x0 => x0.pressure,
      _1037: x0 => x0.tiltX,
      _1038: x0 => x0.tiltY,
      _1039: x0 => x0.getCoalescedEvents(),
      _1042: x0 => x0.deltaX,
      _1043: x0 => x0.deltaY,
      _1044: x0 => x0.wheelDeltaX,
      _1045: x0 => x0.wheelDeltaY,
      _1046: x0 => x0.deltaMode,
      _1053: x0 => x0.changedTouches,
      _1056: x0 => x0.clientX,
      _1057: x0 => x0.clientY,
      _1060: x0 => x0.data,
      _1063: (x0,x1) => { x0.disabled = x1 },
      _1065: (x0,x1) => { x0.type = x1 },
      _1066: (x0,x1) => { x0.max = x1 },
      _1067: (x0,x1) => { x0.min = x1 },
      _1068: x0 => x0.value,
      _1069: (x0,x1) => { x0.value = x1 },
      _1070: x0 => x0.disabled,
      _1071: (x0,x1) => { x0.disabled = x1 },
      _1073: (x0,x1) => { x0.placeholder = x1 },
      _1075: (x0,x1) => { x0.name = x1 },
      _1076: (x0,x1) => { x0.autocomplete = x1 },
      _1078: x0 => x0.selectionDirection,
      _1079: x0 => x0.selectionStart,
      _1081: x0 => x0.selectionEnd,
      _1084: (x0,x1,x2) => x0.setSelectionRange(x1,x2),
      _1085: (x0,x1) => x0.add(x1),
      _1087: (x0,x1) => { x0.noValidate = x1 },
      _1088: (x0,x1) => { x0.method = x1 },
      _1089: (x0,x1) => { x0.action = x1 },
      _1095: (x0,x1) => x0.getContext(x1),
      _1097: x0 => x0.convertToBlob(),
      _1114: x0 => x0.orientation,
      _1115: x0 => x0.width,
      _1116: x0 => x0.height,
      _1117: (x0,x1) => x0.lock(x1),
      _1136: x0 => new ResizeObserver(x0),
      _1139: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1139(f,arguments.length,x0,x1) }),
      _1147: x0 => x0.length,
      _1148: x0 => x0.iterator,
      _1149: x0 => x0.Segmenter,
      _1150: x0 => x0.v8BreakIterator,
      _1151: (x0,x1) => new Intl.Segmenter(x0,x1),
      _1154: x0 => x0.language,
      _1155: x0 => x0.script,
      _1156: x0 => x0.region,
      _1174: x0 => x0.done,
      _1175: x0 => x0.value,
      _1176: x0 => x0.index,
      _1180: (x0,x1) => new Intl.v8BreakIterator(x0,x1),
      _1181: (x0,x1) => x0.adoptText(x1),
      _1182: x0 => x0.first(),
      _1183: x0 => x0.next(),
      _1184: x0 => x0.current(),
      _1186: () => globalThis.window.FinalizationRegistry,
      _1197: x0 => x0.hostElement,
      _1198: x0 => x0.viewConstraints,
      _1201: x0 => x0.maxHeight,
      _1202: x0 => x0.maxWidth,
      _1203: x0 => x0.minHeight,
      _1204: x0 => x0.minWidth,
      _1205: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1205(f,arguments.length,x0) }),
      _1206: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1206(f,arguments.length,x0) }),
      _1207: (x0,x1) => ({addView: x0,removeView: x1}),
      _1210: x0 => x0.loader,
      _1211: () => globalThis._flutter,
      _1212: (x0,x1) => x0.didCreateEngineInitializer(x1),
      _1213: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1213(f,arguments.length,x0) }),
      _1214: (module,f) => finalizeWrapper(f, function() { return module.exports._1214(f,arguments.length) }),
      _1215: (x0,x1) => ({initializeEngine: x0,autoStart: x1}),
      _1218: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1218(f,arguments.length,x0) }),
      _1219: x0 => ({runApp: x0}),
      _1221: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1221(f,arguments.length,x0,x1) }),
      _1222: x0 => new Promise(x0),
      _1223: x0 => x0.length,
      _1224: () => globalThis.window.ImageDecoder,
      _1225: x0 => x0.tracks,
      _1227: x0 => x0.completed,
      _1229: x0 => x0.image,
      _1235: x0 => x0.displayWidth,
      _1236: x0 => x0.displayHeight,
      _1237: x0 => x0.duration,
      _1240: x0 => x0.ready,
      _1241: x0 => x0.selectedTrack,
      _1242: x0 => x0.repetitionCount,
      _1243: x0 => x0.frameCount,
      _1298: (x0,x1,x2,x3) => x0.addEventListener(x1,x2,x3),
      _1299: (x0,x1,x2,x3) => x0.removeEventListener(x1,x2,x3),
      _1300: (x0,x1) => x0.createElement(x1),
      _1301: (x0,x1,x2) => x0.setAttribute(x1,x2),
      _1303: (x0,x1) => x0.getAttribute(x1),
      _1307: (x0,x1,x2,x3) => x0.open(x1,x2,x3),
      _1309: (x0,x1) => x0.canShare(x1),
      _1310: (x0,x1) => x0.share(x1),
      _1312: x0 => ({text: x0}),
      _1314: (x0,x1) => ({files: x0,text: x1}),
      _1316: x0 => ({files: x0}),
      _1317: x0 => x0.click(),
      _1318: x0 => x0.remove(),
      _1319: () => ({}),
      _1320: (x0,x1,x2) => new File(x0,x1,x2),
      _1323: () => globalThis.AppleID.auth.signIn(),
      _1331: x0 => x0.authorization,
      _1332: x0 => x0.user,
      _1333: x0 => x0.error,
      _1335: x0 => x0.code,
      _1336: x0 => x0.id_token,
      _1337: x0 => x0.state,
      _1338: x0 => x0.email,
      _1339: x0 => x0.name,
      _1340: x0 => x0.firstName,
      _1341: x0 => x0.lastName,
      _1342: x0 => globalThis.URL.revokeObjectURL(x0),
      _1343: (x0,x1,x2,x3) => x0.drawImage(x1,x2,x3),
      _1344: (x0,x1,x2,x3,x4,x5) => x0.drawImage(x1,x2,x3,x4,x5),
      _1345: x0 => globalThis.URL.createObjectURL(x0),
      _1346: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1346(f,arguments.length,x0) }),
      _1347: (x0,x1,x2,x3) => x0.toBlob(x1,x2,x3),
      _1348: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1348(f,arguments.length,x0) }),
      _1349: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1349(f,arguments.length,x0) }),
      _1350: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1350(f,arguments.length,x0) }),
      _1351: (x0,x1) => x0.querySelector(x1),
      _1352: (x0,x1) => x0.append(x1),
      _1353: (x0,x1) => x0.replaceChildren(x1),
      _1363: (x0,x1) => x0.item(x1),
      _1371: (x0,x1) => x0.query(x1),
      _1372: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1372(f,arguments.length,x0) }),
      _1373: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1373(f,arguments.length,x0) }),
      _1374: (x0,x1,x2) => ({enableHighAccuracy: x0,timeout: x1,maximumAge: x2}),
      _1375: (x0,x1,x2,x3) => x0.getCurrentPosition(x1,x2,x3),
      _1380: (x0,x1) => x0.item(x1),
      _1381: () => new FileReader(),
      _1383: (x0,x1) => x0.readAsArrayBuffer(x1),
      _1384: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1384(f,arguments.length,x0) }),
      _1385: (x0,x1,x2) => x0.removeEventListener(x1,x2),
      _1386: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1386(f,arguments.length,x0) }),
      _1387: (x0,x1,x2) => x0.addEventListener(x1,x2),
      _1388: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1388(f,arguments.length,x0) }),
      _1389: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1389(f,arguments.length,x0) }),
      _1390: (x0,x1) => x0.removeChild(x1),
      _1392: () => globalThis.Intl.DateTimeFormat(),
      _1393: x0 => x0.resolvedOptions(),
      _1394: x0 => globalThis.Intl.supportedValuesOf(x0),
      _1395: x0 => x0.timeZone,
      _1397: (x0,x1) => x0.initialize(x1),
      _1402: Date.now,
      _1404: s => new Date(s * 1000).getTimezoneOffset() * 60,
      _1405: s => {
        if (!/^\s*[+-]?(?:Infinity|NaN|(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?)\s*$/.test(s)) {
          return NaN;
        }
        return parseFloat(s);
      },
      _1406: () => typeof dartUseDateNowForTicks !== "undefined",
      _1407: () => 1000 * performance.now(),
      _1408: () => Date.now(),
      _1409: () => {
        // On browsers return `globalThis.location.href`
        if (globalThis.location != null) {
          return globalThis.location.href;
        }
        return null;
      },
      _1410: () => {
        return typeof process != "undefined" &&
               Object.prototype.toString.call(process) == "[object process]" &&
               process.platform == "win32"
      },
      _1411: () => new WeakMap(),
      _1412: (map, o) => map.get(o),
      _1413: (map, o, v) => map.set(o, v),
      _1414: x0 => new WeakRef(x0),
      _1415: x0 => x0.deref(),
      _1416: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1416(f,arguments.length,x0) }),
      _1417: x0 => new FinalizationRegistry(x0),
      _1418: (x0,x1,x2,x3) => x0.register(x1,x2,x3),
      _1420: (x0,x1) => x0.unregister(x1),
      _1422: () => globalThis.WeakRef,
      _1423: () => globalThis.FinalizationRegistry,
      _1425: x0 => x0.call(),
      _1426: s => JSON.stringify(s),
      _1427: s => printToConsole(s),
      _1428: o => {
        if (o === null || o === undefined) return 0;
        if (typeof(o) === 'string') return 1;
        return 2;
      },
      _1429: (o, p, r) => o.replaceAll(p, () => r),
      _1430: (o, p, r) => o.replace(p, () => r),
      _1431: Function.prototype.call.bind(String.prototype.toLowerCase),
      _1432: s => s.toUpperCase(),
      _1433: s => s.trim(),
      _1434: s => s.trimLeft(),
      _1435: s => s.trimRight(),
      _1436: (string, times) => string.repeat(times),
      _1437: Function.prototype.call.bind(String.prototype.indexOf),
      _1438: (s, p, i) => s.lastIndexOf(p, i),
      _1439: (string, token) => string.split(token),
      _1440: Object.is,
      _1444: (o, t) => typeof o === t,
      _1445: (o, c) => o instanceof c,
      _1446: o => Object.keys(o),
      _1450: (o, a) => o + a,
      _1460: (o, a) => o == a,
      _1479: (x0,x1) => x0.call(x1),
      _1500: x0 => new Array(x0),
      _1502: x0 => x0.length,
      _1504: (x0,x1) => x0[x1],
      _1505: (x0,x1,x2) => { x0[x1] = x2 },
      _1508: (x0,x1,x2) => new DataView(x0,x1,x2),
      _1510: x0 => new Int8Array(x0),
      _1511: (x0,x1,x2) => new Uint8Array(x0,x1,x2),
      _1513: x0 => new Uint8ClampedArray(x0),
      _1515: x0 => new Int16Array(x0),
      _1517: x0 => new Uint16Array(x0),
      _1519: x0 => new Int32Array(x0),
      _1521: x0 => new Uint32Array(x0),
      _1523: x0 => new Float32Array(x0),
      _1525: x0 => new Float64Array(x0),
      _1549: x0 => x0.random(),
      _1550: (x0,x1) => x0.getRandomValues(x1),
      _1551: () => globalThis.crypto,
      _1552: () => globalThis.Math,
      _1565: (ms, c) =>
      setTimeout(() => dartInstance.exports.$invokeCallback(c),ms),
      _1566: (handle) => clearTimeout(handle),
      _1567: (ms, c) =>
      setInterval(() => dartInstance.exports.$invokeCallback(c), ms),
      _1568: (handle) => clearInterval(handle),
      _1569: (c) =>
      queueMicrotask(() => dartInstance.exports.$invokeCallback(c)),
      _1570: () => Date.now(),
      _1571: () => new Error().stack,
      _1572: (exn) => {
        let stackString = exn.toString();
        let frames = stackString.split('\n');
        let drop = 4;
        if (frames[0].startsWith('Error')) {
            drop += 1;
        }
        return frames.slice(drop).join('\n');
      },
      _1573: (s, m) => {
        try {
          return new RegExp(s, m);
        } catch (e) {
          return String(e);
        }
      },
      _1574: (x0,x1) => x0.exec(x1),
      _1575: (x0,x1) => x0.test(x1),
      _1576: x0 => x0.pop(),
      _1578: o => o === undefined,
      _1580: o => typeof o === 'function' && o[jsWrappedDartFunctionSymbol] === true,
      _1582: o => {
        const proto = Object.getPrototypeOf(o);
        return proto === Object.prototype || proto === null;
      },
      _1583: o => o instanceof RegExp,
      _1584: (l, r) => l === r,
      _1585: o => o,
      _1586: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'number') return 1;
        return 2;
      },
      _1587: o => o,
      _1588: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'boolean') return 1;
        return 2;
      },
      _1589: o => o,
      _1590: b => !!b,
      _1591: o => o.length,
      _1593: (o, i) => o[i],
      _1594: f => f.dartFunction,
      _1595: () => ({}),
      _1596: () => [],
      _1598: () => globalThis,
      _1599: (constructor, args) => {
        const factoryFunction = constructor.bind.apply(
            constructor, [null, ...args]);
        return new factoryFunction();
      },
      _1600: (o, p) => p in o,
      _1601: (o, p) => o[p],
      _1602: (o, p, v) => o[p] = v,
      _1603: (o, m, a) => o[m].apply(o, a),
      _1605: o => String(o),
      _1606: (p, s, f) => p.then(s, (e) => f(e, e === undefined)),
      _1607: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1607(f,arguments.length,x0) }),
      _1608: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1608(f,arguments.length,x0,x1) }),
      _1609: o => {
        if (o === undefined) return 1;
        var type = typeof o;
        if (type === 'boolean') return 2;
        if (type === 'number') return 3;
        if (type === 'string') return 4;
        if (o instanceof Array) return 5;
        if (ArrayBuffer.isView(o)) {
          if (o instanceof Int8Array) return 6;
          if (o instanceof Uint8Array) return 7;
          if (o instanceof Uint8ClampedArray) return 8;
          if (o instanceof Int16Array) return 9;
          if (o instanceof Uint16Array) return 10;
          if (o instanceof Int32Array) return 11;
          if (o instanceof Uint32Array) return 12;
          if (o instanceof Float32Array) return 13;
          if (o instanceof Float64Array) return 14;
          if (o instanceof DataView) return 15;
        }
        if (o instanceof ArrayBuffer) return 16;
        // Feature check for `SharedArrayBuffer` before doing a type-check.
        if (globalThis.SharedArrayBuffer !== undefined &&
            o instanceof SharedArrayBuffer) {
            return 17;
        }
        if (o instanceof Promise) return 18;
        return 19;
      },
      _1610: o => [o],
      _1611: (o0, o1) => [o0, o1],
      _1612: (o0, o1, o2) => [o0, o1, o2],
      _1613: (o0, o1, o2, o3) => [o0, o1, o2, o3],
      _1614: (exn) => {
        if (exn instanceof Error) {
          return exn.stack;
        } else {
          return null;
        }
      },
      _1615: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmI8ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      _1616: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmI8ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      _1619: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmI32ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      _1620: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmI32ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      _1621: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmF32ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      _1622: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmF32ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      _1623: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmF64ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      _1624: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmF64ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      _1625: x0 => new ArrayBuffer(x0),
      _1626: s => {
        if (/[[\]{}()*+?.\\^$|]/.test(s)) {
            s = s.replace(/[[\]{}()*+?.\\^$|]/g, '\\$&');
        }
        return s;
      },
      _1628: x0 => x0.index,
      _1629: x0 => x0.groups,
      _1630: x0 => x0.flags,
      _1631: x0 => x0.multiline,
      _1632: x0 => x0.ignoreCase,
      _1633: x0 => x0.unicode,
      _1634: x0 => x0.dotAll,
      _1635: (x0,x1) => { x0.lastIndex = x1 },
      _1636: (o, p) => p in o,
      _1637: (o, p) => o[p],
      _1638: (o, p, v) => o[p] = v,
      _1640: x0 => x0.exports,
      _1641: (x0,x1) => globalThis.WebAssembly.instantiateStreaming(x0,x1),
      _1642: x0 => x0.instance,
      _1644: x0 => new WebAssembly.Memory(x0),
      _1645: x0 => x0.buffer,
      _1648: x0 => x0.arrayBuffer(),
      _1650: x0 => x0.sqlite3_initialize,
      _1652: (x0,x1,x2,x3,x4) => x0.sqlite3_open_v2(x1,x2,x3,x4),
      _1653: (x0,x1) => x0.sqlite3_close_v2(x1),
      _1654: (x0,x1,x2) => x0.sqlite3_extended_result_codes(x1,x2),
      _1655: (x0,x1) => x0.sqlite3_extended_errcode(x1),
      _1656: (x0,x1) => x0.sqlite3_errmsg(x1),
      _1657: (x0,x1) => x0.sqlite3_errstr(x1),
      _1658: x0 => x0.sqlite3_error_offset,
      _1662: (x0,x1) => x0.sqlite3_last_insert_rowid(x1),
      _1663: (x0,x1) => x0.sqlite3_changes(x1),
      _1664: (x0,x1,x2,x3,x4,x5) => x0.sqlite3_exec(x1,x2,x3,x4,x5),
      _1667: (x0,x1,x2,x3,x4,x5,x6) => x0.sqlite3_prepare_v3(x1,x2,x3,x4,x5,x6),
      _1668: (x0,x1) => x0.sqlite3_finalize(x1),
      _1669: (x0,x1) => x0.sqlite3_step(x1),
      _1670: (x0,x1) => x0.sqlite3_reset(x1),
      _1671: (x0,x1) => x0.sqlite3_stmt_isexplain(x1),
      _1673: (x0,x1) => x0.sqlite3_column_count(x1),
      _1674: (x0,x1) => x0.sqlite3_bind_parameter_count(x1),
      _1676: (x0,x1,x2) => x0.sqlite3_column_name(x1,x2),
      _1677: (x0,x1,x2,x3,x4,x5) => x0.sqlite3_bind_blob64(x1,x2,x3,x4,x5),
      _1678: (x0,x1,x2,x3) => x0.sqlite3_bind_double(x1,x2,x3),
      _1679: (x0,x1,x2,x3) => x0.sqlite3_bind_int64(x1,x2,x3),
      _1680: (x0,x1,x2) => x0.sqlite3_bind_null(x1,x2),
      _1681: (x0,x1,x2,x3,x4,x5) => x0.sqlite3_bind_text(x1,x2,x3,x4,x5),
      _1682: (x0,x1,x2) => x0.sqlite3_column_blob(x1,x2),
      _1683: (x0,x1,x2) => x0.sqlite3_column_double(x1,x2),
      _1684: (x0,x1,x2) => x0.sqlite3_column_int64(x1,x2),
      _1685: (x0,x1,x2) => x0.sqlite3_column_text(x1,x2),
      _1686: (x0,x1,x2) => x0.sqlite3_column_bytes(x1,x2),
      _1687: (x0,x1,x2) => x0.sqlite3_column_type(x1,x2),
      _1688: (x0,x1) => x0.sqlite3_value_blob(x1),
      _1689: (x0,x1) => x0.sqlite3_value_double(x1),
      _1690: (x0,x1) => x0.sqlite3_value_type(x1),
      _1691: (x0,x1) => x0.sqlite3_value_int64(x1),
      _1692: (x0,x1) => x0.sqlite3_value_text(x1),
      _1693: (x0,x1) => x0.sqlite3_value_bytes(x1),
      _1696: (x0,x1) => x0.sqlite3_user_data(x1),
      _1697: (x0,x1,x2,x3,x4) => x0.sqlite3_result_blob64(x1,x2,x3,x4),
      _1698: (x0,x1,x2) => x0.sqlite3_result_double(x1,x2),
      _1699: (x0,x1,x2,x3) => x0.sqlite3_result_error(x1,x2,x3),
      _1700: (x0,x1,x2) => x0.sqlite3_result_int64(x1,x2),
      _1701: (x0,x1) => x0.sqlite3_result_null(x1),
      _1702: (x0,x1,x2,x3,x4) => x0.sqlite3_result_text(x1,x2,x3,x4),
      _1703: x0 => x0.sqlite3_result_subtype,
      _1722: (x0,x1) => x0.dart_sqlite3_malloc(x1),
      _1723: (x0,x1) => x0.dart_sqlite3_free(x1),
      _1724: (x0,x1,x2,x3) => x0.dart_sqlite3_register_vfs(x1,x2,x3),
      _1725: (x0,x1,x2,x3,x4,x5) => x0.dart_sqlite3_create_scalar_function(x1,x2,x3,x4,x5),
      _1728: x0 => x0.dart_sqlite3_updates,
      _1729: x0 => x0.dart_sqlite3_commits,
      _1730: x0 => x0.dart_sqlite3_rollbacks,
      _1734: x0 => ({initial: x0}),
      _1735: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1735(f,arguments.length,x0) }),
      _1736: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3,x4) { return module.exports._1736(f,arguments.length,x0,x1,x2,x3,x4) }),
      _1737: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1737(f,arguments.length,x0,x1,x2) }),
      _1738: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3) { return module.exports._1738(f,arguments.length,x0,x1,x2,x3) }),
      _1739: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3) { return module.exports._1739(f,arguments.length,x0,x1,x2,x3) }),
      _1740: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1740(f,arguments.length,x0,x1,x2) }),
      _1741: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1741(f,arguments.length,x0,x1) }),
      _1742: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1742(f,arguments.length,x0,x1) }),
      _1743: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1743(f,arguments.length,x0) }),
      _1744: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1744(f,arguments.length,x0) }),
      _1745: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3) { return module.exports._1745(f,arguments.length,x0,x1,x2,x3) }),
      _1746: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3) { return module.exports._1746(f,arguments.length,x0,x1,x2,x3) }),
      _1747: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1747(f,arguments.length,x0,x1) }),
      _1748: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1748(f,arguments.length,x0,x1) }),
      _1749: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1749(f,arguments.length,x0,x1) }),
      _1750: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1750(f,arguments.length,x0,x1) }),
      _1751: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1751(f,arguments.length,x0,x1) }),
      _1752: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1752(f,arguments.length,x0,x1) }),
      _1753: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1753(f,arguments.length,x0,x1,x2) }),
      _1754: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1754(f,arguments.length,x0,x1,x2) }),
      _1755: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1755(f,arguments.length,x0,x1,x2) }),
      _1756: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1756(f,arguments.length,x0) }),
      _1757: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1757(f,arguments.length,x0) }),
      _1758: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1758(f,arguments.length,x0) }),
      _1759: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3,x4) { return module.exports._1759(f,arguments.length,x0,x1,x2,x3,x4) }),
      _1760: (module,f) => finalizeWrapper(f, function(x0,x1,x2,x3,x4) { return module.exports._1760(f,arguments.length,x0,x1,x2,x3,x4) }),
      _1761: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1761(f,arguments.length,x0) }),
      _1762: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1762(f,arguments.length,x0) }),
      _1763: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1763(f,arguments.length,x0,x1) }),
      _1764: (module,f) => finalizeWrapper(f, function(x0,x1) { return module.exports._1764(f,arguments.length,x0,x1) }),
      _1765: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1765(f,arguments.length,x0,x1,x2) }),
      _1767: (x0,x1,x2,x3) => x0.call(x1,x2,x3),
      _1772: x0 => new URL(x0),
      _1773: (x0,x1) => new URL(x0,x1),
      _1774: (x0,x1) => globalThis.fetch(x0,x1),
      _1775: (x0,x1,x2) => x0.postMessage(x1,x2),
      _1776: (x0,x1,x2) => x0.postMessage(x1,x2),
      _1778: (x0,x1) => ({i: x0,p: x1}),
      _1779: (x0,x1) => ({c: x0,r: x1}),
      _1780: x0 => x0.i,
      _1781: x0 => x0.p,
      _1782: x0 => x0.c,
      _1783: x0 => x0.r,
      _1784: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1784(f,arguments.length,x0) }),
      _1785: (x0,x1) => x0.postMessage(x1),
      _1786: x0 => x0.close(),
      _1788: x0 => new Worker(x0),
      _1790: x0 => x0.getDirectory(),
      _1791: x0 => ({create: x0}),
      _1792: (x0,x1,x2) => x0.getFileHandle(x1,x2),
      _1793: x0 => x0.createSyncAccessHandle(),
      _1794: x0 => x0.close(),
      _1797: x0 => x0.close(),
      _1800: (x0,x1,x2) => x0.open(x1,x2),
      _1804: (x0,x1,x2) => x0.getDirectoryHandle(x1,x2),
      _1809: x0 => ({create: x0}),
      _1814: (x0,x1) => new SharedWorker(x0,x1),
      _1815: x0 => x0.start(),
      _1816: x0 => x0.terminate(),
      _1817: () => new MessageChannel(),
      _1821: x0 => new SharedArrayBuffer(x0),
      _1822: x0 => ({at: x0}),
      _1823: x0 => x0.getSize(),
      _1824: (x0,x1) => x0.truncate(x1),
      _1825: x0 => x0.flush(),
      _1828: x0 => x0.synchronizationBuffer,
      _1829: x0 => x0.communicationBuffer,
      _1830: (x0,x1,x2,x3) => ({clientVersion: x0,root: x1,synchronizationBuffer: x2,communicationBuffer: x3}),
      _1831: (x0,x1) => globalThis.IDBKeyRange.bound(x0,x1),
      _1832: x0 => ({autoIncrement: x0}),
      _1833: (x0,x1,x2) => x0.createObjectStore(x1,x2),
      _1834: x0 => ({unique: x0}),
      _1835: (x0,x1,x2,x3) => x0.createIndex(x1,x2,x3),
      _1836: (x0,x1) => x0.createObjectStore(x1),
      _1837: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1837(f,arguments.length,x0) }),
      _1838: (x0,x1,x2) => x0.transaction(x1,x2),
      _1839: (x0,x1) => x0.objectStore(x1),
      _1841: (x0,x1) => x0.index(x1),
      _1842: x0 => x0.openKeyCursor(),
      _1843: (x0,x1) => x0.getKey(x1),
      _1844: (x0,x1) => ({name: x0,length: x1}),
      _1845: (x0,x1) => x0.put(x1),
      _1846: (x0,x1) => x0.get(x1),
      _1847: (x0,x1) => x0.openCursor(x1),
      _1848: x0 => globalThis.IDBKeyRange.only(x0),
      _1849: (x0,x1,x2) => x0.put(x1,x2),
      _1850: (x0,x1) => x0.update(x1),
      _1851: (x0,x1) => x0.delete(x1),
      _1852: x0 => x0.name,
      _1853: x0 => x0.length,
      _1856: x0 => x0.continue(),
      _1857: () => globalThis.indexedDB,
      _1858: () => globalThis.navigator,
      _1859: (x0,x1) => x0.read(x1),
      _1860: (x0,x1,x2) => x0.read(x1,x2),
      _1861: (x0,x1) => x0.write(x1),
      _1862: (x0,x1,x2) => x0.write(x1,x2),
      _1864: (x0,x1,x2) => globalThis.Atomics.wait(x0,x1,x2),
      _1866: (x0,x1,x2) => globalThis.Atomics.notify(x0,x1,x2),
      _1867: (x0,x1,x2) => globalThis.Atomics.store(x0,x1,x2),
      _1868: (x0,x1) => globalThis.Atomics.load(x0,x1),
      _1869: () => globalThis.Int32Array,
      _1871: () => globalThis.Uint8Array,
      _1873: () => globalThis.DataView,
      _1875: x0 => x0.byteLength,
      _1877: x0 => globalThis.BigInt(x0),
      _1878: x0 => globalThis.Number(x0),
      _1885: x0 => new BroadcastChannel(x0),
      _1886: x0 => globalThis.Array.isArray(x0),
      _1887: (x0,x1) => x0.postMessage(x1),
      _1889: (x0,x1) => ({kind: x0,table: x1}),
      _1890: x0 => x0.kind,
      _1891: x0 => x0.table,
      _1892: () => new XMLHttpRequest(),
      _1893: (x0,x1,x2,x3) => x0.open(x1,x2,x3),
      _1897: x0 => x0.send(),
      _1899: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1899(f,arguments.length,x0) }),
      _1900: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1900(f,arguments.length,x0) }),
      _1905: (x0,x1) => x0.appendChild(x1),
      _1908: x0 => ({type: x0}),
      _1909: (x0,x1) => new Blob(x0,x1),
      _1911: () => new AbortController(),
      _1912: x0 => x0.abort(),
      _1913: (x0,x1,x2,x3,x4,x5) => ({method: x0,headers: x1,body: x2,credentials: x3,redirect: x4,signal: x5}),
      _1914: (x0,x1) => globalThis.fetch(x0,x1),
      _1915: (x0,x1) => x0.get(x1),
      _1916: (module,f) => finalizeWrapper(f, function(x0,x1,x2) { return module.exports._1916(f,arguments.length,x0,x1,x2) }),
      _1917: (x0,x1) => x0.forEach(x1),
      _1918: x0 => x0.getReader(),
      _1919: x0 => x0.cancel(),
      _1920: x0 => x0.read(),
      _1921: x0 => x0.trustedTypes,
      _1922: (x0,x1) => { x0.src = x1 },
      _1923: (x0,x1) => x0.createScriptURL(x1),
      _1924: x0 => x0.nonce,
      _1925: (x0,x1) => x0.debug(x1),
      _1926: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._1926(f,arguments.length,x0) }),
      _1927: x0 => ({createScriptURL: x0}),
      _1928: (x0,x1,x2) => x0.createPolicy(x1,x2),
      _1929: (x0,x1) => x0.querySelectorAll(x1),
      _1948: o => o instanceof Array,
      _1952: a => a.pop(),
      _1953: (a, i) => a.splice(i, 1),
      _1954: (a, s) => a.join(s),
      _1955: (a, s, e) => a.slice(s, e),
      _1957: (a, b) => a == b ? 0 : (a > b ? 1 : -1),
      _1958: a => a.length,
      _1960: (a, i) => a[i],
      _1961: (a, i, v) => a[i] = v,
      _1963: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof ArrayBuffer) return 1;
        if (globalThis.SharedArrayBuffer !== undefined &&
            o instanceof SharedArrayBuffer) {
          return 2;
        }
        return 3;
      },
      _1964: (o, offsetInBytes, lengthInBytes) => {
        var dst = new ArrayBuffer(lengthInBytes);
        new Uint8Array(dst).set(new Uint8Array(o, offsetInBytes, lengthInBytes));
        return new DataView(dst);
      },
      _1965: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof DataView) return 1;
        return 2;
      },
      _1966: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Uint8Array) return 1;
        return 2;
      },
      _1967: (o, start, length) => new Uint8Array(o.buffer, o.byteOffset + start, length),
      _1968: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Int8Array) return 1;
        return 2;
      },
      _1969: (o, start, length) => new Int8Array(o.buffer, o.byteOffset + start, length),
      _1970: o => o instanceof Uint8ClampedArray,
      _1971: (o, start, length) => new Uint8ClampedArray(o.buffer, o.byteOffset + start, length),
      _1972: o => o instanceof Uint16Array,
      _1973: (o, start, length) => new Uint16Array(o.buffer, o.byteOffset + start, length),
      _1974: o => o instanceof Int16Array,
      _1975: (o, start, length) => new Int16Array(o.buffer, o.byteOffset + start, length),
      _1976: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Uint32Array) return 1;
        return 2;
      },
      _1977: (o, start, length) => new Uint32Array(o.buffer, o.byteOffset + start, length),
      _1978: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Int32Array) return 1;
        return 2;
      },
      _1979: (o, start, length) => new Int32Array(o.buffer, o.byteOffset + start, length),
      _1981: (o, start, length) => new BigInt64Array(o.buffer, o.byteOffset + start, length),
      _1982: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Float32Array) return 1;
        return 2;
      },
      _1983: (o, start, length) => new Float32Array(o.buffer, o.byteOffset + start, length),
      _1984: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Float64Array) return 1;
        return 2;
      },
      _1985: (o, start, length) => new Float64Array(o.buffer, o.byteOffset + start, length),
      _1986: (a, i) => a.push(i),
      _1987: (t, s) => t.set(s),
      _1988: l => new DataView(new ArrayBuffer(l)),
      _1989: (o) => new DataView(o.buffer, o.byteOffset, o.byteLength),
      _1990: o => o.byteLength,
      _1991: o => o.buffer,
      _1992: o => o.byteOffset,
      _1993: Function.prototype.call.bind(Object.getOwnPropertyDescriptor(DataView.prototype, 'byteLength').get),
      _1994: (b, o) => new DataView(b, o),
      _1995: (b, o, l) => new DataView(b, o, l),
      _1996: Function.prototype.call.bind(DataView.prototype.getUint8),
      _1997: Function.prototype.call.bind(DataView.prototype.setUint8),
      _1998: Function.prototype.call.bind(DataView.prototype.getInt8),
      _1999: Function.prototype.call.bind(DataView.prototype.setInt8),
      _2000: Function.prototype.call.bind(DataView.prototype.getUint16),
      _2001: Function.prototype.call.bind(DataView.prototype.setUint16),
      _2002: Function.prototype.call.bind(DataView.prototype.getInt16),
      _2003: Function.prototype.call.bind(DataView.prototype.setInt16),
      _2004: Function.prototype.call.bind(DataView.prototype.getUint32),
      _2005: Function.prototype.call.bind(DataView.prototype.setUint32),
      _2006: Function.prototype.call.bind(DataView.prototype.getInt32),
      _2007: Function.prototype.call.bind(DataView.prototype.setInt32),
      _2010: Function.prototype.call.bind(DataView.prototype.getBigInt64),
      _2011: Function.prototype.call.bind(DataView.prototype.setBigInt64),
      _2012: Function.prototype.call.bind(DataView.prototype.getFloat32),
      _2013: Function.prototype.call.bind(DataView.prototype.setFloat32),
      _2014: Function.prototype.call.bind(DataView.prototype.getFloat64),
      _2015: Function.prototype.call.bind(DataView.prototype.setFloat64),
      _2016: Function.prototype.call.bind(Number.prototype.toString),
      _2017: Function.prototype.call.bind(BigInt.prototype.toString),
      _2018: Function.prototype.call.bind(Number.prototype.toString),
      _2019: (d, digits) => d.toFixed(digits),
      _2025: (x0,x1) => x0.getContext(x1),
      _2068: () => globalThis.google.accounts.id,
      _2082: (module,f) => finalizeWrapper(f, function(x0) { return module.exports._2082(f,arguments.length,x0) }),
      _2085: (x0,x1,x2,x3,x4,x5,x6,x7,x8,x9,x10,x11,x12,x13,x14,x15,x16) => ({client_id: x0,auto_select: x1,callback: x2,login_uri: x3,native_callback: x4,cancel_on_tap_outside: x5,prompt_parent_id: x6,nonce: x7,context: x8,state_cookie_domain: x9,ux_mode: x10,allowed_parent_origin: x11,intermediate_iframe_close_callback: x12,itp_support: x13,login_hint: x14,hd: x15,use_fedcm_for_prompt: x16}),
      _2096: x0 => x0.error,
      _2098: x0 => x0.credential,
      _2109: x0 => { globalThis.onGoogleLibraryLoad = x0 },
      _2110: (module,f) => finalizeWrapper(f, function() { return module.exports._2110(f,arguments.length) }),
      _2159: (x0,x1) => { x0.responseType = x1 },
      _2160: x0 => x0.response,
      _2220: (x0,x1) => { x0.draggable = x1 },
      _2236: x0 => x0.style,
      _2249: (x0,x1) => { x0.oncancel = x1 },
      _2255: (x0,x1) => { x0.onchange = x1 },
      _2295: (x0,x1) => { x0.onerror = x1 },
      _2435: (x0,x1) => { x0.nonce = x1 },
      _2595: (x0,x1) => { x0.download = x1 },
      _2620: (x0,x1) => { x0.href = x1 },
      _2668: (x0,x1) => { x0.src = x1 },
      _2679: x0 => x0.width,
      _2681: x0 => x0.height,
      _3165: (x0,x1) => { x0.accept = x1 },
      _3179: x0 => x0.files,
      _3205: (x0,x1) => { x0.multiple = x1 },
      _3223: (x0,x1) => { x0.type = x1 },
      _3473: (x0,x1) => { x0.src = x1 },
      _3479: (x0,x1) => { x0.async = x1 },
      _3481: (x0,x1) => { x0.defer = x1 },
      _3517: x0 => x0.width,
      _3518: (x0,x1) => { x0.width = x1 },
      _3519: x0 => x0.height,
      _3520: (x0,x1) => { x0.height = x1 },
      _3941: () => globalThis.window,
      _3981: x0 => x0.document,
      _4003: x0 => x0.navigator,
      _4265: x0 => x0.trustedTypes,
      _4370: x0 => x0.geolocation,
      _4375: x0 => x0.permissions,
      _4389: x0 => x0.userAgent,
      _4390: x0 => x0.vendor,
      _4402: x0 => x0.storage,
      _4440: x0 => x0.data,
      _4470: x0 => x0.port1,
      _4471: x0 => x0.port2,
      _4473: (x0,x1) => { x0.onmessage = x1 },
      _4551: x0 => x0.port,
      _6492: x0 => x0.type,
      _6493: x0 => x0.target,
      _6533: x0 => x0.signal,
      _6542: x0 => x0.length,
      _6590: x0 => x0.firstChild,
      _6601: () => globalThis.document,
      _6682: x0 => x0.body,
      _6684: x0 => x0.head,
      _7013: (x0,x1) => { x0.id = x1 },
      _7040: x0 => x0.children,
      _8359: x0 => x0.value,
      _8361: x0 => x0.done,
      _8520: x0 => x0.size,
      _8521: x0 => x0.type,
      _8524: (x0,x1) => { x0.type = x1 },
      _8527: x0 => x0.name,
      _8528: x0 => x0.lastModified,
      _8533: x0 => x0.length,
      _8538: x0 => x0.result,
      _9032: x0 => x0.url,
      _9034: x0 => x0.status,
      _9036: x0 => x0.statusText,
      _9037: x0 => x0.headers,
      _9038: x0 => x0.body,
      _9423: x0 => x0.state,
      _10491: x0 => x0.result,
      _10492: x0 => x0.error,
      _10503: (x0,x1) => { x0.onupgradeneeded = x1 },
      _10505: x0 => x0.oldVersion,
      _10584: x0 => x0.key,
      _10585: x0 => x0.primaryKey,
      _10587: x0 => x0.value,
      _10724: x0 => x0.coords,
      _10725: x0 => x0.timestamp,
      _10727: x0 => x0.accuracy,
      _10728: x0 => x0.latitude,
      _10729: x0 => x0.longitude,
      _10730: x0 => x0.altitude,
      _10731: x0 => x0.altitudeAccuracy,
      _10732: x0 => x0.heading,
      _10733: x0 => x0.speed,
      _10734: x0 => x0.code,
      _10735: x0 => x0.message,
      _11421: (x0,x1) => { x0.display = x1 },
      _12643: x0 => x0.name,
      _12644: x0 => x0.message,
      _13359: () => globalThis.console,
      _13384: () => globalThis.console,
      _13423: (x0,x1) => x0.error(x1),
      _13436: (x0,x1,x2) => globalThis.history.replaceState(x0,x1,x2),

    };

    const baseImports = {
      dart2wasm: dart2wasm,
      Math: Math,
      Date: Date,
      Object: Object,
      Array: Array,
      Reflect: Reflect,
      WebAssembly: {
        JSTag: WebAssembly.JSTag,
      },
      "": new Proxy({}, { get(_, prop) { return prop; } }),

    };

    const jsStringPolyfill = {
      "charCodeAt": (s, i) => s.charCodeAt(i),
      "compare": (s1, s2) => {
        if (s1 < s2) return -1;
        if (s1 > s2) return 1;
        return 0;
      },
      "concat": (s1, s2) => s1 + s2,
      "equals": (s1, s2) => s1 === s2,
      "fromCharCode": (i) => String.fromCharCode(i),
      "length": (s) => s.length,
      "substring": (s, a, b) => s.substring(a, b),
      "fromCharCodeArray": (a, start, end) => {
        if (end <= start) return '';

        const read = dartInstance.exports.$wasmI16ArrayGet;
        let result = '';
        let index = start;
        const chunkLength = Math.min(end - index, 500);
        let array = new Array(chunkLength);
        while (index < end) {
          const newChunkLength = Math.min(end - index, 500);
          for (let i = 0; i < newChunkLength; i++) {
            array[i] = read(a, index++);
          }
          if (newChunkLength < chunkLength) {
            array = array.slice(0, newChunkLength);
          }
          result += String.fromCharCode(...array);
        }
        return result;
      },
      "intoCharCodeArray": (s, a, start) => {
        if (s === '') return 0;

        const write = dartInstance.exports.$wasmI16ArraySet;
        for (var i = 0; i < s.length; ++i) {
          write(a, start++, s.charCodeAt(i));
        }
        return s.length;
      },
      "test": (s) => typeof s == "string",
    };


    

    dartInstance = await WebAssembly.instantiate(this.module, {
      ...baseImports,
      ...additionalImports,
      
      "wasm:js-string": jsStringPolyfill,
    });
    dartInstance.exports.$setThisModule(dartInstance);

    return new InstantiatedApp(this, dartInstance);
  }
}

class InstantiatedApp {
  constructor(compiledApp, instantiatedModule) {
    this.compiledApp = compiledApp;
    this.instantiatedModule = instantiatedModule;
  }

  // Call the main function with the given arguments.
  invokeMain(...args) {
    this.instantiatedModule.exports.$invokeMain(args);
  }
}
