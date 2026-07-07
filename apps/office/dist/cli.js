#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS({
  "node_modules/pngjs/lib/chunkstream.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var ChunkStream = module2.exports = function() {
      Stream.call(this);
      this._buffers = [];
      this._buffered = 0;
      this._reads = [];
      this._paused = false;
      this._encoding = "utf8";
      this.writable = true;
    };
    util.inherits(ChunkStream, Stream);
    ChunkStream.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
      process.nextTick(
        function() {
          this._process();
          if (this._paused && this._reads && this._reads.length > 0) {
            this._paused = false;
            this.emit("drain");
          }
        }.bind(this)
      );
    };
    ChunkStream.prototype.write = function(data, encoding) {
      if (!this.writable) {
        this.emit("error", new Error("Stream not writable"));
        return false;
      }
      let dataBuffer;
      if (Buffer.isBuffer(data)) {
        dataBuffer = data;
      } else {
        dataBuffer = Buffer.from(data, encoding || this._encoding);
      }
      this._buffers.push(dataBuffer);
      this._buffered += dataBuffer.length;
      this._process();
      if (this._reads && this._reads.length === 0) {
        this._paused = true;
      }
      return this.writable && !this._paused;
    };
    ChunkStream.prototype.end = function(data, encoding) {
      if (data) {
        this.write(data, encoding);
      }
      this.writable = false;
      if (!this._buffers) {
        return;
      }
      if (this._buffers.length === 0) {
        this._end();
      } else {
        this._buffers.push(null);
        this._process();
      }
    };
    ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
    ChunkStream.prototype._end = function() {
      if (this._reads.length > 0) {
        this.emit("error", new Error("Unexpected end of input"));
      }
      this.destroy();
    };
    ChunkStream.prototype.destroy = function() {
      if (!this._buffers) {
        return;
      }
      this.writable = false;
      this._reads = null;
      this._buffers = null;
      this.emit("close");
    };
    ChunkStream.prototype._processReadAllowingLess = function(read) {
      this._reads.shift();
      let smallerBuf = this._buffers[0];
      if (smallerBuf.length > read.length) {
        this._buffered -= read.length;
        this._buffers[0] = smallerBuf.slice(read.length);
        read.func.call(this, smallerBuf.slice(0, read.length));
      } else {
        this._buffered -= smallerBuf.length;
        this._buffers.shift();
        read.func.call(this, smallerBuf);
      }
    };
    ChunkStream.prototype._processRead = function(read) {
      this._reads.shift();
      let pos = 0;
      let count = 0;
      let data = Buffer.alloc(read.length);
      while (pos < read.length) {
        let buf = this._buffers[count++];
        let len = Math.min(buf.length, read.length - pos);
        buf.copy(data, pos, 0, len);
        pos += len;
        if (len !== buf.length) {
          this._buffers[--count] = buf.slice(len);
        }
      }
      if (count > 0) {
        this._buffers.splice(0, count);
      }
      this._buffered -= read.length;
      read.func.call(this, data);
    };
    ChunkStream.prototype._process = function() {
      try {
        while (this._buffered > 0 && this._reads && this._reads.length > 0) {
          let read = this._reads[0];
          if (read.allowLess) {
            this._processReadAllowingLess(read);
          } else if (this._buffered >= read.length) {
            this._processRead(read);
          } else {
            break;
          }
        }
        if (this._buffers && !this.writable) {
          this._end();
        }
      } catch (ex) {
        this.emit("error", ex);
      }
    };
  }
});

// node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS({
  "node_modules/pngjs/lib/interlace.js"(exports2) {
    "use strict";
    var imagePasses = [
      {
        // pass 1 - 1px
        x: [0],
        y: [0]
      },
      {
        // pass 2 - 1px
        x: [4],
        y: [0]
      },
      {
        // pass 3 - 2px
        x: [0, 4],
        y: [4]
      },
      {
        // pass 4 - 4px
        x: [2, 6],
        y: [0, 4]
      },
      {
        // pass 5 - 8px
        x: [0, 2, 4, 6],
        y: [2, 6]
      },
      {
        // pass 6 - 16px
        x: [1, 3, 5, 7],
        y: [0, 2, 4, 6]
      },
      {
        // pass 7 - 32px
        x: [0, 1, 2, 3, 4, 5, 6, 7],
        y: [1, 3, 5, 7]
      }
    ];
    exports2.getImagePasses = function(width, height) {
      let images = [];
      let xLeftOver = width % 8;
      let yLeftOver = height % 8;
      let xRepeats = (width - xLeftOver) / 8;
      let yRepeats = (height - yLeftOver) / 8;
      for (let i = 0; i < imagePasses.length; i++) {
        let pass = imagePasses[i];
        let passWidth = xRepeats * pass.x.length;
        let passHeight = yRepeats * pass.y.length;
        for (let j = 0; j < pass.x.length; j++) {
          if (pass.x[j] < xLeftOver) {
            passWidth++;
          } else {
            break;
          }
        }
        for (let j = 0; j < pass.y.length; j++) {
          if (pass.y[j] < yLeftOver) {
            passHeight++;
          } else {
            break;
          }
        }
        if (passWidth > 0 && passHeight > 0) {
          images.push({ width: passWidth, height: passHeight, index: i });
        }
      }
      return images;
    };
    exports2.getInterlaceIterator = function(width) {
      return function(x, y, pass) {
        let outerXLeftOver = x % imagePasses[pass].x.length;
        let outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
        let outerYLeftOver = y % imagePasses[pass].y.length;
        let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
        return outerX * 4 + outerY * width * 4;
      };
    };
  }
});

// node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS({
  "node_modules/pngjs/lib/paeth-predictor.js"(exports2, module2) {
    "use strict";
    module2.exports = function paethPredictor(left, above, upLeft) {
      let paeth = left + above - upLeft;
      let pLeft = Math.abs(paeth - left);
      let pAbove = Math.abs(paeth - above);
      let pUpLeft = Math.abs(paeth - upLeft);
      if (pLeft <= pAbove && pLeft <= pUpLeft) {
        return left;
      }
      if (pAbove <= pUpLeft) {
        return above;
      }
      return upLeft;
    };
  }
});

// node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS({
  "node_modules/pngjs/lib/filter-parse.js"(exports2, module2) {
    "use strict";
    var interlaceUtils = require_interlace();
    var paethPredictor = require_paeth_predictor();
    function getByteWidth(width, bpp, depth) {
      let byteWidth = width * bpp;
      if (depth !== 8) {
        byteWidth = Math.ceil(byteWidth / (8 / depth));
      }
      return byteWidth;
    }
    var Filter = module2.exports = function(bitmapInfo, dependencies) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let interlace = bitmapInfo.interlace;
      let bpp = bitmapInfo.bpp;
      let depth = bitmapInfo.depth;
      this.read = dependencies.read;
      this.write = dependencies.write;
      this.complete = dependencies.complete;
      this._imageIndex = 0;
      this._images = [];
      if (interlace) {
        let passes = interlaceUtils.getImagePasses(width, height);
        for (let i = 0; i < passes.length; i++) {
          this._images.push({
            byteWidth: getByteWidth(passes[i].width, bpp, depth),
            height: passes[i].height,
            lineIndex: 0
          });
        }
      } else {
        this._images.push({
          byteWidth: getByteWidth(width, bpp, depth),
          height,
          lineIndex: 0
        });
      }
      if (depth === 8) {
        this._xComparison = bpp;
      } else if (depth === 16) {
        this._xComparison = bpp * 2;
      } else {
        this._xComparison = 1;
      }
    };
    Filter.prototype.start = function() {
      this.read(
        this._images[this._imageIndex].byteWidth + 1,
        this._reverseFilterLine.bind(this)
      );
    };
    Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        unfilteredLine[x] = rawByte + f1Left;
      }
    };
    Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f2Up = lastLine ? lastLine[x] : 0;
        unfilteredLine[x] = rawByte + f2Up;
      }
    };
    Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f3Up = lastLine ? lastLine[x] : 0;
        let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        let f3Add = Math.floor((f3Left + f3Up) / 2);
        unfilteredLine[x] = rawByte + f3Add;
      }
    };
    Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f4Up = lastLine ? lastLine[x] : 0;
        let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
        let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
        unfilteredLine[x] = rawByte + f4Add;
      }
    };
    Filter.prototype._reverseFilterLine = function(rawData) {
      let filter = rawData[0];
      let unfilteredLine;
      let currentImage = this._images[this._imageIndex];
      let byteWidth = currentImage.byteWidth;
      if (filter === 0) {
        unfilteredLine = rawData.slice(1, byteWidth + 1);
      } else {
        unfilteredLine = Buffer.alloc(byteWidth);
        switch (filter) {
          case 1:
            this._unFilterType1(rawData, unfilteredLine, byteWidth);
            break;
          case 2:
            this._unFilterType2(rawData, unfilteredLine, byteWidth);
            break;
          case 3:
            this._unFilterType3(rawData, unfilteredLine, byteWidth);
            break;
          case 4:
            this._unFilterType4(rawData, unfilteredLine, byteWidth);
            break;
          default:
            throw new Error("Unrecognised filter type - " + filter);
        }
      }
      this.write(unfilteredLine);
      currentImage.lineIndex++;
      if (currentImage.lineIndex >= currentImage.height) {
        this._lastLine = null;
        this._imageIndex++;
        currentImage = this._images[this._imageIndex];
      } else {
        this._lastLine = unfilteredLine;
      }
      if (currentImage) {
        this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
      } else {
        this._lastLine = null;
        this.complete();
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS({
  "node_modules/pngjs/lib/filter-parse-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var ChunkStream = require_chunkstream();
    var Filter = require_filter_parse();
    var FilterAsync = module2.exports = function(bitmapInfo) {
      ChunkStream.call(this);
      let buffers = [];
      let that = this;
      this._filter = new Filter(bitmapInfo, {
        read: this.read.bind(this),
        write: function(buffer) {
          buffers.push(buffer);
        },
        complete: function() {
          that.emit("complete", Buffer.concat(buffers));
        }
      });
      this._filter.start();
    };
    util.inherits(FilterAsync, ChunkStream);
  }
});

// node_modules/pngjs/lib/constants.js
var require_constants = __commonJS({
  "node_modules/pngjs/lib/constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
      TYPE_IHDR: 1229472850,
      TYPE_IEND: 1229278788,
      TYPE_IDAT: 1229209940,
      TYPE_PLTE: 1347179589,
      TYPE_tRNS: 1951551059,
      // eslint-disable-line camelcase
      TYPE_gAMA: 1732332865,
      // eslint-disable-line camelcase
      // color-type bits
      COLORTYPE_GRAYSCALE: 0,
      COLORTYPE_PALETTE: 1,
      COLORTYPE_COLOR: 2,
      COLORTYPE_ALPHA: 4,
      // e.g. grayscale and alpha
      // color-type combinations
      COLORTYPE_PALETTE_COLOR: 3,
      COLORTYPE_COLOR_ALPHA: 6,
      COLORTYPE_TO_BPP_MAP: {
        0: 1,
        2: 3,
        3: 1,
        4: 2,
        6: 4
      },
      GAMMA_DIVISION: 1e5
    };
  }
});

// node_modules/pngjs/lib/crc.js
var require_crc = __commonJS({
  "node_modules/pngjs/lib/crc.js"(exports2, module2) {
    "use strict";
    var crcTable = [];
    (function() {
      for (let i = 0; i < 256; i++) {
        let currentCrc = i;
        for (let j = 0; j < 8; j++) {
          if (currentCrc & 1) {
            currentCrc = 3988292384 ^ currentCrc >>> 1;
          } else {
            currentCrc = currentCrc >>> 1;
          }
        }
        crcTable[i] = currentCrc;
      }
    })();
    var CrcCalculator = module2.exports = function() {
      this._crc = -1;
    };
    CrcCalculator.prototype.write = function(data) {
      for (let i = 0; i < data.length; i++) {
        this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
      }
      return true;
    };
    CrcCalculator.prototype.crc32 = function() {
      return this._crc ^ -1;
    };
    CrcCalculator.crc32 = function(buf) {
      let crc = -1;
      for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    };
  }
});

// node_modules/pngjs/lib/parser.js
var require_parser = __commonJS({
  "node_modules/pngjs/lib/parser.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var CrcCalculator = require_crc();
    var Parser = module2.exports = function(options, dependencies) {
      this._options = options;
      options.checkCRC = options.checkCRC !== false;
      this._hasIHDR = false;
      this._hasIEND = false;
      this._emittedHeadersFinished = false;
      this._palette = [];
      this._colorType = 0;
      this._chunks = {};
      this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
      this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
      this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
      this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
      this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
      this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
      this.read = dependencies.read;
      this.error = dependencies.error;
      this.metadata = dependencies.metadata;
      this.gamma = dependencies.gamma;
      this.transColor = dependencies.transColor;
      this.palette = dependencies.palette;
      this.parsed = dependencies.parsed;
      this.inflateData = dependencies.inflateData;
      this.finished = dependencies.finished;
      this.simpleTransparency = dependencies.simpleTransparency;
      this.headersFinished = dependencies.headersFinished || function() {
      };
    };
    Parser.prototype.start = function() {
      this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
    };
    Parser.prototype._parseSignature = function(data) {
      let signature = constants.PNG_SIGNATURE;
      for (let i = 0; i < signature.length; i++) {
        if (data[i] !== signature[i]) {
          this.error(new Error("Invalid file signature"));
          return;
        }
      }
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._parseChunkBegin = function(data) {
      let length = data.readUInt32BE(0);
      let type = data.readUInt32BE(4);
      let name = "";
      for (let i = 4; i < 8; i++) {
        name += String.fromCharCode(data[i]);
      }
      let ancillary = Boolean(data[4] & 32);
      if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
        this.error(new Error("Expected IHDR on beggining"));
        return;
      }
      this._crc = new CrcCalculator();
      this._crc.write(Buffer.from(name));
      if (this._chunks[type]) {
        return this._chunks[type](length);
      }
      if (!ancillary) {
        this.error(new Error("Unsupported critical chunk type " + name));
        return;
      }
      this.read(length + 4, this._skipChunk.bind(this));
    };
    Parser.prototype._skipChunk = function() {
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._handleChunkEnd = function() {
      this.read(4, this._parseChunkEnd.bind(this));
    };
    Parser.prototype._parseChunkEnd = function(data) {
      let fileCrc = data.readInt32BE(0);
      let calcCrc = this._crc.crc32();
      if (this._options.checkCRC && calcCrc !== fileCrc) {
        this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
        return;
      }
      if (!this._hasIEND) {
        this.read(8, this._parseChunkBegin.bind(this));
      }
    };
    Parser.prototype._handleIHDR = function(length) {
      this.read(length, this._parseIHDR.bind(this));
    };
    Parser.prototype._parseIHDR = function(data) {
      this._crc.write(data);
      let width = data.readUInt32BE(0);
      let height = data.readUInt32BE(4);
      let depth = data[8];
      let colorType = data[9];
      let compr = data[10];
      let filter = data[11];
      let interlace = data[12];
      if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
        this.error(new Error("Unsupported bit depth " + depth));
        return;
      }
      if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
        this.error(new Error("Unsupported color type"));
        return;
      }
      if (compr !== 0) {
        this.error(new Error("Unsupported compression method"));
        return;
      }
      if (filter !== 0) {
        this.error(new Error("Unsupported filter method"));
        return;
      }
      if (interlace !== 0 && interlace !== 1) {
        this.error(new Error("Unsupported interlace method"));
        return;
      }
      this._colorType = colorType;
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
      this._hasIHDR = true;
      this.metadata({
        width,
        height,
        depth,
        interlace: Boolean(interlace),
        palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
        color: Boolean(colorType & constants.COLORTYPE_COLOR),
        alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
        bpp,
        colorType
      });
      this._handleChunkEnd();
    };
    Parser.prototype._handlePLTE = function(length) {
      this.read(length, this._parsePLTE.bind(this));
    };
    Parser.prototype._parsePLTE = function(data) {
      this._crc.write(data);
      let entries = Math.floor(data.length / 3);
      for (let i = 0; i < entries; i++) {
        this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255]);
      }
      this.palette(this._palette);
      this._handleChunkEnd();
    };
    Parser.prototype._handleTRNS = function(length) {
      this.simpleTransparency();
      this.read(length, this._parseTRNS.bind(this));
    };
    Parser.prototype._parseTRNS = function(data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
        if (this._palette.length === 0) {
          this.error(new Error("Transparency chunk must be after palette"));
          return;
        }
        if (data.length > this._palette.length) {
          this.error(new Error("More transparent colors than palette size"));
          return;
        }
        for (let i = 0; i < data.length; i++) {
          this._palette[i][3] = data[i];
        }
        this.palette(this._palette);
      }
      if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
        this.transColor([data.readUInt16BE(0)]);
      }
      if (this._colorType === constants.COLORTYPE_COLOR) {
        this.transColor([
          data.readUInt16BE(0),
          data.readUInt16BE(2),
          data.readUInt16BE(4)
        ]);
      }
      this._handleChunkEnd();
    };
    Parser.prototype._handleGAMA = function(length) {
      this.read(length, this._parseGAMA.bind(this));
    };
    Parser.prototype._parseGAMA = function(data) {
      this._crc.write(data);
      this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
      this._handleChunkEnd();
    };
    Parser.prototype._handleIDAT = function(length) {
      if (!this._emittedHeadersFinished) {
        this._emittedHeadersFinished = true;
        this.headersFinished();
      }
      this.read(-length, this._parseIDAT.bind(this, length));
    };
    Parser.prototype._parseIDAT = function(length, data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
        throw new Error("Expected palette not found");
      }
      this.inflateData(data);
      let leftOverLength = length - data.length;
      if (leftOverLength > 0) {
        this._handleIDAT(leftOverLength);
      } else {
        this._handleChunkEnd();
      }
    };
    Parser.prototype._handleIEND = function(length) {
      this.read(length, this._parseIEND.bind(this));
    };
    Parser.prototype._parseIEND = function(data) {
      this._crc.write(data);
      this._hasIEND = true;
      this._handleChunkEnd();
      if (this.finished) {
        this.finished();
      }
    };
  }
});

// node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS({
  "node_modules/pngjs/lib/bitmapper.js"(exports2) {
    "use strict";
    var interlaceUtils = require_interlace();
    var pixelBppMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos === data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = 255;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 1 >= data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = data[rawPos + 1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 2 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = 255;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 3 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = data[rawPos + 3];
      }
    ];
    var pixelBppCustomMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = maxBit;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, pixelData, pxPos) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = pixelData[1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = maxBit;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, pixelData, pxPos) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = pixelData[3];
      }
    ];
    function bitRetriever(data, depth) {
      let leftOver = [];
      let i = 0;
      function split() {
        if (i === data.length) {
          throw new Error("Ran out of data");
        }
        let byte = data[i];
        i++;
        let byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
        switch (depth) {
          default:
            throw new Error("unrecognised depth");
          case 16:
            byte2 = data[i];
            i++;
            leftOver.push((byte << 8) + byte2);
            break;
          case 4:
            byte2 = byte & 15;
            byte1 = byte >> 4;
            leftOver.push(byte1, byte2);
            break;
          case 2:
            byte4 = byte & 3;
            byte3 = byte >> 2 & 3;
            byte2 = byte >> 4 & 3;
            byte1 = byte >> 6 & 3;
            leftOver.push(byte1, byte2, byte3, byte4);
            break;
          case 1:
            byte8 = byte & 1;
            byte7 = byte >> 1 & 1;
            byte6 = byte >> 2 & 1;
            byte5 = byte >> 3 & 1;
            byte4 = byte >> 4 & 1;
            byte3 = byte >> 5 & 1;
            byte2 = byte >> 6 & 1;
            byte1 = byte >> 7 & 1;
            leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
            break;
        }
      }
      return {
        get: function(count) {
          while (leftOver.length < count) {
            split();
          }
          let returner = leftOver.slice(0, count);
          leftOver = leftOver.slice(count);
          return returner;
        },
        resetAfterLine: function() {
          leftOver.length = 0;
        },
        end: function() {
          if (i !== data.length) {
            throw new Error("extra data found");
          }
        }
      };
    }
    function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
      let imageWidth = image.width;
      let imageHeight = image.height;
      let imagePass = image.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let pxPos = getPxPos(x, y, imagePass);
          pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
          rawPos += bpp;
        }
      }
      return rawPos;
    }
    function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
      let imageWidth = image.width;
      let imageHeight = image.height;
      let imagePass = image.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let pixelData = bits.get(bpp);
          let pxPos = getPxPos(x, y, imagePass);
          pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
        }
        bits.resetAfterLine();
      }
    }
    exports2.dataToBitMap = function(data, bitmapInfo) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let depth = bitmapInfo.depth;
      let bpp = bitmapInfo.bpp;
      let interlace = bitmapInfo.interlace;
      let bits;
      if (depth !== 8) {
        bits = bitRetriever(data, depth);
      }
      let pxData;
      if (depth <= 8) {
        pxData = Buffer.alloc(width * height * 4);
      } else {
        pxData = new Uint16Array(width * height * 4);
      }
      let maxBit = Math.pow(2, depth) - 1;
      let rawPos = 0;
      let images;
      let getPxPos;
      if (interlace) {
        images = interlaceUtils.getImagePasses(width, height);
        getPxPos = interlaceUtils.getInterlaceIterator(width, height);
      } else {
        let nonInterlacedPxPos = 0;
        getPxPos = function() {
          let returner = nonInterlacedPxPos;
          nonInterlacedPxPos += 4;
          return returner;
        };
        images = [{ width, height }];
      }
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        if (depth === 8) {
          rawPos = mapImage8Bit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            data,
            rawPos
          );
        } else {
          mapImageCustomBit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            bits,
            maxBit
          );
        }
      }
      if (depth === 8) {
        if (rawPos !== data.length) {
          throw new Error("extra data found");
        }
      } else {
        bits.end();
      }
      return pxData;
    };
  }
});

// node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS({
  "node_modules/pngjs/lib/format-normaliser.js"(exports2, module2) {
    "use strict";
    function dePalette(indata, outdata, width, height, palette) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let color = palette[indata[pxPos]];
          if (!color) {
            throw new Error("index " + indata[pxPos] + " not in palette");
          }
          for (let i = 0; i < 4; i++) {
            outdata[pxPos + i] = color[i];
          }
          pxPos += 4;
        }
      }
    }
    function replaceTransparentColor(indata, outdata, width, height, transColor) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let makeTrans = false;
          if (transColor.length === 1) {
            if (transColor[0] === indata[pxPos]) {
              makeTrans = true;
            }
          } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
            makeTrans = true;
          }
          if (makeTrans) {
            for (let i = 0; i < 4; i++) {
              outdata[pxPos + i] = 0;
            }
          }
          pxPos += 4;
        }
      }
    }
    function scaleDepth(indata, outdata, width, height, depth) {
      let maxOutSample = 255;
      let maxInSample = Math.pow(2, depth) - 1;
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let i = 0; i < 4; i++) {
            outdata[pxPos + i] = Math.floor(
              indata[pxPos + i] * maxOutSample / maxInSample + 0.5
            );
          }
          pxPos += 4;
        }
      }
    }
    module2.exports = function(indata, imageData, skipRescale = false) {
      let depth = imageData.depth;
      let width = imageData.width;
      let height = imageData.height;
      let colorType = imageData.colorType;
      let transColor = imageData.transColor;
      let palette = imageData.palette;
      let outdata = indata;
      if (colorType === 3) {
        dePalette(indata, outdata, width, height, palette);
      } else {
        if (transColor) {
          replaceTransparentColor(indata, outdata, width, height, transColor);
        }
        if (depth !== 8 && !skipRescale) {
          if (depth === 16) {
            outdata = Buffer.alloc(width * height * 4);
          }
          scaleDepth(indata, outdata, width, height, depth);
        }
      }
      return outdata;
    };
  }
});

// node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS({
  "node_modules/pngjs/lib/parser-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var zlib = require("zlib");
    var ChunkStream = require_chunkstream();
    var FilterAsync = require_filter_parse_async();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    var ParserAsync = module2.exports = function(options) {
      ChunkStream.call(this);
      this._parser = new Parser(options, {
        read: this.read.bind(this),
        error: this._handleError.bind(this),
        metadata: this._handleMetaData.bind(this),
        gamma: this.emit.bind(this, "gamma"),
        palette: this._handlePalette.bind(this),
        transColor: this._handleTransColor.bind(this),
        finished: this._finished.bind(this),
        inflateData: this._inflateData.bind(this),
        simpleTransparency: this._simpleTransparency.bind(this),
        headersFinished: this._headersFinished.bind(this)
      });
      this._options = options;
      this.writable = true;
      this._parser.start();
    };
    util.inherits(ParserAsync, ChunkStream);
    ParserAsync.prototype._handleError = function(err) {
      this.emit("error", err);
      this.writable = false;
      this.destroy();
      if (this._inflate && this._inflate.destroy) {
        this._inflate.destroy();
      }
      if (this._filter) {
        this._filter.destroy();
        this._filter.on("error", function() {
        });
      }
      this.errord = true;
    };
    ParserAsync.prototype._inflateData = function(data) {
      if (!this._inflate) {
        if (this._bitmapInfo.interlace) {
          this._inflate = zlib.createInflate();
          this._inflate.on("error", this.emit.bind(this, "error"));
          this._filter.on("complete", this._complete.bind(this));
          this._inflate.pipe(this._filter);
        } else {
          let rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
          let imageSize = rowSize * this._bitmapInfo.height;
          let chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
          this._inflate = zlib.createInflate({ chunkSize });
          let leftToInflate = imageSize;
          let emitError = this.emit.bind(this, "error");
          this._inflate.on("error", function(err) {
            if (!leftToInflate) {
              return;
            }
            emitError(err);
          });
          this._filter.on("complete", this._complete.bind(this));
          let filterWrite = this._filter.write.bind(this._filter);
          this._inflate.on("data", function(chunk) {
            if (!leftToInflate) {
              return;
            }
            if (chunk.length > leftToInflate) {
              chunk = chunk.slice(0, leftToInflate);
            }
            leftToInflate -= chunk.length;
            filterWrite(chunk);
          });
          this._inflate.on("end", this._filter.end.bind(this._filter));
        }
      }
      this._inflate.write(data);
    };
    ParserAsync.prototype._handleMetaData = function(metaData) {
      this._metaData = metaData;
      this._bitmapInfo = Object.create(metaData);
      this._filter = new FilterAsync(this._bitmapInfo);
    };
    ParserAsync.prototype._handleTransColor = function(transColor) {
      this._bitmapInfo.transColor = transColor;
    };
    ParserAsync.prototype._handlePalette = function(palette) {
      this._bitmapInfo.palette = palette;
    };
    ParserAsync.prototype._simpleTransparency = function() {
      this._metaData.alpha = true;
    };
    ParserAsync.prototype._headersFinished = function() {
      this.emit("metadata", this._metaData);
    };
    ParserAsync.prototype._finished = function() {
      if (this.errord) {
        return;
      }
      if (!this._inflate) {
        this.emit("error", "No Inflate block");
      } else {
        this._inflate.end();
      }
    };
    ParserAsync.prototype._complete = function(filteredData) {
      if (this.errord) {
        return;
      }
      let normalisedBitmapData;
      try {
        let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
        normalisedBitmapData = formatNormaliser(
          bitmapData,
          this._bitmapInfo,
          this._options.skipRescale
        );
        bitmapData = null;
      } catch (ex) {
        this._handleError(ex);
        return;
      }
      this.emit("parsed", normalisedBitmapData);
    };
  }
});

// node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS({
  "node_modules/pngjs/lib/bitpacker.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    module2.exports = function(dataIn, width, height, options) {
      let outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(
        options.colorType
      ) !== -1;
      if (options.colorType === options.inputColorType) {
        let bigEndian = (function() {
          let buffer = new ArrayBuffer(2);
          new DataView(buffer).setInt16(
            0,
            256,
            true
            /* littleEndian */
          );
          return new Int16Array(buffer)[0] !== 256;
        })();
        if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
          return dataIn;
        }
      }
      let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
      let maxValue = 255;
      let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
      if (inBpp === 4 && !options.inputHasAlpha) {
        inBpp = 3;
      }
      let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
      if (options.bitDepth === 16) {
        maxValue = 65535;
        outBpp *= 2;
      }
      let outData = Buffer.alloc(width * height * outBpp);
      let inIndex = 0;
      let outIndex = 0;
      let bgColor = options.bgColor || {};
      if (bgColor.red === void 0) {
        bgColor.red = maxValue;
      }
      if (bgColor.green === void 0) {
        bgColor.green = maxValue;
      }
      if (bgColor.blue === void 0) {
        bgColor.blue = maxValue;
      }
      function getRGBA() {
        let red;
        let green;
        let blue;
        let alpha = maxValue;
        switch (options.inputColorType) {
          case constants.COLORTYPE_COLOR_ALPHA:
            alpha = data[inIndex + 3];
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_COLOR:
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_ALPHA:
            alpha = data[inIndex + 1];
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          case constants.COLORTYPE_GRAYSCALE:
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          default:
            throw new Error(
              "input color type:" + options.inputColorType + " is not supported at present"
            );
        }
        if (options.inputHasAlpha) {
          if (!outHasAlpha) {
            alpha /= maxValue;
            red = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
              maxValue
            );
            green = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
              maxValue
            );
            blue = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
              maxValue
            );
          }
        }
        return { red, green, blue, alpha };
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let rgba = getRGBA(data, inIndex);
          switch (options.colorType) {
            case constants.COLORTYPE_COLOR_ALPHA:
            case constants.COLORTYPE_COLOR:
              if (options.bitDepth === 8) {
                outData[outIndex] = rgba.red;
                outData[outIndex + 1] = rgba.green;
                outData[outIndex + 2] = rgba.blue;
                if (outHasAlpha) {
                  outData[outIndex + 3] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(rgba.red, outIndex);
                outData.writeUInt16BE(rgba.green, outIndex + 2);
                outData.writeUInt16BE(rgba.blue, outIndex + 4);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 6);
                }
              }
              break;
            case constants.COLORTYPE_ALPHA:
            case constants.COLORTYPE_GRAYSCALE: {
              let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
              if (options.bitDepth === 8) {
                outData[outIndex] = grayscale;
                if (outHasAlpha) {
                  outData[outIndex + 1] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(grayscale, outIndex);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 2);
                }
              }
              break;
            }
            default:
              throw new Error("unrecognised color Type " + options.colorType);
          }
          inIndex += inBpp;
          outIndex += outBpp;
        }
      }
      return outData;
    };
  }
});

// node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS({
  "node_modules/pngjs/lib/filter-pack.js"(exports2, module2) {
    "use strict";
    var paethPredictor = require_paeth_predictor();
    function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x = 0; x < byteWidth; x++) {
        rawData[rawPos + x] = pxData[pxPos + x];
      }
    }
    function filterSumNone(pxData, pxPos, byteWidth) {
      let sum = 0;
      let length = pxPos + byteWidth;
      for (let i = pxPos; i < length; i++) {
        sum += Math.abs(pxData[i]);
      }
      return sum;
    }
    function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let val = pxData[pxPos + x] - left;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumSub(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let val = pxData[pxPos + x] - left;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x = 0; x < byteWidth; x++) {
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - up;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumUp(pxData, pxPos, byteWidth) {
      let sum = 0;
      let length = pxPos + byteWidth;
      for (let x = pxPos; x < length; x++) {
        let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
        let val = pxData[x] - up;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - (left + up >> 1);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - (left + up >> 1);
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        sum += Math.abs(val);
      }
      return sum;
    }
    var filters = {
      0: filterNone,
      1: filterSub,
      2: filterUp,
      3: filterAvg,
      4: filterPaeth
    };
    var filterSums = {
      0: filterSumNone,
      1: filterSumSub,
      2: filterSumUp,
      3: filterSumAvg,
      4: filterSumPaeth
    };
    module2.exports = function(pxData, width, height, options, bpp) {
      let filterTypes;
      if (!("filterType" in options) || options.filterType === -1) {
        filterTypes = [0, 1, 2, 3, 4];
      } else if (typeof options.filterType === "number") {
        filterTypes = [options.filterType];
      } else {
        throw new Error("unrecognised filter types");
      }
      if (options.bitDepth === 16) {
        bpp *= 2;
      }
      let byteWidth = width * bpp;
      let rawPos = 0;
      let pxPos = 0;
      let rawData = Buffer.alloc((byteWidth + 1) * height);
      let sel = filterTypes[0];
      for (let y = 0; y < height; y++) {
        if (filterTypes.length > 1) {
          let min = Infinity;
          for (let i = 0; i < filterTypes.length; i++) {
            let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
            if (sum < min) {
              sel = filterTypes[i];
              min = sum;
            }
          }
        }
        rawData[rawPos] = sel;
        rawPos++;
        filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
        rawPos += byteWidth;
        pxPos += byteWidth;
      }
      return rawData;
    };
  }
});

// node_modules/pngjs/lib/packer.js
var require_packer = __commonJS({
  "node_modules/pngjs/lib/packer.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var CrcStream = require_crc();
    var bitPacker = require_bitpacker();
    var filter = require_filter_pack();
    var zlib = require("zlib");
    var Packer = module2.exports = function(options) {
      this._options = options;
      options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
      options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
      options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
      options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
      options.deflateFactory = options.deflateFactory || zlib.createDeflate;
      options.bitDepth = options.bitDepth || 8;
      options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
      options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.colorType) === -1) {
        throw new Error(
          "option color type:" + options.colorType + " is not supported at present"
        );
      }
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.inputColorType) === -1) {
        throw new Error(
          "option input color type:" + options.inputColorType + " is not supported at present"
        );
      }
      if (options.bitDepth !== 8 && options.bitDepth !== 16) {
        throw new Error(
          "option bit depth:" + options.bitDepth + " is not supported at present"
        );
      }
    };
    Packer.prototype.getDeflateOptions = function() {
      return {
        chunkSize: this._options.deflateChunkSize,
        level: this._options.deflateLevel,
        strategy: this._options.deflateStrategy
      };
    };
    Packer.prototype.createDeflate = function() {
      return this._options.deflateFactory(this.getDeflateOptions());
    };
    Packer.prototype.filterData = function(data, width, height) {
      let packedData = bitPacker(data, width, height, this._options);
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
      let filteredData = filter(packedData, width, height, this._options, bpp);
      return filteredData;
    };
    Packer.prototype._packChunk = function(type, data) {
      let len = data ? data.length : 0;
      let buf = Buffer.alloc(len + 12);
      buf.writeUInt32BE(len, 0);
      buf.writeUInt32BE(type, 4);
      if (data) {
        data.copy(buf, 8);
      }
      buf.writeInt32BE(
        CrcStream.crc32(buf.slice(4, buf.length - 4)),
        buf.length - 4
      );
      return buf;
    };
    Packer.prototype.packGAMA = function(gamma) {
      let buf = Buffer.alloc(4);
      buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
      return this._packChunk(constants.TYPE_gAMA, buf);
    };
    Packer.prototype.packIHDR = function(width, height) {
      let buf = Buffer.alloc(13);
      buf.writeUInt32BE(width, 0);
      buf.writeUInt32BE(height, 4);
      buf[8] = this._options.bitDepth;
      buf[9] = this._options.colorType;
      buf[10] = 0;
      buf[11] = 0;
      buf[12] = 0;
      return this._packChunk(constants.TYPE_IHDR, buf);
    };
    Packer.prototype.packIDAT = function(data) {
      return this._packChunk(constants.TYPE_IDAT, data);
    };
    Packer.prototype.packIEND = function() {
      return this._packChunk(constants.TYPE_IEND, null);
    };
  }
});

// node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS({
  "node_modules/pngjs/lib/packer-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var constants = require_constants();
    var Packer = require_packer();
    var PackerAsync = module2.exports = function(opt) {
      Stream.call(this);
      let options = opt || {};
      this._packer = new Packer(options);
      this._deflate = this._packer.createDeflate();
      this.readable = true;
    };
    util.inherits(PackerAsync, Stream);
    PackerAsync.prototype.pack = function(data, width, height, gamma) {
      this.emit("data", Buffer.from(constants.PNG_SIGNATURE));
      this.emit("data", this._packer.packIHDR(width, height));
      if (gamma) {
        this.emit("data", this._packer.packGAMA(gamma));
      }
      let filteredData = this._packer.filterData(data, width, height);
      this._deflate.on("error", this.emit.bind(this, "error"));
      this._deflate.on(
        "data",
        function(compressedData) {
          this.emit("data", this._packer.packIDAT(compressedData));
        }.bind(this)
      );
      this._deflate.on(
        "end",
        function() {
          this.emit("data", this._packer.packIEND());
          this.emit("end");
        }.bind(this)
      );
      this._deflate.end(filteredData);
    };
  }
});

// node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS({
  "node_modules/pngjs/lib/sync-inflate.js"(exports2, module2) {
    "use strict";
    var assert = require("assert").ok;
    var zlib = require("zlib");
    var util = require("util");
    var kMaxLength = require("buffer").kMaxLength;
    function Inflate(opts) {
      if (!(this instanceof Inflate)) {
        return new Inflate(opts);
      }
      if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
        opts.chunkSize = zlib.Z_MIN_CHUNK;
      }
      zlib.Inflate.call(this, opts);
      this._offset = this._offset === void 0 ? this._outOffset : this._offset;
      this._buffer = this._buffer || this._outBuffer;
      if (opts && opts.maxLength != null) {
        this._maxLength = opts.maxLength;
      }
    }
    function createInflate(opts) {
      return new Inflate(opts);
    }
    function _close(engine, callback) {
      if (callback) {
        process.nextTick(callback);
      }
      if (!engine._handle) {
        return;
      }
      engine._handle.close();
      engine._handle = null;
    }
    Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
      if (typeof asyncCb === "function") {
        return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
      }
      let self = this;
      let availInBefore = chunk && chunk.length;
      let availOutBefore = this._chunkSize - this._offset;
      let leftToInflate = this._maxLength;
      let inOff = 0;
      let buffers = [];
      let nread = 0;
      let error;
      this.on("error", function(err) {
        error = err;
      });
      function handleChunk(availInAfter, availOutAfter) {
        if (self._hadError) {
          return;
        }
        let have = availOutBefore - availOutAfter;
        assert(have >= 0, "have should not go down");
        if (have > 0) {
          let out = self._buffer.slice(self._offset, self._offset + have);
          self._offset += have;
          if (out.length > leftToInflate) {
            out = out.slice(0, leftToInflate);
          }
          buffers.push(out);
          nread += out.length;
          leftToInflate -= out.length;
          if (leftToInflate === 0) {
            return false;
          }
        }
        if (availOutAfter === 0 || self._offset >= self._chunkSize) {
          availOutBefore = self._chunkSize;
          self._offset = 0;
          self._buffer = Buffer.allocUnsafe(self._chunkSize);
        }
        if (availOutAfter === 0) {
          inOff += availInBefore - availInAfter;
          availInBefore = availInAfter;
          return true;
        }
        return false;
      }
      assert(this._handle, "zlib binding closed");
      let res;
      do {
        res = this._handle.writeSync(
          flushFlag,
          chunk,
          // in
          inOff,
          // in_off
          availInBefore,
          // in_len
          this._buffer,
          // out
          this._offset,
          //out_off
          availOutBefore
        );
        res = res || this._writeState;
      } while (!this._hadError && handleChunk(res[0], res[1]));
      if (this._hadError) {
        throw error;
      }
      if (nread >= kMaxLength) {
        _close(this);
        throw new RangeError(
          "Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes"
        );
      }
      let buf = Buffer.concat(buffers, nread);
      _close(this);
      return buf;
    };
    util.inherits(Inflate, zlib.Inflate);
    function zlibBufferSync(engine, buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer);
      }
      if (!(buffer instanceof Buffer)) {
        throw new TypeError("Not a string or buffer");
      }
      let flushFlag = engine._finishFlushFlag;
      if (flushFlag == null) {
        flushFlag = zlib.Z_FINISH;
      }
      return engine._processChunk(buffer, flushFlag);
    }
    function inflateSync(buffer, opts) {
      return zlibBufferSync(new Inflate(opts), buffer);
    }
    module2.exports = exports2 = inflateSync;
    exports2.Inflate = Inflate;
    exports2.createInflate = createInflate;
    exports2.inflateSync = inflateSync;
  }
});

// node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS({
  "node_modules/pngjs/lib/sync-reader.js"(exports2, module2) {
    "use strict";
    var SyncReader = module2.exports = function(buffer) {
      this._buffer = buffer;
      this._reads = [];
    };
    SyncReader.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
    };
    SyncReader.prototype.process = function() {
      while (this._reads.length > 0 && this._buffer.length) {
        let read = this._reads[0];
        if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
          this._reads.shift();
          let buf = this._buffer;
          this._buffer = buf.slice(read.length);
          read.func.call(this, buf.slice(0, read.length));
        } else {
          break;
        }
      }
      if (this._reads.length > 0) {
        throw new Error("There are some read requests waitng on finished stream");
      }
      if (this._buffer.length > 0) {
        throw new Error("unrecognised content at end of stream");
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS({
  "node_modules/pngjs/lib/filter-parse-sync.js"(exports2) {
    "use strict";
    var SyncReader = require_sync_reader();
    var Filter = require_filter_parse();
    exports2.process = function(inBuffer, bitmapInfo) {
      let outBuffers = [];
      let reader = new SyncReader(inBuffer);
      let filter = new Filter(bitmapInfo, {
        read: reader.read.bind(reader),
        write: function(bufferPart) {
          outBuffers.push(bufferPart);
        },
        complete: function() {
        }
      });
      filter.start();
      reader.process();
      return Buffer.concat(outBuffers);
    };
  }
});

// node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS({
  "node_modules/pngjs/lib/parser-sync.js"(exports2, module2) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = require("zlib");
    var inflateSync = require_sync_inflate();
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var SyncReader = require_sync_reader();
    var FilterSync = require_filter_parse_sync();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    module2.exports = function(buffer, options) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let err;
      function handleError(_err_) {
        err = _err_;
      }
      let metaData;
      function handleMetaData(_metaData_) {
        metaData = _metaData_;
      }
      function handleTransColor(transColor) {
        metaData.transColor = transColor;
      }
      function handlePalette(palette) {
        metaData.palette = palette;
      }
      function handleSimpleTransparency() {
        metaData.alpha = true;
      }
      let gamma;
      function handleGamma(_gamma_) {
        gamma = _gamma_;
      }
      let inflateDataList = [];
      function handleInflateData(inflatedData2) {
        inflateDataList.push(inflatedData2);
      }
      let reader = new SyncReader(buffer);
      let parser = new Parser(options, {
        read: reader.read.bind(reader),
        error: handleError,
        metadata: handleMetaData,
        gamma: handleGamma,
        palette: handlePalette,
        transColor: handleTransColor,
        inflateData: handleInflateData,
        simpleTransparency: handleSimpleTransparency
      });
      parser.start();
      reader.process();
      if (err) {
        throw err;
      }
      let inflateData = Buffer.concat(inflateDataList);
      inflateDataList.length = 0;
      let inflatedData;
      if (metaData.interlace) {
        inflatedData = zlib.inflateSync(inflateData);
      } else {
        let rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
        let imageSize = rowSize * metaData.height;
        inflatedData = inflateSync(inflateData, {
          chunkSize: imageSize,
          maxLength: imageSize
        });
      }
      inflateData = null;
      if (!inflatedData || !inflatedData.length) {
        throw new Error("bad png - invalid inflate data response");
      }
      let unfilteredData = FilterSync.process(inflatedData, metaData);
      inflateData = null;
      let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
      unfilteredData = null;
      let normalisedBitmapData = formatNormaliser(
        bitmapData,
        metaData,
        options.skipRescale
      );
      metaData.data = normalisedBitmapData;
      metaData.gamma = gamma || 0;
      return metaData;
    };
  }
});

// node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS({
  "node_modules/pngjs/lib/packer-sync.js"(exports2, module2) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = require("zlib");
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var constants = require_constants();
    var Packer = require_packer();
    module2.exports = function(metaData, opt) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let options = opt || {};
      let packer = new Packer(options);
      let chunks = [];
      chunks.push(Buffer.from(constants.PNG_SIGNATURE));
      chunks.push(packer.packIHDR(metaData.width, metaData.height));
      if (metaData.gamma) {
        chunks.push(packer.packGAMA(metaData.gamma));
      }
      let filteredData = packer.filterData(
        metaData.data,
        metaData.width,
        metaData.height
      );
      let compressedData = zlib.deflateSync(
        filteredData,
        packer.getDeflateOptions()
      );
      filteredData = null;
      if (!compressedData || !compressedData.length) {
        throw new Error("bad png - invalid compressed data response");
      }
      chunks.push(packer.packIDAT(compressedData));
      chunks.push(packer.packIEND());
      return Buffer.concat(chunks);
    };
  }
});

// node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS({
  "node_modules/pngjs/lib/png-sync.js"(exports2) {
    "use strict";
    var parse = require_parser_sync();
    var pack = require_packer_sync();
    exports2.read = function(buffer, options) {
      return parse(buffer, options || {});
    };
    exports2.write = function(png, options) {
      return pack(png, options);
    };
  }
});

// node_modules/pngjs/lib/png.js
var require_png = __commonJS({
  "node_modules/pngjs/lib/png.js"(exports2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var Parser = require_parser_async();
    var Packer = require_packer_async();
    var PNGSync = require_png_sync();
    var PNG2 = exports2.PNG = function(options) {
      Stream.call(this);
      options = options || {};
      this.width = options.width | 0;
      this.height = options.height | 0;
      this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
      if (options.fill && this.data) {
        this.data.fill(0);
      }
      this.gamma = 0;
      this.readable = this.writable = true;
      this._parser = new Parser(options);
      this._parser.on("error", this.emit.bind(this, "error"));
      this._parser.on("close", this._handleClose.bind(this));
      this._parser.on("metadata", this._metadata.bind(this));
      this._parser.on("gamma", this._gamma.bind(this));
      this._parser.on(
        "parsed",
        function(data) {
          this.data = data;
          this.emit("parsed", data);
        }.bind(this)
      );
      this._packer = new Packer(options);
      this._packer.on("data", this.emit.bind(this, "data"));
      this._packer.on("end", this.emit.bind(this, "end"));
      this._parser.on("close", this._handleClose.bind(this));
      this._packer.on("error", this.emit.bind(this, "error"));
    };
    util.inherits(PNG2, Stream);
    PNG2.sync = PNGSync;
    PNG2.prototype.pack = function() {
      if (!this.data || !this.data.length) {
        this.emit("error", "No data provided");
        return this;
      }
      process.nextTick(
        function() {
          this._packer.pack(this.data, this.width, this.height, this.gamma);
        }.bind(this)
      );
      return this;
    };
    PNG2.prototype.parse = function(data, callback) {
      if (callback) {
        let onParsed, onError;
        onParsed = function(parsedData) {
          this.removeListener("error", onError);
          this.data = parsedData;
          callback(null, this);
        }.bind(this);
        onError = function(err) {
          this.removeListener("parsed", onParsed);
          callback(err, null);
        }.bind(this);
        this.once("parsed", onParsed);
        this.once("error", onError);
      }
      this.end(data);
      return this;
    };
    PNG2.prototype.write = function(data) {
      this._parser.write(data);
      return true;
    };
    PNG2.prototype.end = function(data) {
      this._parser.end(data);
    };
    PNG2.prototype._metadata = function(metadata) {
      this.width = metadata.width;
      this.height = metadata.height;
      this.emit("metadata", metadata);
    };
    PNG2.prototype._gamma = function(gamma) {
      this.gamma = gamma;
    };
    PNG2.prototype._handleClose = function() {
      if (!this._parser.writable && !this._packer.readable) {
        this.emit("close");
      }
    };
    PNG2.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
      srcX |= 0;
      srcY |= 0;
      width |= 0;
      height |= 0;
      deltaX |= 0;
      deltaY |= 0;
      if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
        throw new Error("bitblt reading outside image");
      }
      if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
        throw new Error("bitblt writing outside image");
      }
      for (let y = 0; y < height; y++) {
        src.data.copy(
          dst.data,
          (deltaY + y) * dst.width + deltaX << 2,
          (srcY + y) * src.width + srcX << 2,
          (srcY + y) * src.width + srcX + width << 2
        );
      }
    };
    PNG2.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
      PNG2.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
      return this;
    };
    PNG2.adjustGamma = function(src) {
      if (src.gamma) {
        for (let y = 0; y < src.height; y++) {
          for (let x = 0; x < src.width; x++) {
            let idx = src.width * y + x << 2;
            for (let i = 0; i < 3; i++) {
              let sample = src.data[idx + i] / 255;
              sample = Math.pow(sample, 1 / 2.2 / src.gamma);
              src.data[idx + i] = Math.round(sample * 255);
            }
          }
        }
        src.gamma = 0;
      }
    };
    PNG2.prototype.adjustGamma = function() {
      PNG2.adjustGamma(this);
    };
  }
});

// server/src/cli.ts
var path12 = __toESM(require("path"));

// server/src/agentRuntime.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));

// core/src/constants.ts
var HOOK_API_PREFIX = "/api/hooks";
var SERVER_JSON_DIR = ".pixel-agents";
var SERVER_JSON_NAME = "server.json";
var HOOK_SCRIPTS_DIR = ".pixel-agents/hooks";
var BASH_COMMAND_DISPLAY_MAX_LENGTH = 30;
var TASK_DESCRIPTION_DISPLAY_MAX_LENGTH = 40;

// server/src/constants.ts
var FILE_WATCHER_POLL_INTERVAL_MS = 500;
var PROJECT_SCAN_INTERVAL_MS = 1e3;
var TOOL_DONE_DELAY_MS = 300;
var PERMISSION_TIMER_DELAY_MS = 7e3;
var TEXT_IDLE_DELAY_MS = 5e3;
var CLEAR_IDLE_THRESHOLD_MS = 2e3;
var EXTERNAL_SCAN_INTERVAL_MS = 3e3;
var EXTERNAL_ACTIVE_THRESHOLD_MS = 12e4;
var EXTERNAL_STALE_CHECK_INTERVAL_MS = 3e4;
var DISMISSED_COOLDOWN_MS = 18e4;
var GLOBAL_SCAN_ACTIVE_MIN_SIZE = 3072;
var GLOBAL_SCAN_ACTIVE_MAX_AGE_MS = 6e5;
var HOOK_EVENT_BUFFER_MS = 5e3;
var SESSION_END_GRACE_MS = 2e3;
var MAX_HOOK_BODY_SIZE = 65536;
var LAYOUT_FILE_DIR = ".pixel-agents";
var LAYOUT_FILE_NAME = "layout.json";
var LAYOUT_REVISION_KEY = "layoutRevision";
var CONFIG_FILE_NAME = "config.json";

// server/src/dismissalTracker.ts
var DismissalTracker = class {
  /** Files temporarily dismissed by the user (closed via X). Keyed by path, value is
   *  the dismissal timestamp. Entries auto-expire after DISMISSED_COOLDOWN_MS. */
  dismissed = /* @__PURE__ */ new Map();
  /** Files permanently dismissed by /clear reassignment. Never re-adopted in this session. */
  permanent = /* @__PURE__ */ new Set();
  /** Mtime at seeding time (extension startup). If the actual mtime changes later,
   *  the file was resumed (--resume) and should be released from tracking. */
  seeded = /* @__PURE__ */ new Map();
  /** /clear files waiting for a second scan tick before adoption. Gives the per-agent
   *  /clear detection loop time to claim the file first. */
  pending = /* @__PURE__ */ new Map();
  // ── Temporary dismissals (user-close via X, 3-minute cooldown) ──────
  /** Dismiss a file temporarily. Accepts an optional timestamp for testing. */
  dismiss(path13, timestamp = Date.now()) {
    this.dismissed.set(path13, timestamp);
  }
  /** Explicitly clear a temporary dismissal (e.g. on --resume). */
  clearDismissal(path13) {
    this.dismissed.delete(path13);
  }
  /** True if the file is temporarily dismissed AND still within the cooldown window.
   *  Auto-cleans expired entries (returns false and deletes the stale map entry). */
  isDismissed(path13) {
    const timestamp = this.dismissed.get(path13);
    if (timestamp === void 0) return false;
    if (Date.now() - timestamp < DISMISSED_COOLDOWN_MS) return true;
    this.dismissed.delete(path13);
    return false;
  }
  // ── Permanent dismissals (/clear reassignment) ──────────────────────
  /** Permanently dismiss a file. Used by /clear reassignment so the old file
   *  is never re-adopted as an external session. */
  permanentlyDismiss(path13) {
    this.permanent.add(path13);
  }
  isPermanentlyDismissed(path13) {
    return this.permanent.has(path13);
  }
  // ── Seeded mtimes (startup snapshot for --resume detection) ─────────
  seedMtime(path13, mtime) {
    this.seeded.set(path13, mtime);
  }
  getSeededMtime(path13) {
    return this.seeded.get(path13);
  }
  clearSeededMtime(path13) {
    this.seeded.delete(path13);
  }
  hasSeededMtime(path13) {
    return this.seeded.has(path13);
  }
  // ── Pending /clear files (two-tick delay) ───────────────────────────
  registerPendingClear(path13, timestamp = Date.now()) {
    this.pending.set(path13, timestamp);
  }
  hasPendingClear(path13) {
    return this.pending.has(path13);
  }
  clearPendingClear(path13) {
    this.pending.delete(path13);
  }
  // ── Reset (tests + dispose) ─────────────────────────────────────────
  resetAll() {
    this.dismissed.clear();
    this.permanent.clear();
    this.seeded.clear();
    this.pending.clear();
  }
};

// server/src/fileWatcher.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// server/src/timerManager.ts
function clearAgentActivity(agent, agentId, agents, permissionTimers) {
  if (!agent) return;
  if (agent.backgroundAgentToolIds.size > 0) {
    for (const toolId of agent.activeToolIds) {
      if (agent.backgroundAgentToolIds.has(toolId)) continue;
      agent.activeToolIds.delete(toolId);
      agent.activeToolStatuses.delete(toolId);
      agent.activeToolNames.delete(toolId);
      agent.activeSubagentToolIds.delete(toolId);
      agent.activeSubagentToolNames.delete(toolId);
    }
  } else {
    agent.activeToolIds.clear();
    agent.activeToolStatuses.clear();
    agent.activeToolNames.clear();
    agent.activeSubagentToolIds.clear();
    agent.activeSubagentToolNames.clear();
  }
  agent.isWaiting = false;
  agent.permissionSent = false;
  cancelPermissionTimer(agentId, permissionTimers);
  agents.broadcast({ type: "agentToolsClear", id: agentId });
  for (const toolId of agent.backgroundAgentToolIds) {
    const status = agent.activeToolStatuses.get(toolId);
    if (status) {
      agents.broadcast({
        type: "agentToolStart",
        id: agentId,
        toolId,
        status
      });
    }
  }
  agents.broadcast({ type: "agentStatus", id: agentId, status: "active" });
}
function cancelWaitingTimer(agentId, waitingTimers) {
  const timer = waitingTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    waitingTimers.delete(agentId);
  }
}
function startWaitingTimer(agentId, delayMs, agents, waitingTimers) {
  cancelWaitingTimer(agentId, waitingTimers);
  const timer = setTimeout(() => {
    waitingTimers.delete(agentId);
    const agent = agents.get(agentId);
    if (agent) {
      agent.isWaiting = true;
    }
    agents.broadcast({
      type: "agentStatus",
      id: agentId,
      status: "waiting",
      // Heuristic text-idle timer: the turn ended without a clear idle signal,
      // so this is "Done", not "Waiting for input".
      awaitingInput: false
    });
  }, delayMs);
  waitingTimers.set(agentId, timer);
}
function cancelPermissionTimer(agentId, permissionTimers) {
  const timer = permissionTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    permissionTimers.delete(agentId);
  }
}
function startPermissionTimer(agentId, agents, permissionTimers, permissionExemptTools) {
  cancelPermissionTimer(agentId, permissionTimers);
  const timer = setTimeout(() => {
    permissionTimers.delete(agentId);
    const agent = agents.get(agentId);
    if (!agent) return;
    let hasNonExempt = false;
    for (const toolId of agent.activeToolIds) {
      const toolName = agent.activeToolNames.get(toolId);
      if (!permissionExemptTools.has(toolName || "")) {
        hasNonExempt = true;
        break;
      }
    }
    const stuckSubagentParentToolIds = [];
    for (const [parentToolId, subToolNames] of agent.activeSubagentToolNames) {
      for (const [, toolName] of subToolNames) {
        if (!permissionExemptTools.has(toolName)) {
          stuckSubagentParentToolIds.push(parentToolId);
          hasNonExempt = true;
          break;
        }
      }
    }
    if (hasNonExempt) {
      agent.permissionSent = true;
      console.log(`[Pixel Agents] Timer: Agent ${agentId} - possible permission wait detected`);
      agents.broadcast({
        type: "agentToolPermission",
        id: agentId
      });
      for (const parentToolId of stuckSubagentParentToolIds) {
        agents.broadcast({
          type: "subagentToolPermission",
          id: agentId,
          parentToolId
        });
      }
    }
  }, PERMISSION_TIMER_DELAY_MS);
  permissionTimers.set(agentId, timer);
}

// server/src/teamUtils.ts
function isInlineTeammateOf(agent, leadId) {
  return agent.leadAgentId === leadId && !agent.teamUsesTmux;
}
function getInlineTeammates(leadId, agents) {
  const out = [];
  for (const [id, a] of agents) {
    if (isInlineTeammateOf(a, leadId)) out.push([id, a]);
  }
  return out;
}
function hasInlineTeammates(leadId, agents) {
  for (const a of agents.values()) {
    if (isInlineTeammateOf(a, leadId)) return true;
  }
  return false;
}

// server/src/transcriptParser.ts
var debug = process.env.PIXEL_AGENTS_DEBUG !== "0";
var EMPTY_EXEMPT_TOOLS = /* @__PURE__ */ new Set();
var hookProvider = null;
function exemptTools() {
  return hookProvider?.permissionExemptTools ?? EMPTY_EXEMPT_TOOLS;
}
function isSubagentTool(toolName) {
  if (!toolName || !hookProvider) return false;
  return hookProvider.subagentToolNames.has(toolName);
}
function setHookProvider(provider) {
  hookProvider = provider;
}
function formatToolStatus(toolName, input) {
  return hookProvider?.formatToolStatus(toolName, input) ?? `Using ${toolName}`;
}
function processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers) {
  const agent = agents.get(agentId);
  if (!agent) return;
  agent.lastDataAt = Date.now();
  agent.linesProcessed++;
  try {
    const record = JSON.parse(line);
    const teamMeta = hookProvider?.team?.extractTeamMetadataFromRecord(record);
    if (teamMeta?.teamName && teamMeta.teamName !== agent.teamName) {
      agent.teamName = teamMeta.teamName;
      agent.agentName = teamMeta.agentName;
      agent.isTeamLead = void 0;
      agent.leadAgentId = void 0;
      if (debug) {
        console.log(
          `[Pixel Agents] Agent ${agentId} team metadata: team=${agent.teamName}, role=${agent.agentName ?? "lead"}`
        );
      }
      linkTeammates(agentId, agent, agents);
      agents.broadcast({
        type: "agentTeamInfo",
        id: agentId,
        teamName: agent.teamName,
        agentName: agent.agentName,
        isTeamLead: agent.isTeamLead,
        leadAgentId: agent.leadAgentId
      });
    }
    const usage = record.message?.usage;
    if (usage) {
      if (typeof usage.input_tokens === "number") {
        agent.inputTokens += usage.input_tokens;
      }
      if (typeof usage.output_tokens === "number") {
        agent.outputTokens += usage.output_tokens;
      }
      agents.broadcast({
        type: "agentTokenUsage",
        id: agentId,
        inputTokens: agent.inputTokens,
        outputTokens: agent.outputTokens
      });
    }
    const assistantContent = record.message?.content ?? record.content;
    if (record.type === "assistant" && Array.isArray(assistantContent)) {
      const blocks = assistantContent;
      const hasToolUse = blocks.some((b) => b.type === "tool_use");
      if (hasToolUse) {
        cancelWaitingTimer(agentId, waitingTimers);
        agent.isWaiting = false;
        agent.hadToolsInTurn = true;
        agents.broadcast({ type: "agentStatus", id: agentId, status: "active" });
        let hasNonExemptTool = false;
        for (const block of blocks) {
          if (block.type === "tool_use" && block.id) {
            const toolName = block.name || "";
            const status = formatToolStatus(toolName, block.input || {});
            console.log(
              `[Pixel Agents] JSONL: Agent ${agentId} - tool start: ${block.id} ${status}`
            );
            agent.activeToolIds.add(block.id);
            agent.activeToolStatuses.set(block.id, status);
            agent.activeToolNames.set(block.id, toolName);
            if (!exemptTools().has(toolName)) {
              hasNonExemptTool = true;
            }
            if (agent.teamName && hookProvider?.team?.isTeammateSpawnCall(toolName, block.input ?? {}) && !agent.teamUsesTmux) {
              agent.teamUsesTmux = true;
              agents.broadcast({
                type: "agentTeamInfo",
                id: agentId,
                teamName: agent.teamName,
                agentName: agent.agentName,
                isTeamLead: agent.isTeamLead,
                leadAgentId: agent.leadAgentId,
                teamUsesTmux: true
              });
              for (const [id, teammate] of agents) {
                if (id === agentId || teammate.leadAgentId !== agentId) continue;
                teammate.teamUsesTmux = true;
                agents.broadcast({
                  type: "agentTeamInfo",
                  id,
                  teamName: teammate.teamName,
                  agentName: teammate.agentName,
                  isTeamLead: teammate.isTeamLead,
                  leadAgentId: teammate.leadAgentId,
                  teamUsesTmux: true
                });
              }
            }
            const isSubagentSpawn = isSubagentTool(toolName);
            const useJsonlToolEvents = agent.hookDelivered && hasInlineTeammates(agentId, agents);
            if (!agent.hookDelivered || useJsonlToolEvents || isSubagentSpawn) {
              const runInBackground = isSubagentSpawn && block.input?.run_in_background === true;
              agents.broadcast({
                type: "agentToolStart",
                id: agentId,
                toolId: block.id,
                status,
                toolName,
                permissionActive: agent.permissionSent,
                runInBackground
              });
            }
          }
        }
        if (hasNonExemptTool && !agent.hookDelivered && !agent.leadAgentId) {
          startPermissionTimer(agentId, agents, permissionTimers, exemptTools());
        }
      } else if (blocks.some((b) => b.type === "text") && !agent.hadToolsInTurn) {
        if (!agent.hookDelivered) {
          startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers);
        }
      }
    } else if (record.type === "assistant" && typeof assistantContent === "string") {
      if (!agent.hadToolsInTurn && !agent.hookDelivered) {
        startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers);
      }
    } else if (record.type === "assistant" && assistantContent === void 0) {
      console.warn(
        `[Pixel Agents] Agent ${agentId}: assistant record has no content. Keys: ${Object.keys(record).join(", ")}`
      );
    } else if (record.type === "progress") {
      processProgressRecord(agentId, record, agents, waitingTimers, permissionTimers);
    } else if (record.type === "user") {
      const content = record.message?.content ?? record.content;
      if (Array.isArray(content)) {
        const blocks = content;
        const hasToolResult = blocks.some((b) => b.type === "tool_result");
        if (hasToolResult) {
          for (const block of blocks) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const completedToolId = block.tool_use_id;
              const completedToolName = agent.activeToolNames.get(completedToolId);
              if (isSubagentTool(completedToolName) && isAsyncAgentResult(block)) {
                console.log(
                  `[Pixel Agents] Agent ${agentId} background agent launched: ${completedToolId}`
                );
                agent.backgroundAgentToolIds.add(completedToolId);
                continue;
              }
              console.log(
                `[Pixel Agents] JSONL: Agent ${agentId} - tool done: ${block.tool_use_id}`
              );
              if (isSubagentTool(completedToolName)) {
                agent.activeSubagentToolIds.delete(completedToolId);
                agent.activeSubagentToolNames.delete(completedToolId);
                agents.broadcast({
                  type: "subagentClear",
                  id: agentId,
                  parentToolId: completedToolId
                });
              }
              agent.activeToolIds.delete(completedToolId);
              agent.activeToolStatuses.delete(completedToolId);
              agent.activeToolNames.delete(completedToolId);
              const isCompletedAgentTool = completedToolName === "Task" || completedToolName === "Agent";
              const useJsonlToolEvents = agent.hookDelivered && hasInlineTeammates(agentId, agents);
              if (!agent.hookDelivered || useJsonlToolEvents || isCompletedAgentTool) {
                const toolId = completedToolId;
                setTimeout(() => {
                  agents.broadcast({
                    type: "agentToolDone",
                    id: agentId,
                    toolId
                  });
                }, TOOL_DONE_DELAY_MS);
              }
            }
          }
          if (agent.activeToolIds.size === 0) {
            agent.hadToolsInTurn = false;
          }
        } else {
          cancelWaitingTimer(agentId, waitingTimers);
          clearAgentActivity(agent, agentId, agents, permissionTimers);
          agent.hadToolsInTurn = false;
        }
      } else if (typeof content === "string" && content.trim()) {
        cancelWaitingTimer(agentId, waitingTimers);
        clearAgentActivity(agent, agentId, agents, permissionTimers);
        agent.hadToolsInTurn = false;
      }
    } else if (record.type === "queue-operation" && record.operation === "enqueue") {
      const content = record.content;
      if (content) {
        const toolIdMatch = content.match(/<tool-use-id>(.*?)<\/tool-use-id>/);
        if (toolIdMatch) {
          const completedToolId = toolIdMatch[1];
          if (agent.backgroundAgentToolIds.has(completedToolId)) {
            console.log(
              `[Pixel Agents] Agent ${agentId} background agent done: ${completedToolId}`
            );
            agent.backgroundAgentToolIds.delete(completedToolId);
            agent.activeSubagentToolIds.delete(completedToolId);
            agent.activeSubagentToolNames.delete(completedToolId);
            agents.broadcast({
              type: "subagentClear",
              id: agentId,
              parentToolId: completedToolId
            });
            agent.activeToolIds.delete(completedToolId);
            agent.activeToolStatuses.delete(completedToolId);
            agent.activeToolNames.delete(completedToolId);
            if (!agent.hookDelivered) {
              const toolId = completedToolId;
              setTimeout(() => {
                agents.broadcast({
                  type: "agentToolDone",
                  id: agentId,
                  toolId
                });
              }, TOOL_DONE_DELAY_MS);
            }
          }
        }
      }
    } else if (record.type === "system" && record.subtype === "turn_duration") {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);
      const hasForegroundTools = agent.activeToolIds.size > agent.backgroundAgentToolIds.size;
      if (hasForegroundTools) {
        for (const toolId of agent.activeToolIds) {
          if (agent.backgroundAgentToolIds.has(toolId)) continue;
          agent.activeToolIds.delete(toolId);
          agent.activeToolStatuses.delete(toolId);
          const toolName = agent.activeToolNames.get(toolId);
          agent.activeToolNames.delete(toolId);
          if (isSubagentTool(toolName)) {
            agent.activeSubagentToolIds.delete(toolId);
            agent.activeSubagentToolNames.delete(toolId);
          }
        }
        if (!agent.hookDelivered) {
          agents.broadcast({ type: "agentToolsClear", id: agentId });
        }
        for (const toolId of agent.backgroundAgentToolIds) {
          const status = agent.activeToolStatuses.get(toolId);
          if (status) {
            agents.broadcast({
              type: "agentToolStart",
              id: agentId,
              toolId,
              status
            });
          }
        }
      } else if (agent.activeToolIds.size > 0 && agent.backgroundAgentToolIds.size === 0) {
        agent.activeToolIds.clear();
        agent.activeToolStatuses.clear();
        agent.activeToolNames.clear();
        agent.activeSubagentToolIds.clear();
        agent.activeSubagentToolNames.clear();
        if (!agent.hookDelivered) {
          agents.broadcast({ type: "agentToolsClear", id: agentId });
        }
      }
      agent.isWaiting = true;
      agent.permissionSent = false;
      agent.hadToolsInTurn = false;
      if (!agent.hookDelivered) {
        agents.broadcast({
          type: "agentStatus",
          id: agentId,
          status: "waiting",
          // turn_duration = the turn completed, so this is "Done".
          awaitingInput: false
        });
      }
    } else if (record.type && !agent.seenUnknownRecordTypes.has(record.type)) {
      const knownSkippableTypes = /* @__PURE__ */ new Set(["file-history-snapshot", "system", "queue-operation"]);
      if (!knownSkippableTypes.has(record.type)) {
        agent.seenUnknownRecordTypes.add(record.type);
        if (debug) {
          console.log(
            `[Pixel Agents] JSONL: Agent ${agentId} - unrecognized record type '${record.type}'. Keys: ${Object.keys(record).join(", ")}`
          );
        }
      }
    }
  } catch {
  }
}
function processProgressRecord(agentId, record, agents, _waitingTimers, permissionTimers) {
  const agent = agents.get(agentId);
  if (!agent) return;
  const parentToolId = record.parentToolUseID;
  if (!parentToolId) return;
  const data = record.data;
  if (!data) return;
  const dataType = data.type;
  if (dataType === "bash_progress" || dataType === "mcp_progress") {
    if (agent.activeToolIds.has(parentToolId) && !agent.hookDelivered && !agent.leadAgentId) {
      startPermissionTimer(agentId, agents, permissionTimers, exemptTools());
    }
    return;
  }
  const parentToolName = agent.activeToolNames.get(parentToolId);
  if (!isSubagentTool(parentToolName)) return;
  const msg = data.message;
  if (!msg) return;
  const msgType = msg.type;
  const innerMsg = msg.message;
  const content = innerMsg?.content;
  if (!Array.isArray(content)) return;
  if (msgType === "assistant") {
    let hasNonExemptSubTool = false;
    for (const block of content) {
      if (block.type === "tool_use" && block.id) {
        const toolName = block.name || "";
        const status = formatToolStatus(toolName, block.input || {});
        console.log(
          `[Pixel Agents] Agent ${agentId} subagent tool start: ${block.id} ${status} (parent: ${parentToolId})`
        );
        let subTools = agent.activeSubagentToolIds.get(parentToolId);
        if (!subTools) {
          subTools = /* @__PURE__ */ new Set();
          agent.activeSubagentToolIds.set(parentToolId, subTools);
        }
        subTools.add(block.id);
        let subNames = agent.activeSubagentToolNames.get(parentToolId);
        if (!subNames) {
          subNames = /* @__PURE__ */ new Map();
          agent.activeSubagentToolNames.set(parentToolId, subNames);
        }
        subNames.set(block.id, toolName);
        if (!exemptTools().has(toolName)) {
          hasNonExemptSubTool = true;
        }
        agents.broadcast({
          type: "subagentToolStart",
          id: agentId,
          parentToolId,
          toolId: block.id,
          status
        });
      }
    }
    if (hasNonExemptSubTool && !agent.hookDelivered) {
      startPermissionTimer(agentId, agents, permissionTimers, exemptTools());
    }
  } else if (msgType === "user") {
    for (const block of content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        console.log(
          `[Pixel Agents] Agent ${agentId} subagent tool done: ${block.tool_use_id} (parent: ${parentToolId})`
        );
        const subTools = agent.activeSubagentToolIds.get(parentToolId);
        if (subTools) {
          subTools.delete(block.tool_use_id);
        }
        const subNames = agent.activeSubagentToolNames.get(parentToolId);
        if (subNames) {
          subNames.delete(block.tool_use_id);
        }
        const toolId = block.tool_use_id;
        setTimeout(() => {
          agents.broadcast({
            type: "subagentToolDone",
            id: agentId,
            parentToolId,
            toolId
          });
        }, 300);
      }
    }
    let stillHasNonExempt = false;
    for (const [, subNames] of agent.activeSubagentToolNames) {
      for (const [, toolName] of subNames) {
        if (!exemptTools().has(toolName)) {
          stillHasNonExempt = true;
          break;
        }
      }
      if (stillHasNonExempt) break;
    }
    if (stillHasNonExempt && !agent.hookDelivered) {
      startPermissionTimer(agentId, agents, permissionTimers, exemptTools());
    }
  }
}
function linkTeammates(_agentId, agent, agents) {
  const teamName = agent.teamName;
  if (!teamName) return;
  const teamAgents = [];
  for (const a of agents.values()) {
    if (a.teamName === teamName) {
      teamAgents.push(a);
    }
  }
  let lead;
  for (const a of teamAgents) {
    if (!a.agentName) {
      lead = a;
      break;
    }
  }
  if (!lead) {
    for (const a of teamAgents) {
      if (a.isTeamLead) {
        lead = a;
        break;
      }
    }
  }
  if (!lead) {
    lead = teamAgents[0];
  }
  for (const a of teamAgents) {
    if (a.id === lead.id) {
      a.isTeamLead = true;
      a.leadAgentId = void 0;
    } else {
      a.isTeamLead = false;
      a.leadAgentId = lead.id;
    }
  }
}
function isAsyncAgentResult(block) {
  const content = block.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === "object" && item !== null && typeof item.text === "string" && item.text.startsWith(
        "Async agent launched successfully."
      )) {
        return true;
      }
    }
  } else if (typeof content === "string") {
    return content.startsWith("Async agent launched successfully.");
  }
  return false;
}

// server/src/fileWatcher.ts
var debug2 = process.env.PIXEL_AGENTS_DEBUG !== "0";
var dismissalTracker = null;
function setDismissalTracker(tracker) {
  dismissalTracker = tracker;
}
var terminalAdapter = null;
var agentRemovalCallback = null;
function setAgentRemovalCallback(cb) {
  agentRemovalCallback = cb;
}
var clearDetectionDeps = null;
function startFileWatching(agentId, _filePath, agents, _fileWatchers, pollingTimers, waitingTimers, permissionTimers) {
  const interval = setInterval(() => {
    if (!agents.has(agentId)) {
      clearInterval(interval);
      return;
    }
    const agent = agents.get(agentId);
    const prevOffset = agent.fileOffset;
    readNewLines(agentId, agents, waitingTimers, permissionTimers);
    if (!agent.hookDelivered && clearDetectionDeps && agent.fileOffset === prevOffset && agent.terminalRef && !agent.isExternal && ![...agents.values()].some((a) => a.isExternal) && agent.linesProcessed > 0 && clearDetectionDeps.activeAgentIdRef.current === agentId && Date.now() - agent.lastDataAt > CLEAR_IDLE_THRESHOLD_MS) {
      const deps = clearDetectionDeps;
      try {
        const dirFiles = fs.readdirSync(deps.projectDir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(deps.projectDir, f));
        for (const file of dirFiles) {
          if (deps.knownJsonlFiles.has(file)) continue;
          if (dismissalTracker.isDismissed(file)) continue;
          let tracked = false;
          for (const a of agents.values()) {
            if (a.jsonlFile === file) {
              tracked = true;
              break;
            }
          }
          if (tracked) continue;
          try {
            const buf = Buffer.alloc(8192);
            const fd = fs.openSync(file, "r");
            const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
            fs.closeSync(fd);
            if (!buf.toString("utf-8", 0, bytesRead).includes("/clear</command-name>")) continue;
          } catch {
            continue;
          }
          deps.knownJsonlFiles.add(file);
          console.log(
            `[Pixel Agents] Watcher: Agent ${agentId} - /clear detected, reassigning to ${path.basename(file)}`
          );
          reassignAgentToFile(
            agentId,
            file,
            agents,
            deps.fileWatchers,
            deps.pollingTimers,
            deps.waitingTimers,
            deps.permissionTimers,
            deps.persistAgents
          );
          break;
        }
      } catch {
      }
    }
  }, FILE_WATCHER_POLL_INTERVAL_MS);
  pollingTimers.set(agentId, interval);
}
function readNewLines(agentId, agents, waitingTimers, permissionTimers) {
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const stat = fs.statSync(agent.jsonlFile);
    if (stat.size <= agent.fileOffset) return;
    const MAX_READ_BYTES = 65536;
    const bytesToRead = Math.min(stat.size - agent.fileOffset, MAX_READ_BYTES);
    const buf = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(agent.jsonlFile, "r");
    fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
    fs.closeSync(fd);
    agent.fileOffset += bytesToRead;
    const text = agent.lineBuffer + buf.toString("utf-8");
    const lines = text.split("\n");
    agent.lineBuffer = lines.pop() || "";
    const hasLines = lines.some((l) => l.trim());
    if (hasLines) {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);
      if (agent.permissionSent && !agent.hookDelivered && !agent.leadAgentId) {
        agent.permissionSent = false;
        agents.broadcast({ type: "agentToolPermissionClear", id: agentId });
      }
    }
    for (const line of lines) {
      if (!line.trim()) continue;
      processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers);
    }
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return;
    console.log(`[Pixel Agents] Watcher: Agent ${agentId} - read error: ${e}`);
  }
}
var trackedProjectDirs = /* @__PURE__ */ new Set();
function isTrackedProjectDir(dir) {
  if (trackedProjectDirs.has(dir)) return true;
  const resolved = path.resolve(dir).toLowerCase();
  for (const tracked of trackedProjectDirs) {
    if (path.resolve(tracked).toLowerCase() === resolved) return true;
  }
  return false;
}
function ensureProjectScan(projectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, _onAgentCreated, hooksEnabledRef) {
  if (!clearDetectionDeps) {
    clearDetectionDeps = {
      projectDir,
      knownJsonlFiles,
      activeAgentIdRef,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers,
      persistAgents
    };
  }
  try {
    const files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(projectDir, f));
    for (const f of files) {
      knownJsonlFiles.add(f);
      try {
        const stat = fs.statSync(f);
        dismissalTracker.seedMtime(f, stat.mtimeMs);
      } catch {
      }
    }
  } catch {
  }
  trackedProjectDirs.add(projectDir);
  if (projectScanTimerRef.current) return;
  projectScanTimerRef.current = setInterval(() => {
    scanAllTeammateFiles(
      nextAgentIdRef,
      agents,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers,
      persistAgents
    );
    const toRemove = scanTeamConfigsForRemovals(agents);
    for (const id of toRemove) {
      teammateRemovalCallback?.(id);
    }
    if (hooksEnabledRef?.current) return;
    for (const dir of trackedProjectDirs) {
      scanForNewJsonlFiles(
        dir,
        knownJsonlFiles,
        activeAgentIdRef,
        nextAgentIdRef,
        agents,
        fileWatchers,
        pollingTimers,
        waitingTimers,
        permissionTimers,
        persistAgents
      );
    }
  }, PROJECT_SCAN_INTERVAL_MS);
}
function scanForNewJsonlFiles(projectDir, knownJsonlFiles, activeAgentIdRef, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, onAgentCreated) {
  let files;
  try {
    files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(projectDir, f));
  } catch {
    return;
  }
  for (const file of files) {
    if (knownJsonlFiles.has(file)) continue;
    const activeTerminal = terminalAdapter?.activeTerminal();
    if (activeTerminal && hookProvider2?.terminalNamePrefix && activeTerminal.name.startsWith(hookProvider2.terminalNamePrefix)) {
      let owned = false;
      for (const agent of agents.values()) {
        if (agent.terminalRef === activeTerminal) {
          owned = true;
          break;
        }
      }
      if (!owned) {
        knownJsonlFiles.add(file);
        adoptTerminalForFile(
          activeTerminal,
          file,
          projectDir,
          nextAgentIdRef,
          agents,
          activeAgentIdRef,
          fileWatchers,
          pollingTimers,
          waitingTimers,
          permissionTimers,
          persistAgents
        );
      } else {
        for (const terminal of terminalAdapter?.allTerminals() ?? []) {
          if (!hookProvider2?.terminalNamePrefix || !terminal.name.startsWith(hookProvider2.terminalNamePrefix))
            continue;
          let owned2 = false;
          for (const agent of agents.values()) {
            if (agent.terminalRef === terminal) {
              owned2 = true;
              break;
            }
          }
          if (!owned2) {
            knownJsonlFiles.add(file);
            adoptTerminalForFile(
              terminal,
              file,
              projectDir,
              nextAgentIdRef,
              agents,
              activeAgentIdRef,
              fileWatchers,
              pollingTimers,
              waitingTimers,
              permissionTimers,
              persistAgents,
              onAgentCreated
            );
            break;
          }
        }
      }
    }
  }
  for (const [id, agent] of agents) {
    if (agent.isExternal) continue;
    if (agent.terminalRef && agent.terminalRef.exitStatus !== void 0) {
      console.log(`[Pixel Agents] Watcher: Agent ${id} - terminal closed, cleaning up orphan`);
      agentRemovalCallback?.(id);
    }
  }
}
function adoptTerminalForFile(terminal, jsonlFile, projectDir, nextAgentIdRef, agents, activeAgentIdRef, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, onAgentCreated) {
  const id = nextAgentIdRef.current++;
  const sessionId = path.basename(jsonlFile, ".jsonl");
  let fileOffset = 0;
  try {
    const stat = fs.statSync(jsonlFile);
    fileOffset = stat.size;
  } catch {
  }
  const agent = {
    id,
    sessionId,
    terminalRef: terminal,
    isExternal: false,
    projectDir,
    jsonlFile,
    fileOffset,
    lineBuffer: "",
    activeToolIds: /* @__PURE__ */ new Set(),
    activeToolStatuses: /* @__PURE__ */ new Map(),
    activeToolNames: /* @__PURE__ */ new Map(),
    activeSubagentToolIds: /* @__PURE__ */ new Map(),
    activeSubagentToolNames: /* @__PURE__ */ new Map(),
    backgroundAgentToolIds: /* @__PURE__ */ new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    lastDataAt: 0,
    linesProcessed: 0,
    seenUnknownRecordTypes: /* @__PURE__ */ new Set(),
    hookDelivered: false,
    inputTokens: 0,
    outputTokens: 0
  };
  agents.set(id, agent);
  activeAgentIdRef.current = id;
  persistAgents();
  onAgentCreated?.(agent);
  console.log(
    `[Pixel Agents] Watcher: Agent ${id} - adopted terminal "${terminal.name}" for ${path.basename(jsonlFile)}`
  );
  startFileWatching(
    id,
    jsonlFile,
    agents,
    fileWatchers,
    pollingTimers,
    waitingTimers,
    permissionTimers
  );
  readNewLines(id, agents, waitingTimers, permissionTimers);
}
var knownTeammateFiles = /* @__PURE__ */ new Set();
var teammateRemovalCallback = null;
var teamProvider = null;
var hookProvider2 = null;
function setTeammateRemovalCallback(cb) {
  teammateRemovalCallback = cb;
}
function setTeamProvider(provider) {
  teamProvider = provider;
}
function setHookProvider2(provider) {
  hookProvider2 = provider;
}
function scanForTeammateFiles(projectDir, sessionId, parentAgentId, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, onAgentCreated) {
  if (!teamProvider) return;
  const teammates = teamProvider.discoverTeammates(projectDir, sessionId);
  const parentAgent = agents.get(parentAgentId);
  for (const { jsonlPath: file, teammateName } of teammates) {
    if (knownTeammateFiles.has(file)) continue;
    let alreadyTracked = false;
    for (const a of agents.values()) {
      if (a.jsonlFile === file) {
        alreadyTracked = true;
        break;
      }
    }
    if (alreadyTracked) continue;
    knownTeammateFiles.add(file);
    let existingTeammate;
    for (const a of agents.values()) {
      if (a.leadAgentId === parentAgentId && a.agentName === teammateName) {
        existingTeammate = a;
        break;
      }
    }
    if (existingTeammate) {
      if (debug2)
        console.log(
          `[Pixel Agents] Teammate "${teammateName}" already exists (Agent ${existingTeammate.id}), reassigning to ${path.basename(file)}`
        );
      const oldTimer = pollingTimers.get(existingTeammate.id);
      if (oldTimer) clearInterval(oldTimer);
      pollingTimers.delete(existingTeammate.id);
      existingTeammate.jsonlFile = file;
      existingTeammate.fileOffset = 0;
      existingTeammate.lineBuffer = "";
      existingTeammate.lastDataAt = Date.now();
      existingTeammate.linesProcessed = 0;
      existingTeammate.isWaiting = false;
      existingTeammate.teamUsesTmux = parentAgent?.teamUsesTmux;
      startFileWatching(
        existingTeammate.id,
        file,
        agents,
        fileWatchers,
        pollingTimers,
        waitingTimers,
        permissionTimers
      );
      readNewLines(existingTeammate.id, agents, waitingTimers, permissionTimers);
      continue;
    }
    const id = nextAgentIdRef.current++;
    const agent = {
      id,
      sessionId,
      terminalRef: void 0,
      isExternal: true,
      projectDir,
      jsonlFile: file,
      fileOffset: 0,
      lineBuffer: "",
      activeToolIds: /* @__PURE__ */ new Set(),
      activeToolStatuses: /* @__PURE__ */ new Map(),
      activeToolNames: /* @__PURE__ */ new Map(),
      activeSubagentToolIds: /* @__PURE__ */ new Map(),
      activeSubagentToolNames: /* @__PURE__ */ new Map(),
      backgroundAgentToolIds: /* @__PURE__ */ new Set(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
      // Keep hookDelivered false: teammates need JSONL-based tool tracking
      // (agentToolStart messages). Permission events are routed from the lead's
      // hooks via handlePermissionRequest forwarding.
      hookDelivered: false,
      lastDataAt: Date.now(),
      linesProcessed: 0,
      seenUnknownRecordTypes: /* @__PURE__ */ new Set(),
      inputTokens: 0,
      outputTokens: 0,
      // Agent Teams fields
      agentName: teammateName,
      leadAgentId: parentAgentId,
      teamName: parentAgent?.teamName,
      teamUsesTmux: parentAgent?.teamUsesTmux
    };
    agents.set(id, agent);
    persistAgents();
    console.log(
      `[Pixel Agents] Teammate detected: "${teammateName}" (Agent ${id}) for parent Agent ${parentAgentId} (${path.basename(file)})`
    );
    onAgentCreated?.(agent);
    startFileWatching(
      id,
      file,
      agents,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers
    );
    readNewLines(id, agents, waitingTimers, permissionTimers);
  }
}
function scanTeamConfigsForRemovals(agents) {
  const toRemove = [];
  if (!teamProvider) return toRemove;
  const teammatesByTeam = /* @__PURE__ */ new Map();
  for (const [id, agent] of agents) {
    if (agent.leadAgentId === void 0 || agent.teamUsesTmux || !agent.teamName) continue;
    let list = teammatesByTeam.get(agent.teamName);
    if (!list) {
      list = [];
      teammatesByTeam.set(agent.teamName, list);
    }
    list.push({ id, agent });
  }
  for (const [teamName, members] of teammatesByTeam) {
    const memberNames = teamProvider.getTeamMembers(teamName);
    for (const { id, agent } of members) {
      if (memberNames === null) {
        toRemove.push(id);
      } else if (agent.agentName && !memberNames.has(agent.agentName)) {
        toRemove.push(id);
      }
    }
  }
  return toRemove;
}
function scanAllTeammateFiles(nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, onAgentCreated) {
  for (const [agentId, agent] of agents) {
    if (agent.leadAgentId !== void 0) continue;
    if (!agent.sessionId || !agent.projectDir) continue;
    if (!agent.teamName) continue;
    scanForTeammateFiles(
      agent.projectDir,
      agent.sessionId,
      agentId,
      nextAgentIdRef,
      agents,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers,
      persistAgents,
      onAgentCreated
    );
  }
}
function adoptExternalSessionFromHook(sessionId, transcriptPath, cwd, knownJsonlFiles, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, onAgentCreated) {
  if (transcriptPath) {
    for (const agent of agents.values()) {
      if (agent.jsonlFile === transcriptPath) return;
    }
    if (dismissalTracker.isDismissed(transcriptPath)) return;
    if (dismissalTracker.isPermanentlyDismissed(transcriptPath)) return;
    knownJsonlFiles.add(transcriptPath);
    const projectDir = path.dirname(transcriptPath);
    const folderName = folderNameFromProjectDir(path.basename(projectDir));
    adoptExternalSession(
      transcriptPath,
      projectDir,
      nextAgentIdRef,
      agents,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers,
      persistAgents,
      folderName
    );
    const adoptedAgent = [...agents.values()].find((a) => a.jsonlFile === transcriptPath);
    if (adoptedAgent && debug2) {
      console.log(
        `[Pixel Agents] Hook: Agent ${adoptedAgent.id} - detected external session ${path.basename(transcriptPath)}${adoptedAgent.folderName ? ` (${adoptedAgent.folderName})` : ""}`
      );
    }
    if (adoptedAgent) {
      adoptedAgent.sessionId = sessionId;
      adoptedAgent.hookDelivered = true;
      onAgentCreated?.(adoptedAgent);
    }
  } else {
    const id = nextAgentIdRef.current++;
    const folderName = cwd ? path.basename(cwd) : void 0;
    const agent = {
      id,
      sessionId,
      terminalRef: void 0,
      isExternal: true,
      projectDir: cwd,
      jsonlFile: "",
      fileOffset: 0,
      lineBuffer: "",
      activeToolIds: /* @__PURE__ */ new Set(),
      activeToolStatuses: /* @__PURE__ */ new Map(),
      activeToolNames: /* @__PURE__ */ new Map(),
      activeSubagentToolIds: /* @__PURE__ */ new Map(),
      activeSubagentToolNames: /* @__PURE__ */ new Map(),
      backgroundAgentToolIds: /* @__PURE__ */ new Set(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
      hookDelivered: true,
      hooksOnly: true,
      lastDataAt: Date.now(),
      linesProcessed: 0,
      seenUnknownRecordTypes: /* @__PURE__ */ new Set(),
      folderName,
      inputTokens: 0,
      outputTokens: 0
    };
    agents.set(id, agent);
    persistAgents();
    if (debug2) {
      console.log(
        `[Pixel Agents] Hook: Agent ${id} - detected hooks-only external session${folderName ? ` (${folderName})` : ""}`
      );
    }
    onAgentCreated?.(agent);
  }
}
function adoptExternalSession(jsonlFile, projectDir, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents, folderName) {
  const id = nextAgentIdRef.current++;
  let fileOffset = 0;
  try {
    const stat = fs.statSync(jsonlFile);
    const ageMs = stat.birthtimeMs > 0 ? Date.now() - stat.birthtimeMs : Number.POSITIVE_INFINITY;
    const freshnessWindowMs = EXTERNAL_SCAN_INTERVAL_MS * 2;
    fileOffset = ageMs <= freshnessWindowMs ? 0 : stat.size;
  } catch {
  }
  const agent = {
    id,
    sessionId: path.basename(jsonlFile, ".jsonl"),
    terminalRef: void 0,
    isExternal: true,
    projectDir,
    jsonlFile,
    fileOffset,
    lineBuffer: "",
    activeToolIds: /* @__PURE__ */ new Set(),
    activeToolStatuses: /* @__PURE__ */ new Map(),
    activeToolNames: /* @__PURE__ */ new Map(),
    activeSubagentToolIds: /* @__PURE__ */ new Map(),
    activeSubagentToolNames: /* @__PURE__ */ new Map(),
    backgroundAgentToolIds: /* @__PURE__ */ new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    hookDelivered: false,
    lastDataAt: Date.now(),
    linesProcessed: 0,
    seenUnknownRecordTypes: /* @__PURE__ */ new Set(),
    folderName,
    inputTokens: 0,
    outputTokens: 0
  };
  agents.set(id, agent);
  persistAgents();
  startFileWatching(
    id,
    jsonlFile,
    agents,
    fileWatchers,
    pollingTimers,
    waitingTimers,
    permissionTimers
  );
  readNewLines(id, agents, waitingTimers, permissionTimers);
}
function startExternalSessionScanning(_projectDir, knownJsonlFiles, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, _jsonlPollTimers, persistAgents, watchAllSessionsRef, hooksEnabledRef) {
  return setInterval(() => {
    if (!hooksEnabledRef?.current) {
      for (const dir of trackedProjectDirs) {
        scanExternalDir(
          dir,
          knownJsonlFiles,
          nextAgentIdRef,
          agents,
          fileWatchers,
          pollingTimers,
          waitingTimers,
          permissionTimers,
          persistAgents
        );
      }
    }
    if (watchAllSessionsRef?.current) {
      scanGlobalProjectDirs(
        knownJsonlFiles,
        nextAgentIdRef,
        agents,
        fileWatchers,
        pollingTimers,
        waitingTimers,
        permissionTimers,
        persistAgents
      );
    }
  }, EXTERNAL_SCAN_INTERVAL_MS);
}
function scanExternalDir(projectDir, knownJsonlFiles, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents) {
  let files;
  try {
    files = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(projectDir, f));
  } catch {
    return;
  }
  const now = Date.now();
  const hasOrphanedInternal = [...agents.values()].some((a) => {
    if (a.isExternal || a.projectDir !== projectDir) return false;
    try {
      fs.statSync(a.jsonlFile);
      return false;
    } catch {
      return true;
    }
  });
  if (hasOrphanedInternal) return;
  for (const file of files) {
    const seededMtime = dismissalTracker.getSeededMtime(file);
    if (seededMtime !== void 0) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtimeMs > seededMtime) {
          dismissalTracker.clearSeededMtime(file);
          knownJsonlFiles.delete(file);
        }
      } catch {
      }
      continue;
    }
    if (knownJsonlFiles.has(file)) continue;
    if (dismissalTracker.isPermanentlyDismissed(file)) continue;
    if (dismissalTracker.isDismissed(file)) continue;
    const normalizedFile = path.resolve(file);
    let tracked = false;
    for (const agent of agents.values()) {
      if (path.resolve(agent.jsonlFile) === normalizedFile) {
        tracked = true;
        break;
      }
    }
    if (tracked) continue;
    try {
      const stat = fs.statSync(file);
      if (now - stat.mtimeMs > EXTERNAL_ACTIVE_THRESHOLD_MS) continue;
    } catch {
      continue;
    }
    try {
      const buf = Buffer.alloc(8192);
      const fd = fs.openSync(file, "r");
      const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
      fs.closeSync(fd);
      if (buf.toString("utf-8", 0, bytesRead).includes("/clear</command-name>")) {
        if (!dismissalTracker.hasPendingClear(file)) {
          dismissalTracker.registerPendingClear(file);
          continue;
        }
        dismissalTracker.clearPendingClear(file);
      }
    } catch {
      continue;
    }
    knownJsonlFiles.add(file);
    console.log(`[Pixel Agents] Watcher: detected external session ${path.basename(file)}`);
    adoptExternalSession(
      file,
      projectDir,
      nextAgentIdRef,
      agents,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers,
      persistAgents
    );
  }
}
function folderNameFromProjectDir(dirName) {
  const parts = dirName.replace(/^-+/, "").split("-");
  return parts[parts.length - 1] || dirName;
}
function scanGlobalProjectDirs(knownJsonlFiles, nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents) {
  const roots = hookProvider2?.getAllSessionRoots?.() ?? [];
  if (roots.length === 0) return;
  const projectDirs = [];
  for (const root of roots) {
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) projectDirs.push(path.join(root, entry.name));
      }
    } catch {
    }
  }
  const now = Date.now();
  for (const dirPath of projectDirs) {
    if (trackedProjectDirs.has(dirPath)) continue;
    let files;
    try {
      files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dirPath, f));
    } catch {
      continue;
    }
    for (const file of files) {
      if (knownJsonlFiles.has(file)) continue;
      let tracked = false;
      for (const agent of agents.values()) {
        if (agent.jsonlFile === file) {
          tracked = true;
          break;
        }
      }
      if (tracked) continue;
      try {
        const stat = fs.statSync(file);
        if (stat.size < GLOBAL_SCAN_ACTIVE_MIN_SIZE) continue;
        if (now - stat.mtimeMs > GLOBAL_SCAN_ACTIVE_MAX_AGE_MS) continue;
      } catch {
        continue;
      }
      const folderName = folderNameFromProjectDir(path.basename(dirPath));
      knownJsonlFiles.add(file);
      console.log(
        `[Pixel Agents] Watcher: detected global session ${path.basename(file)} (${folderName})`
      );
      adoptExternalSession(
        file,
        dirPath,
        nextAgentIdRef,
        agents,
        fileWatchers,
        pollingTimers,
        waitingTimers,
        permissionTimers,
        persistAgents,
        folderName
      );
    }
  }
}
function startStaleExternalAgentCheck(agents, knownJsonlFiles, hooksEnabledRef) {
  return setInterval(() => {
    if (hooksEnabledRef?.current) return;
    const toRemove = [];
    for (const [id, agent] of agents) {
      if (!agent.isExternal) continue;
      try {
        fs.statSync(agent.jsonlFile);
      } catch {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      const agent = agents.get(id);
      if (agent) {
        knownJsonlFiles.delete(agent.jsonlFile);
      }
      console.log(`[Pixel Agents] Watcher: Agent ${id} - removing stale external agent`);
      agentRemovalCallback?.(id);
    }
  }, EXTERNAL_STALE_CHECK_INTERVAL_MS);
}
function reassignAgentToFile(agentId, newFilePath, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents) {
  const agent = agents.get(agentId);
  if (!agent) return;
  fileWatchers.get(agentId)?.close();
  fileWatchers.delete(agentId);
  const pt = pollingTimers.get(agentId);
  if (pt) {
    clearInterval(pt);
  }
  pollingTimers.delete(agentId);
  cancelWaitingTimer(agentId, waitingTimers);
  cancelPermissionTimer(agentId, permissionTimers);
  clearAgentActivity(agent, agentId, agents, permissionTimers);
  dismissalTracker.permanentlyDismiss(agent.jsonlFile);
  agent.sessionId = path.basename(newFilePath, ".jsonl");
  agent.jsonlFile = newFilePath;
  agent.fileOffset = 0;
  agent.lineBuffer = "";
  persistAgents();
  startFileWatching(
    agentId,
    newFilePath,
    agents,
    fileWatchers,
    pollingTimers,
    waitingTimers,
    permissionTimers
  );
  readNewLines(agentId, agents, waitingTimers, permissionTimers);
}

// server/src/hookEventHandler.ts
var path2 = __toESM(require("path"));
var debug3 = process.env.PIXEL_AGENTS_DEBUG !== "0";
var HookEventHandler = class _HookEventHandler {
  constructor(agents, waitingTimers, permissionTimers, provider, sessionRouter, watchAllSessionsRef) {
    this.agents = agents;
    this.waitingTimers = waitingTimers;
    this.permissionTimers = permissionTimers;
    this.provider = provider;
    this.sessionRouter = sessionRouter;
    this.watchAllSessionsRef = watchAllSessionsRef;
    if (provider.protocolVersion !== _HookEventHandler.SUPPORTED_PROTOCOL_VERSION) {
      console.warn(
        `[Pixel Agents] HookProvider "${provider.id}" reports protocolVersion=${provider.protocolVersion}, but handler understands ${_HookEventHandler.SUPPORTED_PROTOCOL_VERSION}. Events from this provider will be dropped.`
      );
    }
  }
  agents;
  waitingTimers;
  permissionTimers;
  provider;
  sessionRouter;
  watchAllSessionsRef;
  lifecycleCallbacks = {};
  /** Highest HookProvider.protocolVersion this handler understands. */
  static SUPPORTED_PROTOCOL_VERSION = 1;
  /** Merged set of tool names that spawn subagents (teammates + within-turn subagents
   *  when a team provider is attached, or the base HookProvider set otherwise). */
  getSubagentToolSet() {
    if (this.provider.team) {
      return /* @__PURE__ */ new Set([
        ...this.provider.team.teammateSpawnTools,
        ...this.provider.team.withinTurnSubagentTools
      ]);
    }
    return this.provider.subagentToolNames;
  }
  /** Check if a session is tracked (in workspace project dir, or Watch All Sessions ON). */
  isTrackedSession(transcriptPath, cwd) {
    if (this.watchAllSessionsRef?.current) return true;
    const projectDir = transcriptPath ? path2.dirname(transcriptPath) : cwd;
    if (!projectDir) return false;
    return [...this.agents.values()].some(
      (a) => path2.resolve(a.projectDir).toLowerCase() === path2.resolve(projectDir).toLowerCase()
    );
  }
  /** Set callbacks for session lifecycle events (SessionStart/SessionEnd). */
  setLifecycleCallbacks(callbacks) {
    this.lifecycleCallbacks = callbacks;
  }
  /** Register an agent for hook event routing. Flushes any buffered events for this session. */
  registerAgent(sessionId, agentId) {
    const flushed = this.sessionRouter.register(sessionId, agentId);
    if (debug3 && flushed.length > 0)
      console.log(
        `[Pixel Agents] Hook: flushing ${flushed.length} buffered event(s) for session ${sessionId.slice(0, 8)}...`
      );
    for (const { providerId, event } of flushed) {
      this.handleEvent(providerId, event);
    }
  }
  /** Remove an agent's session mapping (called on agent removal/terminal close). */
  unregisterAgent(sessionId) {
    this.sessionRouter.unregister(sessionId);
  }
  /**
   * Process an incoming hook event. Looks up the agent by session_id,
   * falls back to auto-discovery scan, or buffers if agent not yet registered.
   * @param providerId - Provider that sent the event ('claude', 'codex', etc.)
   * @param event - The hook event payload from the CLI tool
   */
  handleEvent(_providerId, event) {
    if (this.provider.protocolVersion !== _HookEventHandler.SUPPORTED_PROTOCOL_VERSION) {
      return;
    }
    const normalized = this.provider.normalizeHookEvent(event);
    if (!normalized) return;
    const normEvent = normalized.event;
    const eventName = event.hook_event_name;
    if (process.env["PIXEL_AGENTS_DEBUG_LOG"]) {
      try {
        const fs11 = require("fs");
        const sid = event.session_id?.slice(0, 8) ?? "?";
        const extras = normEvent.kind === "toolStart" ? ` toolName=${normEvent.toolName}` : "";
        fs11.appendFileSync(
          process.env["PIXEL_AGENTS_DEBUG_LOG"],
          `${(/* @__PURE__ */ new Date()).toISOString()} HOOK kind=${normEvent.kind} sid=${sid} src=${normEvent.source ?? ""}${extras}
`
        );
      } catch {
      }
    }
    if (normEvent.kind === "sessionStart") {
      const sid = event.session_id.slice(0, 8);
      const source = normEvent.source ?? "unknown";
      const transcriptPath = normEvent.transcriptPath;
      const cwd = normEvent.cwd;
      const tracked = this.isTrackedSession(transcriptPath, cwd);
      if (debug3 && tracked)
        console.log(`[Pixel Agents] Hook: SessionStart(source=${source}, session=${sid}...)`);
      const existingAgentId = this.sessionRouter.resolve(event.session_id);
      if (existingAgentId !== void 0) {
        const agent2 = this.agents.get(existingAgentId);
        if (agent2) {
          agent2.hookDelivered = true;
        }
        if (debug3)
          console.log(
            `[Pixel Agents] Hook: Agent ${existingAgentId} - SessionStart(source=${source}) known`
          );
        return;
      }
      for (const [id, agent2] of this.agents) {
        if (agent2.sessionId === event.session_id) {
          this.registerAgent(agent2.sessionId, id);
          agent2.hookDelivered = true;
          if (debug3)
            console.log(
              `[Pixel Agents] Hook: Agent ${id} - SessionStart(source=${source}) auto-discovered`
            );
          return;
        }
      }
      if (normEvent.source === "clear" || normEvent.source === "resume") {
        const projectDir = transcriptPath ? path2.dirname(transcriptPath) : cwd;
        if (projectDir) {
          for (const [id, agent2] of this.agents) {
            const isMatch = agent2.pendingClear && path2.resolve(agent2.projectDir).toLowerCase() === path2.resolve(projectDir).toLowerCase();
            if (isMatch) {
              agent2.pendingClear = false;
              console.log(
                `[Pixel Agents] Hook: Agent ${id} - /${normEvent.source} detected, reassigning to ${event.session_id}`
              );
              this.sessionRouter.unregister(agent2.sessionId);
              this.registerAgent(event.session_id, id);
              this.lifecycleCallbacks.onSessionClear?.(id, event.session_id, transcriptPath);
              return;
            }
          }
        }
      }
      if (transcriptPath || cwd) {
        if (normEvent.source === "resume" && transcriptPath) {
          this.lifecycleCallbacks.onSessionResume?.(transcriptPath);
        }
        if (debug3 && tracked)
          console.log(
            `[Pixel Agents] Hook: SessionStart(source=${source}) -> pending external session ${sid}..., awaiting confirmation`
          );
        this.sessionRouter.storePending(event.session_id, {
          sessionId: event.session_id,
          transcriptPath,
          cwd: cwd ?? ""
        });
      } else {
        if (debug3 && tracked)
          console.log(
            `[Pixel Agents] Hook: SessionStart -> unknown session ${sid}..., no transcript_path`
          );
      }
      return;
    }
    if (normEvent.kind === "sessionEnd" && this.sessionRouter.hasPending(event.session_id)) {
      this.sessionRouter.discardPending(event.session_id);
      if (debug3)
        console.log(
          `[Pixel Agents] Hook: SessionEnd discarded pending external session ${event.session_id.slice(0, 8)}...`
        );
      return;
    }
    const pending = this.sessionRouter.confirmPending(event.session_id);
    if (pending) {
      if (debug3)
        console.log(
          `[Pixel Agents] Hook: ${eventName} confirmed external session ${event.session_id.slice(0, 8)}..., creating agent`
        );
      this.lifecycleCallbacks.onExternalSessionDetected?.(
        pending.sessionId,
        pending.transcriptPath,
        pending.cwd
      );
      this.handleEvent(_providerId, event);
      return;
    }
    let agentId = this.sessionRouter.resolve(event.session_id);
    if (agentId === void 0) {
      for (const [id, agent2] of this.agents) {
        if (agent2.sessionId === event.session_id) {
          this.registerAgent(agent2.sessionId, id);
          agentId = id;
          break;
        }
      }
    }
    if (agentId === void 0) {
      const isPending = this.sessionRouter.hasPending(event.session_id);
      const hasBuffered = this.sessionRouter.hasBuffered(event.session_id);
      const hasUnregisteredAgents = [...this.agents.values()].some(
        (a) => a.sessionId && !this.sessionRouter.hasSession(a.sessionId)
      );
      if (isPending || hasBuffered || hasUnregisteredAgents) {
        if (debug3)
          console.log(
            `[Pixel Agents] Hook: ${eventName} - unknown session ${event.session_id.slice(0, 8)}..., buffering`
          );
        this.sessionRouter.bufferEvent(_providerId, event);
      }
      return;
    }
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.hookDelivered = true;
    if (debug3)
      console.log(
        `[Pixel Agents] Hook: Agent ${agentId} - ${eventName} (session=${event.session_id.slice(0, 8)}...)`
      );
    switch (normEvent.kind) {
      case "sessionEnd":
        return this.handleSessionEnd(normEvent, agent, agentId);
      case "toolStart":
        return this.handlePreToolUse(normEvent, agent, agentId);
      case "toolEnd":
        return this.handlePostToolUse(agent, agentId);
      case "subagentStart":
        return this.provider.team ? this.handleSubagentStart(event, agent, agentId) : void 0;
      case "subagentEnd":
        return this.provider.team ? this.handleSubagentStop(agent, agentId) : void 0;
      case "permissionRequest":
        return this.handlePermissionRequest(agent, agentId);
      case "turnEnd":
        return this.handleStop(agent, agentId, normEvent.awaitingInput === true);
      case "subagentTurnEnd":
        if (!this.provider.team) return;
        if (normEvent.reason === "completed") {
          return this.handleTaskCompleted(event, agentId);
        }
        return this.handleTeammateIdle(event, agent, agentId);
      case "progress":
        return;
    }
  }
  /**
   * Handle SessionEnd: /clear marks pendingClear (SessionStart follows),
   * exit/logout marks agent waiting or triggers cleanup.
   */
  handleSessionEnd(normEvent, agent, agentId) {
    const reason = normEvent.reason;
    if (debug3)
      console.log(
        `[Pixel Agents] Hook: Agent ${agentId} - SessionEnd(reason=${reason ?? "unknown"})`
      );
    const expectsFollowUp = reason === "clear" || reason === "resume";
    if (expectsFollowUp) {
      agent.pendingClear = true;
      this.markAgentWaiting(agent, agentId);
      if (debug3)
        console.log(
          `[Pixel Agents] Hook: Agent ${agentId} - SessionEnd(reason=${reason}), awaiting possible SessionStart`
        );
      setTimeout(() => {
        if (agent.pendingClear) {
          agent.pendingClear = false;
          this.lifecycleCallbacks.onSessionEnd?.(agentId, reason);
        }
      }, SESSION_END_GRACE_MS);
    } else {
      this.markAgentWaiting(agent, agentId);
      this.lifecycleCallbacks.onSessionEnd?.(agentId, reason ?? "unknown");
    }
  }
  /**
   * Handle PreToolUse: instantly mark agent as active (cancel waiting state).
   * JSONL still handles detailed tool tracking (toolId, status text, webview messages).
   * This just ensures the character starts animating without waiting for the 500ms JSONL poll.
   */
  handlePreToolUse(normEvent, agent, agentId) {
    const toolName = normEvent.toolName;
    const toolInput = normEvent.input ?? {};
    const status = this.provider.formatToolStatus(toolName, toolInput);
    const hookToolId = `hook-${Date.now()}`;
    agent.currentHookToolId = hookToolId;
    agent.currentHookToolName = toolName;
    agent.currentHookIsTeammateSpawn = this.provider.team?.isTeammateSpawnCall(toolName, toolInput) ?? false;
    if (hasInlineTeammates(agentId, this.agents)) return;
    cancelWaitingTimer(agentId, this.waitingTimers);
    agent.isWaiting = false;
    agent.permissionSent = false;
    agent.hadToolsInTurn = true;
    if (toolName !== "Task" && toolName !== "Agent") {
      this.agents.broadcast({
        type: "agentToolStart",
        id: agentId,
        toolId: hookToolId,
        status,
        toolName
      });
    }
    this.agents.broadcast({
      type: "agentStatus",
      id: agentId,
      status: "active"
    });
  }
  /**
   * Handle PostToolUse: no action needed. JSONL handles tool_result processing.
   * Stop hook handles the idle transition. This is here for completeness and
   * to serve as a confirmation event for pending external sessions.
   */
  handlePostToolUse(agent, agentId) {
    if (agent.currentHookToolId) {
      if (!hasInlineTeammates(agentId, this.agents)) {
        this.agents.broadcast({
          type: "agentToolDone",
          id: agentId,
          toolId: agent.currentHookToolId
        });
      }
      agent.currentHookToolId = void 0;
      agent.currentHookToolName = void 0;
    }
  }
  // NOTE: PostToolUseFailure used to have its own handler. The behavior was identical
  // to PostToolUse (emit agentToolDone, clear currentHookToolId). Both now normalize to
  // the 'toolEnd' AgentEvent kind and share handlePostToolUse.
  /**
   * Handle SubagentStart: notify webview that a sub-agent is spawning.
   *
   * For Agent Teams teammates (Agent tool with run_in_background), triggers
   * teammate discovery via lifecycle callback -- teammates become independent
   * agents with their own JSONL file watching.
   *
   * For old-style Task/Agent subagents (inline, no run_in_background), creates
   * the child character immediately via hooks without waiting for JSONL polling.
   */
  handleSubagentStart(event, agent, agentId) {
    const agentType = this.provider.team?.extractTeammateNameFromEvent(event) ?? "unknown";
    if (this.provider.team && agent.currentHookIsTeammateSpawn === true && agent.teamName) {
      if (debug3)
        console.log(
          `[Pixel Agents] Hook: Agent ${agentId} - SubagentStart: teammate "${agentType}" detected, triggering discovery`
        );
      this.lifecycleCallbacks.onTeammateDetected?.(agentId, event.session_id, agentType);
      return;
    }
    const parentTools = this.getSubagentToolSet();
    let parentToolId;
    for (const [toolId, toolName] of agent.activeToolNames) {
      if (parentTools.has(toolName)) {
        parentToolId = toolId;
        break;
      }
    }
    if (!parentToolId) return;
    const subToolId = `hook-sub-${agentType}-${Date.now()}`;
    const status = `Subtask: ${agentType}`;
    let subTools = agent.activeSubagentToolIds.get(parentToolId);
    if (!subTools) {
      subTools = /* @__PURE__ */ new Set();
      agent.activeSubagentToolIds.set(parentToolId, subTools);
    }
    subTools.add(subToolId);
    let subNames = agent.activeSubagentToolNames.get(parentToolId);
    if (!subNames) {
      subNames = /* @__PURE__ */ new Map();
      agent.activeSubagentToolNames.set(parentToolId, subNames);
    }
    subNames.set(subToolId, agentType);
    this.agents.broadcast({
      type: "subagentToolStart",
      id: agentId,
      parentToolId,
      toolId: subToolId,
      status
    });
  }
  /**
   * Handle SubagentStop: notify webview that a sub-agent finished.
   *
   * For Agent Teams teammates: marks all teammate agents as waiting (they're
   * independent agents, not sub-agent characters to destroy).
   *
   * For old-style Task subagents: removes the child character from the office.
   */
  handleSubagentStop(agent, agentId) {
    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length > 0) {
      if (debug3)
        console.log(
          `[Pixel Agents] Hook: Agent ${agentId} - SubagentStop: marking inline teammates as waiting`
        );
      for (const [id, a] of inlineTeammates) {
        this.markAgentWaiting(a, id);
      }
      return;
    }
    const subagentParentTools = this.getSubagentToolSet();
    let parentToolId;
    for (const [toolId, toolName] of agent.activeToolNames) {
      if (subagentParentTools.has(toolName) && agent.activeSubagentToolIds.has(toolId)) {
        parentToolId = toolId;
        break;
      }
    }
    if (!parentToolId) return;
    agent.activeSubagentToolIds.delete(parentToolId);
    agent.activeSubagentToolNames.delete(parentToolId);
    this.agents.broadcast({
      type: "subagentClear",
      id: agentId,
      parentToolId
    });
  }
  /** Handle PermissionRequest: cancel heuristic timer, show permission bubble on agent + sub-agents. */
  handlePermissionRequest(agent, agentId) {
    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length > 0) {
      for (const [id, a] of inlineTeammates) {
        cancelPermissionTimer(id, this.permissionTimers);
        a.permissionSent = true;
        this.agents.broadcast({ type: "agentToolPermission", id });
      }
      return;
    }
    cancelPermissionTimer(agentId, this.permissionTimers);
    agent.permissionSent = true;
    this.agents.broadcast({
      type: "agentToolPermission",
      id: agentId
    });
    for (const parentToolId of agent.activeSubagentToolNames.keys()) {
      this.agents.broadcast({
        type: "subagentToolPermission",
        id: agentId,
        parentToolId
      });
    }
  }
  /** Handle Stop: Claude finished responding, mark agent as waiting. */
  handleStop(agent, agentId, awaitingInput = false) {
    this.markAgentWaiting(agent, agentId, awaitingInput);
  }
  /**
   * Handle TeammateIdle: teammate signaled it's idle and available for work.
   * Routes to the specific teammate if identifiable by agent_type, otherwise
   * marks all inline teammates of this lead as waiting.
   * Fallback: if the agent has no inline teammates, mark the agent itself.
   */
  handleTeammateIdle(event, agent, agentId) {
    const agentType = this.provider.team?.extractTeammateNameFromEvent(event);
    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length === 0) {
      this.markAgentWaiting(agent, agentId, true);
      return;
    }
    if (agentType) {
      const match = inlineTeammates.find(([, a]) => a.agentName === agentType);
      if (match) {
        const [id, a] = match;
        if (debug3)
          console.log(`[Pixel Agents] Hook: TeammateIdle "${agentType}" -> teammate Agent ${id}`);
        this.markAgentWaiting(a, id, true);
        return;
      }
    }
    if (debug3)
      console.log(
        `[Pixel Agents] Hook: TeammateIdle (no agent_type match) -> marking ${inlineTeammates.length} teammate(s) waiting`
      );
    for (const [id, a] of inlineTeammates) {
      this.markAgentWaiting(a, id, true);
    }
  }
  /**
   * Handle TaskCompleted: a teammate marked its task done.
   * Routes to the specific teammate when identifiable, marking it waiting instantly.
   */
  handleTaskCompleted(event, agentId) {
    const subject = event.subject ?? "";
    const agentType = this.provider.team?.extractTeammateNameFromEvent(event);
    if (debug3)
      console.log(
        `[Pixel Agents] Hook: Agent ${agentId} - TaskCompleted: ${subject}${agentType ? ` (agent_type=${agentType})` : ""}`
      );
    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length === 0) return;
    if (agentType) {
      const match = inlineTeammates.find(([, a]) => a.agentName === agentType);
      if (match) {
        const [id, a] = match;
        this.markAgentWaiting(a, id);
        return;
      }
    }
    for (const [id, a] of inlineTeammates) {
      this.markAgentWaiting(a, id);
    }
  }
  /**
   * Transition agent to waiting state. Clears foreground tools (preserves background
   * agents), cancels timers, and notifies the webview. Same logic as the turn_duration
   * handler in transcriptParser.ts.
   */
  markAgentWaiting(agent, agentId, awaitingInput = false) {
    cancelWaitingTimer(agentId, this.waitingTimers);
    cancelPermissionTimer(agentId, this.permissionTimers);
    const parentTools = this.getSubagentToolSet();
    for (const toolId of [...agent.activeToolIds]) {
      if (agent.backgroundAgentToolIds.has(toolId)) continue;
      agent.activeToolIds.delete(toolId);
      agent.activeToolStatuses.delete(toolId);
      const toolName = agent.activeToolNames.get(toolId);
      agent.activeToolNames.delete(toolId);
      if (toolName && parentTools.has(toolName)) {
        agent.activeSubagentToolIds.delete(toolId);
        agent.activeSubagentToolNames.delete(toolId);
      }
    }
    this.agents.broadcast({ type: "agentToolsClear", id: agentId });
    for (const toolId of agent.backgroundAgentToolIds) {
      const status = agent.activeToolStatuses.get(toolId);
      if (status) {
        this.agents.broadcast({
          type: "agentToolStart",
          id: agentId,
          toolId,
          status
        });
      }
    }
    agent.isWaiting = true;
    agent.permissionSent = false;
    agent.hadToolsInTurn = false;
    agent.currentHookToolId = void 0;
    this.agents.broadcast({
      type: "agentStatus",
      id: agentId,
      status: "waiting",
      awaitingInput
    });
  }
  /** Clean up timers and maps. Called when the extension disposes. */
  dispose() {
    this.sessionRouter.dispose();
  }
};

// server/src/sessionRouter.ts
var SessionRouter = class {
  sessionToAgentId = /* @__PURE__ */ new Map();
  pendingSessions = /* @__PURE__ */ new Map();
  buffer = [];
  bufferTimer = null;
  // ── Session → Agent mapping ────────────────────────────────────────
  /** Register a session→agent mapping. Returns any buffered events for this
   *  session so the caller can re-dispatch them. */
  register(sessionId, agentId) {
    this.sessionToAgentId.set(sessionId, agentId);
    return this.flushBuffered(sessionId);
  }
  unregister(sessionId) {
    this.sessionToAgentId.delete(sessionId);
  }
  resolve(sessionId) {
    return this.sessionToAgentId.get(sessionId);
  }
  hasSession(sessionId) {
    return this.sessionToAgentId.has(sessionId);
  }
  // ── Pending external sessions ──────────────────────────────────────
  storePending(sessionId, info) {
    this.pendingSessions.set(sessionId, info);
  }
  confirmPending(sessionId) {
    const info = this.pendingSessions.get(sessionId);
    if (info) this.pendingSessions.delete(sessionId);
    return info;
  }
  hasPending(sessionId) {
    return this.pendingSessions.has(sessionId);
  }
  discardPending(sessionId) {
    this.pendingSessions.delete(sessionId);
  }
  // ── Event buffering ────────────────────────────────────────────────
  bufferEvent(providerId, event) {
    this.buffer.push({ providerId, event, timestamp: Date.now() });
    if (!this.bufferTimer) {
      this.bufferTimer = setInterval(() => {
        this.pruneExpired();
      }, HOOK_EVENT_BUFFER_MS);
    }
  }
  hasBuffered(sessionId) {
    return this.buffer.some((b) => b.event.session_id === sessionId);
  }
  pruneExpired() {
    const cutoff = Date.now() - HOOK_EVENT_BUFFER_MS;
    this.buffer = this.buffer.filter((b) => b.timestamp > cutoff);
    this.cleanupBufferTimer();
  }
  // ── Lifecycle ──────────────────────────────────────────────────────
  dispose() {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = null;
    }
    this.sessionToAgentId.clear();
    this.buffer = [];
    this.pendingSessions.clear();
  }
  // ── Private ────────────────────────────────────────────────────────
  flushBuffered(sessionId) {
    const toFlush = this.buffer.filter((b) => b.event.session_id === sessionId);
    this.buffer = this.buffer.filter((b) => b.event.session_id !== sessionId);
    this.cleanupBufferTimer();
    return toFlush;
  }
  cleanupBufferTimer() {
    if (this.buffer.length === 0 && this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = null;
    }
  }
};

// server/src/agentRuntime.ts
var AgentRuntime = class {
  constructor(store, provider) {
    this.store = store;
    setDismissalTracker(this.dismissalTracker);
    setHookProvider(provider);
    setHookProvider2(provider);
    if (provider.team) {
      setTeamProvider(provider.team);
    }
    setAgentRemovalCallback((id) => this.removeAgent(id));
    setTeammateRemovalCallback((id) => this.removeTeammate(id, "team-config"));
    this.hookEventHandler = new HookEventHandler(
      store,
      this.waitingTimers,
      this.permissionTimers,
      provider,
      new SessionRouter(),
      this.watchAllSessions
    );
    this.hookEventHandler.setLifecycleCallbacks({
      onExternalSessionDetected: (sessionId, transcriptPath, cwd) => {
        const projectDir = transcriptPath ? path3.dirname(transcriptPath) : cwd;
        if (!isTrackedProjectDir(projectDir) && !this.watchAllSessions.current) {
          return;
        }
        adoptExternalSessionFromHook(
          sessionId,
          transcriptPath,
          cwd,
          this.knownJsonlFiles,
          this.store.nextAgentId,
          this.store,
          this.fileWatchers,
          this.pollingTimers,
          this.waitingTimers,
          this.permissionTimers,
          () => this.store.persist(),
          (agent) => this.registerAgent(agent.sessionId, agent.id)
        );
      },
      onSessionClear: (agentId, newSessionId, newTranscriptPath) => {
        if (newTranscriptPath) {
          this.knownJsonlFiles.add(newTranscriptPath);
          reassignAgentToFile(
            agentId,
            newTranscriptPath,
            this.store,
            this.fileWatchers,
            this.pollingTimers,
            this.waitingTimers,
            this.permissionTimers,
            () => this.store.persist()
          );
        }
        const agent = this.store.get(agentId);
        if (agent) {
          this.unregisterAgent(agent.sessionId);
          agent.sessionId = newSessionId;
          this.registerAgent(agent.sessionId, agent.id);
        }
      },
      onSessionResume: (transcriptPath) => {
        this.dismissalTracker.clearDismissal(transcriptPath);
        this.dismissalTracker.clearSeededMtime(transcriptPath);
        this.knownJsonlFiles.delete(transcriptPath);
      },
      onTeammateDetected: (parentAgentId, sessionId, _agentType) => {
        const parentAgent = this.store.get(parentAgentId);
        if (!parentAgent) return;
        scanForTeammateFiles(
          parentAgent.projectDir,
          sessionId,
          parentAgentId,
          this.store.nextAgentId,
          this.store,
          this.fileWatchers,
          this.pollingTimers,
          this.waitingTimers,
          this.permissionTimers,
          () => this.store.persist(),
          // Don't register inline teammates: they share the lead's sessionId
          // and registering them would overwrite the lead in the session router.
          void 0
        );
      },
      onTeammateRemoved: (teammateAgentId) => {
        this.removeTeammate(teammateAgentId, "hooks");
      },
      onSessionEnd: (agentId) => {
        const agent = this.store.get(agentId);
        if (!agent) return;
        this.dismissalTracker.clearSeededMtime(agent.jsonlFile);
        this.dismissalTracker.dismiss(agent.jsonlFile);
        if (agent.isTeamLead) {
          this.removeTeammates(agentId);
        }
        if (agent.isExternal) {
          this.unregisterAgent(agent.sessionId);
          this.removeAgent(agentId);
        }
      }
    });
  }
  store;
  // Per-agent timer Maps (shared by all fileWatcher/hookEventHandler operations)
  fileWatchers = /* @__PURE__ */ new Map();
  pollingTimers = /* @__PURE__ */ new Map();
  waitingTimers = /* @__PURE__ */ new Map();
  permissionTimers = /* @__PURE__ */ new Map();
  jsonlPollTimers = /* @__PURE__ */ new Map();
  // Scanning state
  knownJsonlFiles = /* @__PURE__ */ new Set();
  projectScanTimer = { current: null };
  activeAgentId = { current: null };
  externalScanTimer = null;
  staleCheckTimer = null;
  // Configuration refs (mutable, shared with scanners)
  watchAllSessions = { current: false };
  hooksEnabled = { current: true };
  // Dependencies
  dismissalTracker = new DismissalTracker();
  hookEventHandler;
  lifecycleCallbacks = {};
  /** Register adapter-specific lifecycle callbacks. */
  setLifecycleCallbacks(callbacks) {
    this.lifecycleCallbacks = callbacks;
  }
  // ── Hook event routing ──
  /** Route an incoming hook event to the appropriate agent. */
  handleHookEvent(providerId, event) {
    this.hookEventHandler.handleEvent(providerId, event);
  }
  /** Register an agent with the hook event handler for session->agent mapping. */
  registerAgent(sessionId, agentId) {
    this.hookEventHandler.registerAgent(sessionId, agentId);
  }
  /** Unregister an agent from the hook event handler. */
  unregisterAgent(sessionId) {
    this.hookEventHandler.unregisterAgent(sessionId);
  }
  // ── Agent removal (shared cleanup) ──
  /** Remove an agent: stop watchers, cancel timers, delete from store. */
  removeAgent(id) {
    const agent = this.store.get(id);
    if (!agent) return;
    const jpTimer = this.jsonlPollTimers.get(id);
    if (jpTimer) {
      clearInterval(jpTimer);
    }
    this.jsonlPollTimers.delete(id);
    this.fileWatchers.get(id)?.close();
    this.fileWatchers.delete(id);
    const pt = this.pollingTimers.get(id);
    if (pt) {
      clearInterval(pt);
    }
    this.pollingTimers.delete(id);
    cancelWaitingTimer(id, this.waitingTimers);
    cancelPermissionTimer(id, this.permissionTimers);
    this.lifecycleCallbacks.onAgentRemoved?.(id, agent);
    this.store.delete(id);
    this.store.persist();
  }
  /** Remove a single teammate agent. */
  removeTeammate(teammateId, source) {
    const agent = this.store.get(teammateId);
    if (!agent) return;
    console.log(`[Pixel Agents] Removing teammate ${teammateId} (source: ${source})`);
    this.dismissalTracker.dismiss(agent.jsonlFile);
    this.unregisterAgent(agent.sessionId);
    this.lifecycleCallbacks.onTeammateRemoved?.(teammateId, agent, source);
    this.removeAgent(teammateId);
  }
  /** Remove all teammates of a lead agent. */
  removeTeammates(leadId) {
    const teammates = [];
    for (const [id, agent] of this.store) {
      if (agent.leadAgentId === leadId) {
        teammates.push(id);
      }
    }
    for (const id of teammates) {
      const agent = this.store.get(id);
      if (agent) {
        console.log(`[Pixel Agents] Removing teammate ${id} (lead ${leadId} closed)`);
        this.dismissalTracker.dismiss(agent.jsonlFile);
        this.unregisterAgent(agent.sessionId);
        this.removeAgent(id);
      }
    }
  }
  // ── Scanning ──
  /** Start project-level scanning for a directory. */
  startProjectScan(projectDir, onAgentCreated) {
    ensureProjectScan(
      projectDir,
      this.knownJsonlFiles,
      this.projectScanTimer,
      this.activeAgentId,
      this.store.nextAgentId,
      this.store,
      this.fileWatchers,
      this.pollingTimers,
      this.waitingTimers,
      this.permissionTimers,
      () => this.store.persist(),
      onAgentCreated ?? ((agent) => this.registerAgent(agent.sessionId, agent.id)),
      this.hooksEnabled
    );
  }
  /** Start external session scanning (detects sessions from other terminals). */
  startExternalScanning(projectDir) {
    if (this.externalScanTimer) return;
    this.externalScanTimer = startExternalSessionScanning(
      projectDir,
      this.knownJsonlFiles,
      this.store.nextAgentId,
      this.store,
      this.fileWatchers,
      this.pollingTimers,
      this.waitingTimers,
      this.permissionTimers,
      this.jsonlPollTimers,
      () => this.store.persist(),
      this.watchAllSessions,
      this.hooksEnabled
    );
  }
  /** Start stale external agent check (removes agents whose JSONL files are deleted). */
  startStaleCheck() {
    if (this.staleCheckTimer) return;
    this.staleCheckTimer = startStaleExternalAgentCheck(
      this.store,
      this.knownJsonlFiles,
      this.hooksEnabled
    );
  }
  // ── Restore persisted external agents (standalone) ──
  /**
   * Re-create external agents from the adapter's persistence on startup.
   * Only external agents are restorable here (no terminal to rebind).
   * VS Code uses its own restoreAgents() in agentManager.ts to also handle
   * terminal agents via vscode.window.terminals.
   */
  restoreExternalAgents() {
    const adapter = this.store.getAdapter();
    if (!adapter) return;
    const persisted = adapter.loadAgents();
    if (persisted.length === 0) return;
    let maxId = 0;
    for (const p of persisted) {
      if (!p.isExternal) continue;
      try {
        if (!fs2.existsSync(p.jsonlFile)) continue;
      } catch {
        continue;
      }
      if (this.store.has(p.id)) {
        this.knownJsonlFiles.add(p.jsonlFile);
        if (p.id > maxId) maxId = p.id;
        continue;
      }
      const agent = {
        id: p.id,
        sessionId: p.sessionId || path3.basename(p.jsonlFile, ".jsonl"),
        terminalRef: void 0,
        isExternal: true,
        projectDir: p.projectDir,
        jsonlFile: p.jsonlFile,
        fileOffset: 0,
        lineBuffer: "",
        activeToolIds: /* @__PURE__ */ new Set(),
        activeToolStatuses: /* @__PURE__ */ new Map(),
        activeToolNames: /* @__PURE__ */ new Map(),
        activeSubagentToolIds: /* @__PURE__ */ new Map(),
        activeSubagentToolNames: /* @__PURE__ */ new Map(),
        backgroundAgentToolIds: /* @__PURE__ */ new Set(),
        isWaiting: false,
        permissionSent: false,
        hadToolsInTurn: false,
        lastDataAt: 0,
        linesProcessed: 0,
        seenUnknownRecordTypes: /* @__PURE__ */ new Set(),
        folderName: p.folderName,
        hookDelivered: false,
        inputTokens: 0,
        outputTokens: 0,
        teamName: p.teamName,
        agentName: p.agentName,
        isTeamLead: p.isTeamLead,
        leadAgentId: p.leadAgentId,
        teamUsesTmux: p.teamUsesTmux
      };
      this.store.set(p.id, agent);
      this.knownJsonlFiles.add(p.jsonlFile);
      try {
        const stat = fs2.statSync(p.jsonlFile);
        agent.fileOffset = stat.size;
        startFileWatching(
          p.id,
          p.jsonlFile,
          this.store,
          this.fileWatchers,
          this.pollingTimers,
          this.waitingTimers,
          this.permissionTimers
        );
      } catch {
      }
      this.registerAgent(agent.sessionId, agent.id);
      if (p.id > maxId) maxId = p.id;
      console.log(
        `[Pixel Agents] Restored external agent ${p.id} -> ${path3.basename(p.jsonlFile)}`
      );
    }
    if (maxId >= this.store.nextAgentId.current) {
      this.store.nextAgentId.current = maxId + 1;
    }
    this.store.persist();
  }
  // ── Cleanup ──
  /** Clean up all scanners, timers, and agents. Called on shutdown. */
  dispose() {
    this.hookEventHandler.dispose();
    if (this.projectScanTimer.current) {
      clearInterval(this.projectScanTimer.current);
      this.projectScanTimer.current = null;
    }
    if (this.externalScanTimer) {
      clearInterval(this.externalScanTimer);
      this.externalScanTimer = null;
    }
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    for (const id of [...this.store.keys()]) {
      this.removeAgent(id);
    }
  }
};

// server/src/agentStateStore.ts
var import_node_events = require("node:events");
var import_node_fs = require("node:fs");
var DEBUG_LOG_PATH = process.env["PIXEL_AGENTS_DEBUG_LOG"];
function debugLogBroadcast(message) {
  if (!DEBUG_LOG_PATH) return;
  try {
    const t = message.type;
    const id = message.id;
    const extras = [];
    if (id !== void 0) extras.push(`id=${id}`);
    if ("toolName" in message) extras.push(`toolName=${message.toolName}`);
    if ("status" in message) extras.push(`status=${message.status}`);
    if ("parentToolId" in message) extras.push(`parentToolId=${message.parentToolId}`);
    if ("toolId" in message) extras.push(`toolId=${message.toolId}`);
    (0, import_node_fs.appendFileSync)(DEBUG_LOG_PATH, `${(/* @__PURE__ */ new Date()).toISOString()} BCAST ${t} ${extras.join(" ")}
`);
  } catch {
  }
}
var AgentStateStore = class {
  agents = /* @__PURE__ */ new Map();
  emitter = new import_node_events.EventEmitter();
  nextAgentId = { current: 1 };
  nextTerminalIndex = { current: 1 };
  adapter;
  // ── Adapter ──────────────────────────────────────────────────
  setAdapter(adapter) {
    this.adapter = adapter;
  }
  getAdapter() {
    return this.adapter;
  }
  // ── Map-compatible read ──────────────────────────────────────
  get(id) {
    return this.agents.get(id);
  }
  has(id) {
    return this.agents.has(id);
  }
  get size() {
    return this.agents.size;
  }
  keys() {
    return this.agents.keys();
  }
  values() {
    return this.agents.values();
  }
  entries() {
    return this.agents.entries();
  }
  forEach(cb, thisArg) {
    this.agents.forEach(cb, thisArg);
  }
  [Symbol.iterator]() {
    return this.agents[Symbol.iterator]();
  }
  // ── Event subscription ───────────────────────────────────────
  on(event, listener) {
    this.emitter.on(event, listener);
    return this;
  }
  off(event, listener) {
    this.emitter.off(event, listener);
    return this;
  }
  // ── Map-compatible write (emits events) ─────────────────────
  set(id, agent) {
    const isNew = !this.agents.has(id);
    this.agents.set(id, agent);
    if (isNew) {
      this.emitter.emit("agentAdded", id, agent);
    }
    return this;
  }
  delete(id) {
    const existed = this.agents.delete(id);
    if (existed) {
      this.emitter.emit("agentRemoved", id);
    }
    return existed;
  }
  clear() {
    this.agents.clear();
  }
  // ── Broadcast (replaces direct webview.postMessage in server/) ─
  broadcast(message) {
    debugLogBroadcast(message);
    this.emitter.emit("broadcast", message);
  }
  // ── Lifecycle ───────────────────────────────────────────────
  dispose() {
    this.emitter.removeAllListeners();
  }
  // ── Persistence ─────────────────────────────────────────────
  persist() {
    if (!this.adapter) {
      return;
    }
    const persisted = [];
    for (const agent of this.agents.values()) {
      persisted.push({
        id: agent.id,
        sessionId: agent.sessionId,
        terminalName: agent.terminalRef?.name ?? "",
        isExternal: agent.isExternal || void 0,
        jsonlFile: agent.jsonlFile,
        projectDir: agent.projectDir,
        folderName: agent.folderName,
        teamName: agent.teamName,
        agentName: agent.agentName,
        isTeamLead: agent.isTeamLead,
        leadAgentId: agent.leadAgentId,
        teamUsesTmux: agent.teamUsesTmux
      });
    }
    this.adapter.saveAgents(persisted);
  }
  loadPersistedAgents() {
    return this.adapter?.loadAgents() ?? [];
  }
};

// server/src/assetLoader.ts
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

// core/src/assets/constants.ts
var PNG_ALPHA_THRESHOLD = 2;
var WALL_PIECE_WIDTH = 16;
var WALL_PIECE_HEIGHT = 32;
var WALL_GRID_COLS = 4;
var WALL_BITMASK_COUNT = 16;
var FLOOR_TILE_SIZE = 16;
var CHARACTER_DIRECTIONS = ["down", "up", "right"];
var CHAR_FRAME_W = 16;
var CHAR_FRAME_H = 32;
var CHAR_FRAMES_PER_ROW = 7;
var CHAR_COUNT = 6;
var PET_FRAME_W_SMALL = 16;
var PET_FRAME_H = 32;
var PET_FRAME_W_LARGE = 32;
var PET_IMAGE_WIDTH = 96;
var PET_IMAGE_HEIGHT = 96;
var PET_WALK_FRAMES_VERT = 3;
var PET_IDLE_FRAMES_VERT = 3;
var PET_WALK_FRAMES_HORIZ = 3;
var MAX_PET_PNG_SIZE = 512 * 1024;

// core/src/assets/manifestUtils.ts
function flattenManifest(node, inherited) {
  if (node.type === "asset") {
    const asset = node;
    const orientation = asset.orientation ?? inherited.orientation;
    const state = asset.state ?? inherited.state;
    return [
      {
        id: asset.id,
        name: inherited.name,
        label: inherited.name,
        category: inherited.category,
        file: asset.file,
        width: asset.width,
        height: asset.height,
        footprintW: asset.footprintW,
        footprintH: asset.footprintH,
        isDesk: inherited.category === "desks",
        canPlaceOnWalls: inherited.canPlaceOnWalls,
        canPlaceOnSurfaces: inherited.canPlaceOnSurfaces,
        backgroundTiles: inherited.backgroundTiles,
        groupId: inherited.groupId,
        ...orientation ? { orientation } : {},
        ...state ? { state } : {},
        ...asset.mirrorSide ? { mirrorSide: true } : {},
        ...inherited.rotationScheme ? { rotationScheme: inherited.rotationScheme } : {},
        ...inherited.animationGroup ? { animationGroup: inherited.animationGroup } : {},
        ...asset.frame !== void 0 ? { frame: asset.frame } : {}
      }
    ];
  }
  const group = node;
  const results = [];
  for (const member of group.members) {
    const childProps = { ...inherited };
    if (group.groupType === "rotation") {
      if (group.rotationScheme) {
        childProps.rotationScheme = group.rotationScheme;
      }
    }
    if (group.groupType === "state") {
      if (group.orientation) {
        childProps.orientation = group.orientation;
      }
      if (group.state) {
        childProps.state = group.state;
      }
    }
    if (group.groupType === "animation") {
      const orient = group.orientation ?? inherited.orientation ?? "";
      const st = group.state ?? inherited.state ?? "";
      childProps.animationGroup = `${inherited.groupId}_${orient}_${st}`.toUpperCase();
      if (group.state) {
        childProps.state = group.state;
      }
    }
    if (group.orientation && !childProps.orientation) {
      childProps.orientation = group.orientation;
    }
    results.push(...flattenManifest(member, childProps));
  }
  return results;
}

// core/src/assets/pngDecoder.ts
var import_pngjs = __toESM(require_png());

// core/src/assets/colorUtils.ts
function rgbaToHex(r, g, b, a) {
  if (a < PNG_ALPHA_THRESHOLD) return "";
  const rgb = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
  if (a >= 255) return rgb;
  return `${rgb}${a.toString(16).padStart(2, "0").toUpperCase()}`;
}

// core/src/assets/pngDecoder.ts
function sanitizePngBuffer(buf) {
  for (let i = buf.length - 8; i >= 8; i--) {
    if (buf[i] === 73 && buf[i + 1] === 69 && buf[i + 2] === 78 && buf[i + 3] === 68) {
      const endPos = i + 4 + 4;
      if (buf.length > endPos) {
        return buf.subarray(0, endPos);
      }
      break;
    }
  }
  return buf;
}
function pngToSpriteData(pngBuffer, width, height) {
  try {
    const png = import_pngjs.PNG.sync.read(sanitizePngBuffer(pngBuffer));
    if (png.width !== width || png.height !== height) {
      console.warn(
        `PNG dimensions mismatch: expected ${width}\xD7${height}, got ${png.width}\xD7${png.height}`
      );
    }
    const sprite = [];
    const data = png.data;
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * png.width + x) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3];
        row.push(rgbaToHex(r, g, b, a));
      }
      sprite.push(row);
    }
    return sprite;
  } catch (err) {
    console.warn(`Failed to parse PNG: ${err instanceof Error ? err.message : err}`);
    const sprite = [];
    for (let y = 0; y < height; y++) {
      sprite.push(new Array(width).fill(""));
    }
    return sprite;
  }
}
function parseWallPng(pngBuffer) {
  const png = import_pngjs.PNG.sync.read(sanitizePngBuffer(pngBuffer));
  const sprites = [];
  for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
    const ox = mask % WALL_GRID_COLS * WALL_PIECE_WIDTH;
    const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT;
    const sprite = [];
    for (let r = 0; r < WALL_PIECE_HEIGHT; r++) {
      const row = [];
      for (let c = 0; c < WALL_PIECE_WIDTH; c++) {
        const idx = ((oy + r) * png.width + (ox + c)) * 4;
        const rv = png.data[idx];
        const gv = png.data[idx + 1];
        const bv = png.data[idx + 2];
        const av = png.data[idx + 3];
        row.push(rgbaToHex(rv, gv, bv, av));
      }
      sprite.push(row);
    }
    sprites.push(sprite);
  }
  return sprites;
}
function decodeCharacterPng(pngBuffer) {
  const png = import_pngjs.PNG.sync.read(sanitizePngBuffer(pngBuffer));
  const charData = { down: [], up: [], right: [] };
  for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
    const dir = CHARACTER_DIRECTIONS[dirIdx];
    const rowOffsetY = dirIdx * CHAR_FRAME_H;
    const frames = [];
    for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
      const sprite = [];
      const frameOffsetX = f * CHAR_FRAME_W;
      for (let y = 0; y < CHAR_FRAME_H; y++) {
        const row = [];
        for (let x = 0; x < CHAR_FRAME_W; x++) {
          const idx = ((rowOffsetY + y) * png.width + (frameOffsetX + x)) * 4;
          const r = png.data[idx];
          const g = png.data[idx + 1];
          const b = png.data[idx + 2];
          const a = png.data[idx + 3];
          row.push(rgbaToHex(r, g, b, a));
        }
        sprite.push(row);
      }
      frames.push(sprite);
    }
    charData[dir] = frames;
  }
  return charData;
}
function decodeFloorPng(pngBuffer) {
  return pngToSpriteData(pngBuffer, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
}
function decodePetPng(pngBuffer) {
  try {
    let extractFrame2 = function(ox, oy, w, h) {
      const sprite = [];
      for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
          const idx = ((oy + y) * png.width + (ox + x)) * 4;
          row.push(
            rgbaToHex(png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3])
          );
        }
        sprite.push(row);
      }
      return sprite;
    };
    var extractFrame = extractFrame2;
    const png = import_pngjs.PNG.sync.read(sanitizePngBuffer(pngBuffer));
    if (png.width !== PET_IMAGE_WIDTH || png.height !== PET_IMAGE_HEIGHT) {
      console.warn(
        `[PngDecoder] Pet sprite has unexpected dimensions: ${png.width}\xD7${png.height} (expected ${PET_IMAGE_WIDTH}\xD7${PET_IMAGE_HEIGHT})`
      );
      throw new Error("Invalid pet sprite dimensions");
    }
    const walkDown = [];
    for (let f = 0; f < PET_WALK_FRAMES_VERT; f++) {
      walkDown.push(extractFrame2(f * PET_FRAME_W_SMALL, 0, PET_FRAME_W_SMALL, PET_FRAME_H));
    }
    const idleDown = [];
    for (let f = 0; f < PET_IDLE_FRAMES_VERT; f++) {
      idleDown.push(
        extractFrame2(
          (PET_WALK_FRAMES_VERT + f) * PET_FRAME_W_SMALL,
          0,
          PET_FRAME_W_SMALL,
          PET_FRAME_H
        )
      );
    }
    const walkUp = [];
    for (let f = 0; f < PET_WALK_FRAMES_VERT; f++) {
      walkUp.push(extractFrame2(f * PET_FRAME_W_SMALL, PET_FRAME_H, PET_FRAME_W_SMALL, PET_FRAME_H));
    }
    const idleUp = [];
    for (let f = 0; f < PET_IDLE_FRAMES_VERT; f++) {
      idleUp.push(
        extractFrame2(
          (PET_WALK_FRAMES_VERT + f) * PET_FRAME_W_SMALL,
          PET_FRAME_H,
          PET_FRAME_W_SMALL,
          PET_FRAME_H
        )
      );
    }
    const walkRight = [];
    for (let f = 0; f < PET_WALK_FRAMES_HORIZ; f++) {
      walkRight.push(
        extractFrame2(f * PET_FRAME_W_LARGE, PET_FRAME_H * 2, PET_FRAME_W_LARGE, PET_FRAME_H)
      );
    }
    return { walkDown, idleDown, walkUp, idleUp, walkRight };
  } catch (err) {
    console.warn(
      `[PngDecoder] Failed to parse pet PNG: ${err instanceof Error ? err.message : err}`
    );
    const emptySmall = () => Array.from({ length: PET_FRAME_H }, () => new Array(PET_FRAME_W_SMALL).fill(""));
    const emptyLarge = () => Array.from({ length: PET_FRAME_H }, () => new Array(PET_FRAME_W_LARGE).fill(""));
    return {
      walkDown: [emptySmall(), emptySmall(), emptySmall()],
      idleDown: [emptySmall(), emptySmall(), emptySmall()],
      walkUp: [emptySmall(), emptySmall(), emptySmall()],
      idleUp: [emptySmall(), emptySmall(), emptySmall()],
      walkRight: [emptyLarge(), emptyLarge(), emptyLarge()]
    };
  }
}

// server/src/assetLoader.ts
async function loadFurnitureAssets(workspaceRoot) {
  try {
    console.log(`[AssetLoader] workspaceRoot received: "${workspaceRoot}"`);
    const furnitureDir = path4.join(workspaceRoot, "assets", "furniture");
    console.log(`[AssetLoader] Scanning furniture directory: ${furnitureDir}`);
    if (!fs3.existsSync(furnitureDir)) {
      console.log("\u2139\uFE0F  No furniture directory found at:", furnitureDir);
      return null;
    }
    const entries = fs3.readdirSync(furnitureDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length === 0) {
      console.log("\u2139\uFE0F  No furniture subdirectories found");
      return null;
    }
    console.log(`\u{1F4E6} Found ${dirs.length} furniture folders`);
    const catalog = [];
    const sprites = /* @__PURE__ */ new Map();
    for (const dir of dirs) {
      const itemDir = path4.join(furnitureDir, dir.name);
      const manifestPath = path4.join(itemDir, "manifest.json");
      if (!fs3.existsSync(manifestPath)) {
        console.warn(`  \u26A0\uFE0F  No manifest.json in ${dir.name}`);
        continue;
      }
      try {
        const manifestContent = fs3.readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);
        const inherited = {
          groupId: manifest.id,
          name: manifest.name,
          category: manifest.category,
          canPlaceOnWalls: manifest.canPlaceOnWalls,
          canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
          backgroundTiles: manifest.backgroundTiles
        };
        let assets;
        if (manifest.type === "asset") {
          assets = [
            {
              id: manifest.id,
              name: manifest.name,
              label: manifest.name,
              category: manifest.category,
              file: manifest.file ?? `${manifest.id}.png`,
              width: manifest.width,
              height: manifest.height,
              footprintW: manifest.footprintW,
              footprintH: manifest.footprintH,
              isDesk: manifest.category === "desks",
              canPlaceOnWalls: manifest.canPlaceOnWalls,
              canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
              backgroundTiles: manifest.backgroundTiles,
              groupId: manifest.id
            }
          ];
        } else {
          if (manifest.rotationScheme) {
            inherited.rotationScheme = manifest.rotationScheme;
          }
          const rootGroup = {
            type: "group",
            groupType: manifest.groupType,
            rotationScheme: manifest.rotationScheme,
            members: manifest.members
          };
          assets = flattenManifest(rootGroup, inherited);
        }
        for (const asset of assets) {
          try {
            const assetPath = path4.join(itemDir, asset.file);
            const resolvedAsset = path4.resolve(assetPath);
            const resolvedDir = path4.resolve(itemDir);
            if (!resolvedAsset.startsWith(resolvedDir + path4.sep) && resolvedAsset !== resolvedDir) {
              console.warn(
                `  [AssetLoader] Skipping asset with path outside directory: ${asset.file}`
              );
              continue;
            }
            if (!fs3.existsSync(assetPath)) {
              console.warn(`  \u26A0\uFE0F  Asset file not found: ${asset.file} in ${dir.name}`);
              continue;
            }
            const pngBuffer = fs3.readFileSync(assetPath);
            const spriteData = pngToSpriteData(pngBuffer, asset.width, asset.height);
            sprites.set(asset.id, spriteData);
          } catch (err) {
            console.warn(
              `  \u26A0\uFE0F  Error loading ${asset.id}: ${err instanceof Error ? err.message : err}`
            );
          }
        }
        catalog.push(...assets);
      } catch (err) {
        console.warn(
          `  \u26A0\uFE0F  Error processing ${dir.name}: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    console.log(`  \u2713 Loaded ${sprites.size} / ${catalog.length} assets`);
    console.log(`[AssetLoader] \u2705 Successfully loaded ${sprites.size} furniture sprites`);
    return { catalog, sprites };
  } catch (err) {
    console.error(
      `[AssetLoader] \u274C Error loading furniture assets: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
function loadDefaultLayout(assetsRoot) {
  const assetsDir = path4.join(assetsRoot, "assets");
  try {
    let bestRevision = 0;
    let bestPath = null;
    if (fs3.existsSync(assetsDir)) {
      for (const file of fs3.readdirSync(assetsDir)) {
        const match = /^default-layout-(\d+)\.json$/.exec(file);
        if (match) {
          const rev = parseInt(match[1], 10);
          if (rev > bestRevision) {
            bestRevision = rev;
            bestPath = path4.join(assetsDir, file);
          }
        }
      }
    }
    if (!bestPath) {
      const fallback = path4.join(assetsDir, "default-layout.json");
      if (fs3.existsSync(fallback)) {
        bestPath = fallback;
      }
    }
    if (!bestPath) {
      console.log("[AssetLoader] No default layout found in:", assetsDir);
      return null;
    }
    const content = fs3.readFileSync(bestPath, "utf-8");
    const layout = JSON.parse(content);
    if (bestRevision > 0 && !layout[LAYOUT_REVISION_KEY]) {
      layout[LAYOUT_REVISION_KEY] = bestRevision;
    }
    console.log(
      `[AssetLoader] Loaded default layout (${layout.cols}\xD7${layout.rows}, revision ${layout[LAYOUT_REVISION_KEY] ?? 0}) from ${path4.basename(bestPath)}`
    );
    return layout;
  } catch (err) {
    console.error(
      `[AssetLoader] Error loading default layout: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
async function loadWallTiles(assetsRoot) {
  try {
    const wallsDir = path4.join(assetsRoot, "assets", "walls");
    if (!fs3.existsSync(wallsDir)) {
      console.log("[AssetLoader] No walls/ directory found at:", wallsDir);
      return null;
    }
    console.log("[AssetLoader] Loading wall tiles from:", wallsDir);
    const entries = fs3.readdirSync(wallsDir);
    const wallFiles = [];
    for (const entry of entries) {
      const match = /^wall_(\d+)\.png$/i.exec(entry);
      if (match) {
        wallFiles.push({ index: parseInt(match[1], 10), filename: entry });
      }
    }
    if (wallFiles.length === 0) {
      console.log("[AssetLoader] No wall_N.png files found in walls/");
      return null;
    }
    wallFiles.sort((a, b) => a.index - b.index);
    const sets = [];
    for (const { filename } of wallFiles) {
      const filePath = path4.join(wallsDir, filename);
      const pngBuffer = fs3.readFileSync(filePath);
      const sprites = parseWallPng(pngBuffer);
      sets.push(sprites);
    }
    console.log(
      `[AssetLoader] \u2705 Loaded ${sets.length} wall tile set(s) (${sets.length * WALL_BITMASK_COUNT} pieces total)`
    );
    return { sets };
  } catch (err) {
    console.error(
      `[AssetLoader] \u274C Error loading wall tiles: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
async function loadFloorTiles(assetsRoot) {
  try {
    const floorsDir = path4.join(assetsRoot, "assets", "floors");
    if (!fs3.existsSync(floorsDir)) {
      console.log("[AssetLoader] No floors/ directory found at:", floorsDir);
      return null;
    }
    console.log("[AssetLoader] Loading floor tiles from:", floorsDir);
    const entries = fs3.readdirSync(floorsDir);
    const floorFiles = [];
    for (const entry of entries) {
      const match = /^floor_(\d+)\.png$/i.exec(entry);
      if (match) {
        floorFiles.push({ index: parseInt(match[1], 10), filename: entry });
      }
    }
    if (floorFiles.length === 0) {
      console.log("[AssetLoader] No floor_N.png files found in floors/");
      return null;
    }
    floorFiles.sort((a, b) => a.index - b.index);
    const sprites = [];
    for (const { filename } of floorFiles) {
      const filePath = path4.join(floorsDir, filename);
      const pngBuffer = fs3.readFileSync(filePath);
      const sprite = decodeFloorPng(pngBuffer);
      sprites.push(sprite);
    }
    console.log(`[AssetLoader] \u2705 Loaded ${sprites.length} floor tile patterns from floors/`);
    return { sprites };
  } catch (err) {
    console.error(
      `[AssetLoader] \u274C Error loading floor tiles: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
async function loadCharacterSprites(assetsRoot) {
  try {
    const charDir = path4.join(assetsRoot, "assets", "characters");
    const characters = [];
    for (let ci = 0; ci < CHAR_COUNT; ci++) {
      const filePath = path4.join(charDir, `char_${ci}.png`);
      if (!fs3.existsSync(filePath)) {
        console.log(`[AssetLoader] No character sprite found at: ${filePath}`);
        return null;
      }
      const pngBuffer = fs3.readFileSync(filePath);
      characters.push(decodeCharacterPng(pngBuffer));
    }
    console.log(
      `[AssetLoader] \u2705 Loaded ${characters.length} character sprites (${CHAR_FRAMES_PER_ROW} frames \xD7 3 directions each)`
    );
    return { characters };
  } catch (err) {
    console.error(
      `[AssetLoader] \u274C Error loading character sprites: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}
async function loadPetSprites(assetsRoot) {
  try {
    const petDir = path4.join(assetsRoot, "assets", "pets");
    if (!fs3.existsSync(petDir)) {
      return null;
    }
    const entries = fs3.readdirSync(petDir);
    const petDirs = [];
    for (const entry of entries) {
      const entryPath = path4.join(petDir, entry);
      try {
        if (fs3.statSync(entryPath).isDirectory()) {
          petDirs.push(entry);
        }
      } catch {
      }
    }
    petDirs.sort();
    if (petDirs.length === 0) {
      return null;
    }
    const pets = [];
    const manifests = [];
    const resolvedDir = path4.resolve(petDir);
    for (const dirName of petDirs) {
      const subDir = path4.join(petDir, dirName);
      const resolvedSub = path4.resolve(subDir);
      if (!resolvedSub.startsWith(resolvedDir + path4.sep)) {
        console.warn(`  [AssetLoader] Skipping pet with path outside directory: ${dirName}`);
        continue;
      }
      const manifestPath = path4.join(subDir, "manifest.json");
      const pngPath = path4.join(subDir, "pet.png");
      if (!fs3.existsSync(manifestPath) || !fs3.existsSync(pngPath)) {
        console.warn(`  [AssetLoader] Skipping pet ${dirName}: missing manifest.json or pet.png`);
        continue;
      }
      try {
        const manifestRaw = fs3.readFileSync(manifestPath, "utf-8");
        const manifestData = JSON.parse(manifestRaw);
        if (!manifestData.id || !manifestData.name) {
          console.warn(`  [AssetLoader] Skipping pet ${dirName}: manifest missing id or name`);
          continue;
        }
        const stat = fs3.statSync(pngPath);
        if (stat.size > MAX_PET_PNG_SIZE) {
          console.warn(
            `[AssetLoader] \u26A0\uFE0F  Skipping oversized pet ${dirName}: ${stat.size} bytes (max ${MAX_PET_PNG_SIZE})`
          );
          continue;
        }
        const pngBuffer = fs3.readFileSync(pngPath);
        pets.push(decodePetPng(pngBuffer));
        manifests.push({ id: manifestData.id, name: manifestData.name });
      } catch (err) {
        console.warn(
          `[AssetLoader] \u26A0\uFE0F  Error loading pet ${dirName}: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    if (pets.length === 0) {
      return null;
    }
    console.log(`[AssetLoader] \u2705 Loaded ${pets.length} pet sprites`);
    return { pets, manifests };
  } catch (err) {
    console.error(
      `[AssetLoader] \u274C Error loading pet sprites: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}

// server/src/fileStateAdapter.ts
var fs5 = __toESM(require("fs"));
var os2 = __toESM(require("os"));
var path6 = __toESM(require("path"));

// server/src/configPersistence.ts
var fs4 = __toESM(require("fs"));
var os = __toESM(require("os"));
var path5 = __toESM(require("path"));
var ADAPTER_SETTING_KEYS = [
  "soundEnabled",
  "lastSeenVersion",
  "alwaysShowLabels",
  "watchAllSessions",
  "hooksEnabled",
  "hooksInfoShown"
];
var DEFAULT_ADAPTER_SETTINGS = {
  soundEnabled: true,
  lastSeenVersion: "",
  alwaysShowLabels: false,
  watchAllSessions: false,
  hooksEnabled: true,
  hooksInfoShown: false
};
function getConfigFilePath() {
  return path5.join(os.homedir(), LAYOUT_FILE_DIR, CONFIG_FILE_NAME);
}
function parseAdapterSettings(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  return {
    soundEnabled: typeof obj.soundEnabled === "boolean" ? obj.soundEnabled : DEFAULT_ADAPTER_SETTINGS.soundEnabled,
    lastSeenVersion: typeof obj.lastSeenVersion === "string" ? obj.lastSeenVersion : DEFAULT_ADAPTER_SETTINGS.lastSeenVersion,
    alwaysShowLabels: typeof obj.alwaysShowLabels === "boolean" ? obj.alwaysShowLabels : DEFAULT_ADAPTER_SETTINGS.alwaysShowLabels,
    watchAllSessions: typeof obj.watchAllSessions === "boolean" ? obj.watchAllSessions : DEFAULT_ADAPTER_SETTINGS.watchAllSessions,
    hooksEnabled: typeof obj.hooksEnabled === "boolean" ? obj.hooksEnabled : DEFAULT_ADAPTER_SETTINGS.hooksEnabled,
    hooksInfoShown: typeof obj.hooksInfoShown === "boolean" ? obj.hooksInfoShown : DEFAULT_ADAPTER_SETTINGS.hooksInfoShown
  };
}
function readConfig() {
  const filePath = getConfigFilePath();
  try {
    if (!fs4.existsSync(filePath)) {
      return {
        vscode: { ...DEFAULT_ADAPTER_SETTINGS },
        standalone: { ...DEFAULT_ADAPTER_SETTINGS },
        externalAssetDirectories: []
      };
    }
    const raw = fs4.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      vscode: parseAdapterSettings(parsed.vscode),
      standalone: parseAdapterSettings(parsed.standalone),
      externalAssetDirectories: Array.isArray(parsed.externalAssetDirectories) ? parsed.externalAssetDirectories.filter((d) => typeof d === "string") : []
    };
  } catch (err) {
    console.error("[Pixel Agents] Failed to read config file:", err);
    return {
      vscode: { ...DEFAULT_ADAPTER_SETTINGS },
      standalone: { ...DEFAULT_ADAPTER_SETTINGS },
      externalAssetDirectories: []
    };
  }
}
function writeConfig(config) {
  const filePath = getConfigFilePath();
  const dir = path5.dirname(filePath);
  try {
    if (!fs4.existsSync(dir)) {
      fs4.mkdirSync(dir, { recursive: true });
    }
    const json = JSON.stringify(config, null, 2);
    const tmpPath = filePath + ".tmp";
    fs4.writeFileSync(tmpPath, json, "utf-8");
    fs4.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error("[Pixel Agents] Failed to write config file:", err);
  }
}

// server/src/fileStateAdapter.ts
var ADAPTER_SETTING_KEY_SET = new Set(ADAPTER_SETTING_KEYS);
function settingNameOf(key) {
  const bare = key.startsWith("pixel-agents.") ? key.slice("pixel-agents.".length) : key;
  return ADAPTER_SETTING_KEY_SET.has(bare) ? bare : null;
}
var EMPTY_STATE = { agents: [], seats: {} };
var FileStateAdapter = class {
  namespace;
  stateFilePath;
  constructor(options) {
    this.namespace = options.namespace;
    this.stateFilePath = path6.join(
      os2.homedir(),
      LAYOUT_FILE_DIR,
      `${options.namespace}-state.json`
    );
  }
  // ── Settings (shared config.json, per-namespace section) ────
  getSetting(key, defaultValue) {
    const field = settingNameOf(key);
    if (!field) return defaultValue;
    const config = readConfig();
    return config[this.namespace][field];
  }
  setSetting(key, value) {
    const field = settingNameOf(key);
    if (!field) return;
    const config = readConfig();
    config[this.namespace][field] = value;
    writeConfig(config);
  }
  // ── Agents + seats (adapter-scoped file) ────────────────────
  loadAgents() {
    return this.readState().agents;
  }
  saveAgents(agents) {
    const state = this.readState();
    state.agents = agents;
    this.writeState(state);
  }
  loadSeats() {
    return this.readState().seats;
  }
  saveSeats(seats) {
    const state = this.readState();
    state.seats = seats;
    this.writeState(state);
  }
  // ── Internal state-file I/O ─────────────────────────────────
  readState() {
    try {
      if (!fs5.existsSync(this.stateFilePath)) {
        return { agents: [], seats: {} };
      }
      const raw = fs5.readFileSync(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        agents: Array.isArray(parsed.agents) ? parsed.agents : [],
        seats: parsed.seats && typeof parsed.seats === "object" ? parsed.seats : {}
      };
    } catch (err) {
      console.error("[Pixel Agents] Failed to read adapter state:", err);
      return { ...EMPTY_STATE };
    }
  }
  writeState(state) {
    const dir = path6.dirname(this.stateFilePath);
    try {
      if (!fs5.existsSync(dir)) {
        fs5.mkdirSync(dir, { recursive: true });
      }
      const json = JSON.stringify(state, null, 2);
      const tmpPath = this.stateFilePath + ".tmp";
      fs5.writeFileSync(tmpPath, json, "utf-8");
      fs5.renameSync(tmpPath, this.stateFilePath);
    } catch (err) {
      console.error("[Pixel Agents] Failed to write adapter state:", err);
    }
  }
};

// server/src/providers/hook/claude/claude.ts
var fs8 = __toESM(require("fs"));
var os5 = __toESM(require("os"));
var path9 = __toESM(require("path"));

// core/src/normalizeProjectPath.ts
function normalizeProjectPath(absPath) {
  return absPath.replace(/[^a-zA-Z0-9-]/g, "-");
}

// server/src/providers/hook/claude/claudeHookInstaller.ts
var fs6 = __toESM(require("fs"));
var os3 = __toESM(require("os"));
var path7 = __toESM(require("path"));

// server/src/providers/hook/claude/constants.ts
var CLAUDE_HOOK_SCRIPT_NAME = "claude-hook.js";
var CLAUDE_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "Stop",
  "PermissionRequest",
  "Notification",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
  "TeammateIdle",
  "TaskCreated",
  "TaskCompleted"
];
var CLAUDE_TERMINAL_NAME_PREFIX = "Claude Code";

// server/src/providers/hook/claude/claudeHookInstaller.ts
var HOOK_SCRIPT_MARKER = CLAUDE_HOOK_SCRIPT_NAME;
function getClaudeSettingsPath() {
  return path7.join(os3.homedir(), ".claude", "settings.json");
}
function getHookScriptPath() {
  return path7.join(os3.homedir(), HOOK_SCRIPTS_DIR, CLAUDE_HOOK_SCRIPT_NAME);
}
function readClaudeSettings() {
  const settingsPath = getClaudeSettingsPath();
  try {
    if (fs6.existsSync(settingsPath)) {
      return JSON.parse(fs6.readFileSync(settingsPath, "utf-8"));
    }
  } catch (e) {
    console.error(`[Pixel Agents] Failed to read Claude settings: ${e}`);
  }
  return {};
}
function writeClaudeSettings(settings) {
  const settingsPath = getClaudeSettingsPath();
  const dir = path7.dirname(settingsPath);
  try {
    if (!fs6.existsSync(dir)) {
      fs6.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = settingsPath + ".pixel-agents-tmp";
    fs6.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
    fs6.renameSync(tmpPath, settingsPath);
  } catch (e) {
    console.error(`[Pixel Agents] Failed to write Claude settings: ${e}`);
  }
}
var LEGACY_HOOK_MARKER = "pixel-agents-hook.js";
function isOurHookEntry(entry) {
  return entry.hooks.some(
    (h) => h.command.includes(HOOK_SCRIPT_MARKER) || h.command.includes(LEGACY_HOOK_MARKER)
  );
}
function makeHookCommand() {
  const scriptPath = getHookScriptPath();
  return `node "${scriptPath}"`;
}
function makeHookEntry() {
  return {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: makeHookCommand(),
        timeout: 5
      }
    ]
  };
}
function areHooksInstalled() {
  const settings = readClaudeSettings();
  if (!settings.hooks) return false;
  const events = CLAUDE_HOOK_EVENTS;
  return events.every((event) => {
    const entries = settings.hooks?.[event];
    return Array.isArray(entries) && entries.some(isOurHookEntry);
  });
}
function installHooks() {
  const settings = readClaudeSettings();
  if (!settings.hooks) {
    settings.hooks = {};
  }
  const events = CLAUDE_HOOK_EVENTS;
  let changed = false;
  for (const event of events) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
    }
    const entries = settings.hooks[event];
    const filtered = entries.filter((e) => !isOurHookEntry(e));
    filtered.push(makeHookEntry());
    if (JSON.stringify(filtered) !== JSON.stringify(entries)) {
      settings.hooks[event] = filtered;
      changed = true;
    }
  }
  if (changed) {
    writeClaudeSettings(settings);
    console.log("[Pixel Agents] Hooks installed in ~/.claude/settings.json");
  }
}
function uninstallHooks() {
  const settings = readClaudeSettings();
  if (!settings.hooks) return;
  let changed = false;
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;
    const filtered = entries.filter((e) => !isOurHookEntry(e));
    if (filtered.length !== entries.length) {
      settings.hooks[event] = filtered;
      changed = true;
    }
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
  if (changed) {
    writeClaudeSettings(settings);
    console.log("[Pixel Agents] Hooks removed from ~/.claude/settings.json");
  }
}
function copyHookScript(extensionPath) {
  const src = path7.join(extensionPath, "dist", "hooks", CLAUDE_HOOK_SCRIPT_NAME);
  const dst = getHookScriptPath();
  const dstDir = path7.dirname(dst);
  try {
    if (!fs6.existsSync(dstDir)) {
      fs6.mkdirSync(dstDir, { recursive: true, mode: 448 });
    }
    if (!fs6.existsSync(src)) {
      console.warn(`[Pixel Agents] Hook script not found at ${src}`);
      return;
    }
    fs6.copyFileSync(src, dst);
    fs6.chmodSync(dst, 448);
    console.log(`[Pixel Agents] Hook script installed at ${dst}`);
  } catch (e) {
    console.error(`[Pixel Agents] Failed to copy hook script: ${e}`);
  }
}

// server/src/providers/hook/claude/claudeTeamProvider.ts
var fs7 = __toESM(require("fs"));
var os4 = __toESM(require("os"));
var path8 = __toESM(require("path"));
function sidecarPath(jsonlPath) {
  return jsonlPath.replace(/\.jsonl$/, ".meta.json");
}
function parseSidecarAgentType(jsonlPath) {
  const metaPath = sidecarPath(jsonlPath);
  try {
    const raw = fs7.readFileSync(metaPath, "utf-8");
    const data = JSON.parse(raw);
    return typeof data.agentType === "string" ? data.agentType : null;
  } catch {
    return null;
  }
}
function teammateDir(projectDir, leadSessionId) {
  return path8.join(projectDir, leadSessionId, "subagents");
}
var claudeTeamProvider = {
  providerId: "claude",
  teammateSpawnTools: /* @__PURE__ */ new Set(["Agent"]),
  withinTurnSubagentTools: /* @__PURE__ */ new Set(["Task"]),
  isTeammateSpawnCall(toolName, toolInput) {
    return toolName === "Agent" && toolInput.run_in_background === true;
  },
  extractTeammateNameFromEvent(event) {
    const value = event.agent_type;
    return typeof value === "string" ? value : void 0;
  },
  discoverTeammates(projectDir, leadSessionId) {
    const dir = teammateDir(projectDir, leadSessionId);
    let entries;
    try {
      entries = fs7.readdirSync(dir);
    } catch {
      return [];
    }
    const result = [];
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      const jsonlPath = path8.join(dir, entry);
      const teammateName = parseSidecarAgentType(jsonlPath);
      if (teammateName) {
        result.push({ jsonlPath, teammateName });
      }
    }
    return result;
  },
  getTeamMetadataForSession(jsonlPath) {
    let raw;
    try {
      raw = fs7.readFileSync(jsonlPath, "utf-8");
    } catch {
      return null;
    }
    const firstNewline = raw.indexOf("\n");
    const firstLine = firstNewline === -1 ? raw : raw.slice(0, firstNewline);
    if (!firstLine.trim()) return null;
    try {
      const record = JSON.parse(firstLine);
      const teamName = record.teamName;
      if (typeof teamName !== "string") return null;
      const agentName = record.agentName;
      return {
        teamName,
        agentName: typeof agentName === "string" ? agentName : void 0
      };
    } catch {
      return null;
    }
  },
  extractTeamMetadataFromRecord(record) {
    const teamName = record.teamName;
    if (typeof teamName !== "string") return null;
    const agentName = record.agentName;
    return {
      teamName,
      agentName: typeof agentName === "string" ? agentName : void 0
    };
  },
  getTeamMembers(teamName) {
    const configPath = path8.join(os4.homedir(), ".claude", "teams", teamName, "config.json");
    let raw;
    try {
      raw = fs7.readFileSync(configPath, "utf-8");
    } catch {
      return null;
    }
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data.members)) return null;
      const names = /* @__PURE__ */ new Set();
      for (const m of data.members) {
        if (m && typeof m.name === "string") names.add(m.name);
      }
      return names;
    } catch {
      return null;
    }
  }
};

// server/src/providers/hook/claude/claude.ts
function formatToolStatus2(toolName, input) {
  const inp = input ?? {};
  const base = (p) => typeof p === "string" ? path9.basename(p) : "";
  switch (toolName) {
    case "Read":
      return `Reading ${base(inp.file_path)}`;
    case "Edit":
      return `Editing ${base(inp.file_path)}`;
    case "Write":
      return `Writing ${base(inp.file_path)}`;
    case "Bash": {
      const cmd = inp.command || "";
      return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + "\u2026" : cmd}`;
    }
    case "Glob":
      return "Searching files";
    case "Grep":
      return "Searching code";
    case "WebFetch":
      return "Fetching web content";
    case "WebSearch":
      return "Searching the web";
    case "Task":
    case "Agent": {
      const desc = typeof inp.description === "string" ? inp.description : "";
      return desc ? `Subtask: ${desc.length > TASK_DESCRIPTION_DISPLAY_MAX_LENGTH ? desc.slice(0, TASK_DESCRIPTION_DISPLAY_MAX_LENGTH) + "\u2026" : desc}` : "Running subtask";
    }
    case "AskUserQuestion":
      return "Waiting for your answer";
    case "EnterPlanMode":
      return "Planning";
    case "NotebookEdit":
      return "Editing notebook";
    case "TeamCreate": {
      const teamName = typeof inp.team_name === "string" ? inp.team_name : "";
      return teamName ? `Creating team: ${teamName}` : "Creating team";
    }
    case "SendMessage": {
      const recipient = typeof inp.recipient === "string" ? inp.recipient : "";
      return recipient ? `-> ${recipient}` : "Sending message";
    }
    default:
      return `Using ${toolName}`;
  }
}
function getSessionDirs(workspacePath) {
  const dirName = normalizeProjectPath(workspacePath);
  const projectDir = path9.join(os5.homedir(), ".claude", "projects", dirName);
  if (fs8.existsSync(projectDir)) return [projectDir];
  const projectsRoot = path9.join(os5.homedir(), ".claude", "projects");
  try {
    if (fs8.existsSync(projectsRoot)) {
      const lowerDirName = dirName.toLowerCase();
      const match = fs8.readdirSync(projectsRoot).find((c) => c.toLowerCase() === lowerDirName);
      if (match) return [path9.join(projectsRoot, match)];
    }
  } catch {
  }
  return [projectDir];
}
function buildLaunchCommand(sessionId, cwd, opts) {
  const args = ["--session-id", sessionId];
  if (opts?.bypassPermissions) args.push("--dangerously-skip-permissions");
  return { command: "claude", args, env: { PWD: cwd } };
}
function getAllSessionRoots() {
  return [path9.join(os5.homedir(), ".claude", "projects")];
}
function normalizeHookEvent(raw) {
  const eventName = raw.hook_event_name;
  const sessionId = raw.session_id;
  if (typeof eventName !== "string" || typeof sessionId !== "string") return null;
  switch (eventName) {
    case "PreToolUse": {
      const toolName = typeof raw.tool_name === "string" ? raw.tool_name : "";
      const toolInput = typeof raw.tool_input === "object" && raw.tool_input !== null ? raw.tool_input : {};
      return {
        sessionId,
        event: {
          kind: "toolStart",
          toolId: `hook-${Date.now()}`,
          toolName,
          input: toolInput,
          runInBackground: toolInput.run_in_background === true
        }
      };
    }
    case "PostToolUse":
    case "PostToolUseFailure":
      return { sessionId, event: { kind: "toolEnd", toolId: "current" } };
    case "Stop":
      return { sessionId, event: { kind: "turnEnd" } };
    case "UserPromptSubmit":
      return null;
    case "SubagentStart": {
      const agentType = typeof raw.agent_type === "string" ? raw.agent_type : "unknown";
      return {
        sessionId,
        event: {
          kind: "subagentStart",
          parentToolId: "current",
          toolId: `hook-sub-${agentType}-${Date.now()}`,
          toolName: agentType,
          input: raw,
          runInBackground: raw.run_in_background === true
        }
      };
    }
    case "SubagentStop":
      return {
        sessionId,
        event: { kind: "subagentEnd", parentToolId: "current", toolId: "current" }
      };
    case "PermissionRequest":
      return { sessionId, event: { kind: "permissionRequest" } };
    case "Notification": {
      const notificationType = typeof raw.notification_type === "string" ? raw.notification_type : "";
      if (notificationType === "permission_prompt") {
        return { sessionId, event: { kind: "permissionRequest" } };
      }
      if (notificationType === "idle_prompt") {
        return { sessionId, event: { kind: "turnEnd", awaitingInput: true } };
      }
      return null;
    }
    case "SessionStart":
      return {
        sessionId,
        event: {
          kind: "sessionStart",
          source: typeof raw.source === "string" ? raw.source : void 0,
          transcriptPath: typeof raw.transcript_path === "string" ? raw.transcript_path : void 0,
          cwd: typeof raw.cwd === "string" ? raw.cwd : void 0
        }
      };
    case "SessionEnd":
      return {
        sessionId,
        event: {
          kind: "sessionEnd",
          reason: typeof raw.reason === "string" ? raw.reason : void 0
        }
      };
    // Agent Teams: a teammate went idle / marked a task complete. Normalize as
    // `subagentTurnEnd` so the team handler can route by agent_type to the teammate.
    // `reason` discriminates the two so handlers don't read raw eventName.
    case "TeammateIdle":
      return {
        sessionId,
        event: { kind: "subagentTurnEnd", parentToolId: "current", reason: "idle" }
      };
    case "TaskCompleted":
      return {
        sessionId,
        event: { kind: "subagentTurnEnd", parentToolId: "current", reason: "completed" }
      };
    // TaskCreated is informational; no AgentEvent shape fits it. Drop.
    case "TaskCreated":
    default:
      return null;
  }
}
function installHooks2(_serverUrl, _authToken) {
  installHooks();
  return Promise.resolve();
}
function uninstallHooks2() {
  uninstallHooks();
  return Promise.resolve();
}
function areHooksInstalled2() {
  return Promise.resolve(areHooksInstalled());
}
var claudeProvider = {
  kind: "hook",
  id: "claude",
  displayName: "Claude Code",
  protocolVersion: 1,
  normalizeHookEvent,
  installHooks: installHooks2,
  uninstallHooks: uninstallHooks2,
  areHooksInstalled: areHooksInstalled2,
  formatToolStatus: formatToolStatus2,
  permissionExemptTools: /* @__PURE__ */ new Set(["Task", "Agent", "AskUserQuestion"]),
  subagentToolNames: /* @__PURE__ */ new Set(["Task", "Agent"]),
  readingTools: /* @__PURE__ */ new Set(["Read", "Grep", "Glob", "WebFetch", "WebSearch"]),
  terminalNamePrefix: CLAUDE_TERMINAL_NAME_PREFIX,
  getSessionDirs,
  getAllSessionRoots,
  sessionFilePattern: "*.jsonl",
  buildLaunchCommand,
  team: claudeTeamProvider
};

// server/src/server.ts
var crypto2 = __toESM(require("crypto"));
var fs10 = __toESM(require("fs"));
var os7 = __toESM(require("os"));
var path11 = __toESM(require("path"));

// server/src/httpServer.ts
var import_cors = __toESM(require("@fastify/cors"));
var import_static = __toESM(require("@fastify/static"));
var import_websocket = __toESM(require("@fastify/websocket"));
var crypto = __toESM(require("crypto"));
var import_fastify = __toESM(require("fastify"));

// server/src/layoutPersistence.ts
var fs9 = __toESM(require("fs"));
var os6 = __toESM(require("os"));
var path10 = __toESM(require("path"));
function getLayoutFilePath() {
  return path10.join(os6.homedir(), LAYOUT_FILE_DIR, LAYOUT_FILE_NAME);
}
function readLayoutFromFile() {
  const filePath = getLayoutFilePath();
  try {
    if (!fs9.existsSync(filePath)) return null;
    const raw = fs9.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Pixel Agents] Failed to read layout file:", err);
    return null;
  }
}
function writeLayoutToFile(layout) {
  const filePath = getLayoutFilePath();
  const dir = path10.dirname(filePath);
  try {
    if (!fs9.existsSync(dir)) {
      fs9.mkdirSync(dir, { recursive: true });
    }
    const json = JSON.stringify(layout, null, 2);
    const tmpPath = filePath + ".tmp";
    fs9.writeFileSync(tmpPath, json, "utf-8");
    fs9.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error("[Pixel Agents] Failed to write layout file:", err);
  }
}

// server/src/clientMessageHandler.ts
var KEY_SOUND_ENABLED = "pixel-agents.soundEnabled";
var KEY_LAST_SEEN_VERSION = "pixel-agents.lastSeenVersion";
var KEY_ALWAYS_SHOW_LABELS = "pixel-agents.alwaysShowLabels";
var KEY_WATCH_ALL_SESSIONS = "pixel-agents.watchAllSessions";
var KEY_HOOKS_ENABLED = "pixel-agents.hooksEnabled";
var KEY_HOOKS_INFO_SHOWN = "pixel-agents.hooksInfoShown";
function handleClientMessage(msg, send, ctx) {
  const { store, runtime } = ctx;
  const adapter = store.getAdapter();
  switch (msg.type) {
    case "webviewReady":
      handleWebviewReady(send, ctx);
      break;
    case "saveLayout":
      if (msg.layout) {
        writeLayoutToFile(msg.layout);
      }
      break;
    case "saveAgentSeats":
      if (msg.seats) {
        adapter?.saveSeats(
          msg.seats
        );
      }
      break;
    case "setSoundEnabled":
      adapter?.setSetting(KEY_SOUND_ENABLED, msg.enabled);
      break;
    case "setLastSeenVersion":
      adapter?.setSetting(KEY_LAST_SEEN_VERSION, msg.version);
      break;
    case "setAlwaysShowLabels":
      adapter?.setSetting(KEY_ALWAYS_SHOW_LABELS, msg.enabled);
      break;
    case "setWatchAllSessions": {
      const enabled = msg.enabled;
      adapter?.setSetting(KEY_WATCH_ALL_SESSIONS, enabled);
      if (runtime) runtime.watchAllSessions.current = enabled;
      break;
    }
    case "setHooksEnabled": {
      const enabled = msg.enabled;
      adapter?.setSetting(KEY_HOOKS_ENABLED, enabled);
      if (runtime) runtime.hooksEnabled.current = enabled;
      void ctx.onSetHooksEnabled?.(enabled);
      break;
    }
    case "setHooksInfoShown":
      adapter?.setSetting(KEY_HOOKS_INFO_SHOWN, true);
      break;
    case "addExternalAssetDirectory": {
      const newPath = msg.path;
      if (!newPath) break;
      const cfg = readConfig();
      if (!cfg.externalAssetDirectories.includes(newPath)) {
        cfg.externalAssetDirectories.push(newPath);
        writeConfig(cfg);
      }
      send({ type: "externalAssetDirectoriesUpdated", dirs: cfg.externalAssetDirectories });
      break;
    }
    case "removeExternalAssetDirectory": {
      const removePath = msg.path;
      if (!removePath) break;
      const cfg = readConfig();
      cfg.externalAssetDirectories = cfg.externalAssetDirectories.filter((d) => d !== removePath);
      writeConfig(cfg);
      send({ type: "externalAssetDirectoriesUpdated", dirs: cfg.externalAssetDirectories });
      break;
    }
    default:
      break;
  }
}
function handleWebviewReady(send, ctx) {
  const { store, runtime, cache } = ctx;
  const adapter = store.getAdapter();
  send({
    type: "providerCapabilities",
    readingTools: [...claudeProvider.readingTools],
    subagentToolNames: [...claudeProvider.subagentToolNames]
  });
  if (cache) {
    if (cache.characters) {
      send({ type: "characterSpritesLoaded", characters: cache.characters.characters });
    }
    if (cache.pets) {
      send({
        type: "petSpritesLoaded",
        pets: cache.pets.pets,
        petNames: cache.pets.manifests.map((m) => m.name)
      });
    }
    if (cache.floorTiles) {
      send({ type: "floorTilesLoaded", sprites: cache.floorTiles });
    }
    if (cache.wallTiles) {
      send({ type: "wallTilesLoaded", sets: cache.wallTiles });
    }
    if (cache.furniture) {
      send({
        type: "furnitureAssetsLoaded",
        catalog: cache.furniture.catalog,
        sprites: Object.fromEntries(cache.furniture.sprites)
      });
    }
  }
  const savedLayout = readLayoutFromFile();
  send({ type: "layoutLoaded", layout: savedLayout ?? cache?.defaultLayout ?? null });
  const cfg = readConfig();
  const watchAllSessions = adapter?.getSetting(KEY_WATCH_ALL_SESSIONS, false) ?? false;
  const hooksEnabled = adapter?.getSetting(KEY_HOOKS_ENABLED, true) ?? true;
  send({
    type: "settingsLoaded",
    soundEnabled: adapter?.getSetting(KEY_SOUND_ENABLED, true) ?? true,
    lastSeenVersion: adapter?.getSetting(KEY_LAST_SEEN_VERSION, "") ?? "",
    extensionVersion: "1.3.0",
    watchAllSessions,
    alwaysShowLabels: adapter?.getSetting(KEY_ALWAYS_SHOW_LABELS, false) ?? false,
    hooksEnabled,
    hooksInfoShown: adapter?.getSetting(KEY_HOOKS_INFO_SHOWN, false) ?? false,
    externalAssetDirectories: cfg.externalAssetDirectories
  });
  if (runtime) {
    runtime.watchAllSessions.current = watchAllSessions;
    runtime.hooksEnabled.current = hooksEnabled;
  }
  runtime?.restoreExternalAgents();
  const agentIds = [];
  const folderNames = {};
  const externalAgents = {};
  for (const [id, agent] of store) {
    agentIds.push(id);
    if (agent.folderName) {
      folderNames[id] = agent.folderName;
    }
    if (agent.isExternal) {
      externalAgents[id] = true;
    }
  }
  const seats = adapter?.loadSeats() ?? {};
  send({
    type: "existingAgents",
    agents: agentIds,
    agentMeta: seats,
    folderNames,
    externalAgents
  });
  // AutonomyHQ fix: the webview buffers existingAgents and only spawns their
  // characters on the NEXT layoutLoaded. Upstream sends layoutLoaded before
  // existingAgents, so pre-existing agents never render. Re-send layoutLoaded
  // after existingAgents to flush the buffer.
  send({ type: "layoutLoaded", layout: savedLayout ?? cache?.defaultLayout ?? null });
}

// server/src/httpServer.ts
var startTime = Date.now();
async function createHttpServer(options) {
  const app = (0, import_fastify.default)({
    logger: !options.embedded,
    bodyLimit: MAX_HOOK_BODY_SIZE
  });
  await app.register(import_cors.default, { origin: true });
  await app.register(import_websocket.default);
  if (!options.embedded && options.staticDir) {
    await app.register(import_static.default, {
      root: options.staticDir,
      prefix: "/"
    });
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html");
    });
  }
  registerHealthRoute(app);
  registerHookRoute(app, options);
  registerWebSocketRoute(app, options);
  await app.listen({ host: options.host ?? "127.0.0.1", port: options.port ?? 0 });
  const address = app.server.address();
  const port = typeof address === "object" ? address?.port ?? 0 : 0;
  return { app, port };
}
function registerHealthRoute(app) {
  app.get("/api/health", async () => ({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1e3),
    pid: process.pid
  }));
}
function registerHookRoute(app, options) {
  app.post(
    `${HOOK_API_PREFIX}/:providerId`,
    {
      preHandler: bearerAuth(options.token),
      schema: {
        params: {
          type: "object",
          properties: {
            providerId: { type: "string", pattern: "^[a-z0-9-]+$" }
          },
          required: ["providerId"]
        }
      }
    },
    async (request, reply) => {
      const { providerId } = request.params;
      const event = request.body;
      if (event.session_id && event.hook_event_name) {
        options.onHookEvent?.(providerId, event);
      }
      reply.send("ok");
    }
  );
}
function registerWebSocketRoute(app, options) {
  app.get("/ws", { websocket: true }, (socket, request) => {
    if (options.embedded) {
      const auth = request.headers.authorization ?? "";
      const expected = `Bearer ${options.token}`;
      const authBuf = Buffer.from(auth);
      const expectedBuf = Buffer.from(expected);
      if (authBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(authBuf, expectedBuf)) {
        socket.close(4001, "unauthorized");
        return;
      }
    }
    const { store } = options;
    const onAgentAdded = (id, agent) => {
      safeSend(socket, {
        type: "agentCreated",
        id,
        folderName: agent.folderName,
        isExternal: agent.isExternal || void 0,
        isTeammate: agent.leadAgentId !== void 0 || void 0,
        teammateName: agent.agentName,
        parentAgentId: agent.leadAgentId,
        teamName: agent.teamName,
        hooksOnly: agent.hooksOnly || void 0
      });
    };
    const onAgentRemoved = (id) => {
      safeSend(socket, { type: "agentClosed", id });
    };
    const onBroadcast = (message) => {
      safeSend(socket, message);
    };
    store.on("agentAdded", onAgentAdded);
    store.on("agentRemoved", onAgentRemoved);
    store.on("broadcast", onBroadcast);
    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!options.embedded && msg.type) {
          console.log("[Pixel Agents] WS client message:", msg.type);
        }
        handleClientMessage(msg, (m) => safeSend(socket, m), {
          store,
          runtime: options.runtime,
          cache: options.assetCache ?? null,
          onSetHooksEnabled: options.onSetHooksEnabled
        });
      } catch {
      }
    });
    socket.on("close", () => {
      store.off("agentAdded", onAgentAdded);
      store.off("agentRemoved", onAgentRemoved);
      store.off("broadcast", onBroadcast);
    });
  });
}
function bearerAuth(expectedToken) {
  return async (request, reply) => {
    const auth = request.headers.authorization ?? "";
    const expected = `Bearer ${expectedToken}`;
    const authBuf = Buffer.from(auth);
    const expectedBuf = Buffer.from(expected);
    if (authBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(authBuf, expectedBuf)) {
      reply.code(401).send("unauthorized");
    }
  };
}
function safeSend(socket, message) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message));
  }
}

// server/src/server.ts
var PixelAgentsServer = class {
  app = null;
  config = null;
  ownsServer = false;
  callback = null;
  /** Register a callback for incoming hook events from any provider. */
  onHookEvent(callback) {
    this.callback = callback;
  }
  /**
   * Start the server. If another instance is already running (detected via
   * server.json PID check), reuses that server's config without starting a new one.
   */
  async start(options) {
    const existing = this.readServerJson();
    if (existing && isProcessRunning(existing.pid)) {
      this.config = existing;
      this.ownsServer = false;
      console.log(
        `[Pixel Agents] Reusing existing server on port ${existing.port} (PID ${existing.pid})`
      );
      return existing;
    }
    const token = crypto2.randomUUID();
    const store = options?.store;
    const { app, port } = await createHttpServer({
      embedded: options?.embedded ?? true,
      host: options?.host,
      port: options?.port,
      token,
      store,
      runtime: options?.runtime,
      staticDir: options?.staticDir,
      assetCache: options?.assetCache,
      onHookEvent: (providerId, event) => this.callback?.(providerId, event),
      onSetHooksEnabled: options?.onSetHooksEnabled
    });
    this.app = app;
    this.config = {
      port,
      pid: process.pid,
      token,
      startedAt: Date.now(),
      // Diagnostic-only: forward the debug-log path to the hook script via
      // server.json (env vars don't reach the spawned hook reliably).
      ...process.env["PIXEL_AGENTS_DEBUG_LOG"] ? { debugLog: process.env["PIXEL_AGENTS_DEBUG_LOG"] } : {}
    };
    this.ownsServer = true;
    this.writeServerJson(this.config);
    console.log(`[Pixel Agents] Server: listening on 127.0.0.1:${port}`);
    return this.config;
  }
  /** Stop the server and clean up server.json (only if we own it). */
  stop() {
    if (this.app) {
      this.app.close();
      this.app = null;
    }
    if (this.ownsServer) {
      this.deleteServerJson();
    }
    this.config = null;
    this.ownsServer = false;
  }
  /** Returns the current server config, or null if not started. */
  getConfig() {
    return this.config;
  }
  /** Returns the absolute path to ~/.pixel-agents/server.json. */
  getServerJsonPath() {
    return path11.join(os7.homedir(), SERVER_JSON_DIR, SERVER_JSON_NAME);
  }
  /** Read and parse server.json. Returns null if missing or malformed. */
  readServerJson() {
    try {
      const filePath = this.getServerJsonPath();
      if (!fs10.existsSync(filePath)) return null;
      return JSON.parse(fs10.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
  /** Write server.json atomically (tmp + rename) with mode 0o600. */
  writeServerJson(config) {
    const filePath = this.getServerJsonPath();
    const dir = path11.dirname(filePath);
    try {
      if (!fs10.existsSync(dir)) {
        fs10.mkdirSync(dir, { recursive: true, mode: 448 });
      }
      const tmpPath = filePath + ".tmp";
      fs10.writeFileSync(tmpPath, JSON.stringify(config, null, 2), { mode: 384 });
      fs10.renameSync(tmpPath, filePath);
    } catch (e) {
      console.error(`[Pixel Agents] Failed to write server.json: ${e}`);
    }
  }
  /** Delete server.json only if the PID inside matches our process (safe for multi-window). */
  deleteServerJson() {
    try {
      const filePath = this.getServerJsonPath();
      if (!fs10.existsSync(filePath)) return;
      const existing = JSON.parse(fs10.readFileSync(filePath, "utf-8"));
      if (existing.pid === process.pid) {
        fs10.unlinkSync(filePath);
      }
    } catch {
    }
  }
};
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// server/src/cli.ts
function parseArgs(argv) {
  const args = { port: 3100, host: "127.0.0.1" };
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--port" || argv[i] === "-p") && argv[i + 1]) {
      args.port = parseInt(argv[i + 1], 10);
      i++;
    } else if (argv[i] === "--host" && argv[i + 1]) {
      args.host = argv[i + 1];
      i++;
    } else if (argv[i] === "--help") {
      console.log(`Usage: pixel-agents [options]

Options:
  --port, -p <number>   Port to listen on (default: 3100)
  --host <string>       Host to bind to (default: 127.0.0.1)
  --help                Show this help message`);
      process.exit(0);
    }
  }
  return args;
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const distRoot = __dirname;
  const staticDir = path12.join(distRoot, "webview");
  console.log("[Pixel Agents] Loading assets...");
  const assetCache = {
    characters: await loadCharacterSprites(distRoot),
    pets: await loadPetSprites(distRoot),
    floorTiles: await loadFloorTiles(distRoot).then((t) => t?.sprites ?? null),
    wallTiles: await loadWallTiles(distRoot).then((t) => t?.sets ?? null),
    furniture: await loadFurnitureAssets(distRoot),
    defaultLayout: loadDefaultLayout(distRoot)
  };
  const charCount = assetCache.characters?.characters.length ?? 0;
  const petCount = assetCache.pets?.pets.length ?? 0;
  const furnitureCount = assetCache.furniture?.catalog.length ?? 0;
  console.log(
    `[Pixel Agents] Assets loaded: ${charCount} characters, ${petCount} pets, ${furnitureCount} furniture items`
  );
  const store = new AgentStateStore();
  const adapter = new FileStateAdapter({ namespace: "standalone" });
  store.setAdapter(adapter);
  const server = new PixelAgentsServer();
  try {
    let shutdown2 = function() {
      console.log("\nShutting down...");
      runtime.dispose();
      server.stop();
      process.exit(0);
    };
    var shutdown = shutdown2;
    const runtime = new AgentRuntime(store, claudeProvider);
    server.onHookEvent((providerId, event) => {
      runtime.handleHookEvent(providerId, event);
    });
    let currentConfig = null;
    const onSetHooksEnabled = async (enabled) => {
      if (!currentConfig) return;
      if (enabled) {
        await claudeProvider.installHooks(
          `http://127.0.0.1:${currentConfig.port}`,
          currentConfig.token
        );
        copyHookScript(distRoot);
        console.log("[Pixel Agents] Hooks installed (user toggle)");
      } else {
        await claudeProvider.uninstallHooks();
        console.log("[Pixel Agents] Hooks uninstalled (user toggle)");
      }
    };
    const config = await server.start({
      store,
      runtime,
      embedded: false,
      host: args.host,
      port: args.port,
      staticDir,
      assetCache,
      onSetHooksEnabled
    });
    currentConfig = { port: config.port, token: config.token };
    runtime.hooksEnabled.current = adapter.getSetting("pixel-agents.hooksEnabled", true);
    runtime.watchAllSessions.current = adapter.getSetting("pixel-agents.watchAllSessions", false);
    if (runtime.hooksEnabled.current) {
      try {
        await claudeProvider.installHooks(`http://127.0.0.1:${config.port}`, config.token);
        copyHookScript(distRoot);
        console.log("[Pixel Agents] Hooks installed");
      } catch (err) {
        console.error("[Pixel Agents] Failed to install hooks:", err);
      }
    }
    const cwd = process.cwd();
    const dirs = claudeProvider.getSessionDirs?.(cwd);
    if (dirs && dirs[0]) {
      const projectDir = dirs[0];
      console.log(`[Pixel Agents] Scanning project dir: ${projectDir}`);
      runtime.startProjectScan(projectDir);
      runtime.startExternalScanning(projectDir);
      runtime.startStaleCheck();
    }
    console.log(`
  Pixel Agents server running at http://${args.host}:${config.port}
`);
    process.on("SIGINT", shutdown2);
    process.on("SIGTERM", shutdown2);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=cli.js.map
