"use strict";
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var bitwise_1 = require("bitwise");
var ieee754 = require('ieee754');
var prefabs_1 = require("./prefabs");
var prefabsDatabaseCreator_1 = require("./prefabsDatabaseCreator");
prefabsDatabaseCreator_1["default"]();
var Stream = /** @class */ (function () {
    function Stream() {
        this.words = [];
        this.bitIndex = 0;
        this.totalBits = 0;
    }
    Stream.prototype.writeFloat = function (value) {
        var buffer = Buffer.from(new Uint8Array(4));
        ieee754.write(buffer, value, 0, true, 23, 4);
        this.write(buffer.readInt32LE(0));
    };
    Stream.prototype.write = function (value) {
        for (var i = 0; i < 32; i++) {
            this.writeBit(bitwise_1["default"].integer.getBit(value, 31 - i));
        }
    };
    Stream.prototype.writeBit = function (bit) {
        this.scratch = bitwise_1["default"].integer.setBit(this.scratch, 31 - this.bitIndex, bit);
        this.bitIndex++;
        this.totalBits++;
        if (this.bitIndex == 32) {
            this.words.push(this.scratch);
            this.scratch = 0;
            this.bitIndex = 0;
        }
    };
    Stream.prototype.alignAndFlush = function () {
        while ((this.totalBits % 8) != 0) {
            this.writeBit(0);
        }
        var shift = 32 - this.bitIndex;
        for (var i = 31; i >= shift; i--) {
            this.scratch = bitwise_1["default"].integer.setBit(this.scratch, 31 - i, bitwise_1["default"].integer.getBit(this.scratch, i - shift));
            this.scratch = bitwise_1["default"].integer.setBit(this.scratch, 31 - i - shift, 0);
        }
        this.words.push(this.scratch);
        this.scratch = 0;
        this.bitIndex = 0;
        return this.totalBits / 8;
    };
    return Stream;
}());
function serializeString(stream, value) {
    if (value.includes("|")) {
        var parts = value.split('|');
        value = parts[0];
    }
    var split = value.split(',');
    for (var i = 0; i < split.length - 1; i++) {
        stream.write(parseInt(split[i]));
    }
}
function serializePrefab(stream, hash, position, rotation, scale, childGenerator) {
    // hash (1)
    stream.write(hash);
    // position (3)
    stream.writeFloat(position.x);
    stream.writeFloat(position.y);
    stream.writeFloat(position.z);
    // rotation (4)
    stream.writeFloat(rotation.x);
    stream.writeFloat(rotation.y);
    stream.writeFloat(rotation.z);
    stream.writeFloat(rotation.w);
    // scale (1)
    stream.writeFloat(scale);
    // Network Prefab Save Serialize
    // > SavingSystem.Serialize
    // >> Loop of component hash
    // >>> if 0, break
    // >>> component bit count
    // >>> each data value
    stream.write(0);
    // > Loop of embeddedEntityHash
    // >> if 0, break
    // >> SaveSerializeEntity (embeddedEntityHash)
    // >>> bool isAlive
    // >>> SasvingSystem.Serialize
    stream.write(0);
    // > Loop of bool (isChild)
    // >> if false, break
    // >> parent hash
    // >> BACK TO TOP (for child)
    if (!childGenerator) {
        stream.writeBit(0);
    }
    else {
        var children = childGenerator();
        while (true) {
            var child = children.next().value;
            if (!child) {
                stream.writeBit(0);
                break;
            }
            stream.writeBit(1);
            stream.write(child.parent);
            child.serialize(stream);
        }
    }
}
function streamToString(stream) {
    // Size In Bytes = Align and Flush
    var bytes = stream.alignAndFlush();
    // Hash
    var result = stream.words[0].toString() + ',';
    // Size In Bytes
    result += bytes.toString() + ',';
    // each Word
    for (var i = 0; i < stream.words.length; i++) {
        result += (stream.words[i] >>> 0) + ',';
    }
    return result;
}
var PrefabTemplate = /** @class */ (function () {
    function PrefabTemplate(hash) {
        this.children = [];
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0, w: 1 };
        this.scale = 1;
        this.hash = hash;
    }
    PrefabTemplate.prototype.addStringChild = function (parent, prefab) {
        this.children.push({ parent: parent, serialize: function (stream) { return serializeString(stream, prefab); } });
    };
    PrefabTemplate.prototype.addChild = function (parent, prefab) {
        this.children.push({ parent: parent, serialize: prefab.serialize.bind(prefab) });
    };
    PrefabTemplate.prototype.serialize = function (stream) {
        serializePrefab(stream, this.hash, this.position, this.rotation, this.scale, this.getChildren.bind(this));
    };
    PrefabTemplate.prototype.getChildren = function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < this.children.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, this.children[i]];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    };
    PrefabTemplate.prototype.toString = function () {
        var stream = new Stream();
        this.serialize(stream);
        return streamToString(stream);
    };
    return PrefabTemplate;
}());
var handle = new PrefabTemplate(prefabs_1.handleShortCool.hash);
var crossGuard = new PrefabTemplate(prefabs_1.guardPointy.hash);
var fancyGuard = new PrefabTemplate(prefabs_1.guardFancy.hash);
var blade = new PrefabTemplate(prefabs_1.daggerCurved.hash);
// blade.setPhysicalMaterial(23589);
handle.addChild(prefabs_1.handleShortCool.slotMulti, crossGuard);
crossGuard.addChild(31108, fancyGuard);
fancyGuard.addChild(39370, blade);
console.log(handle.toString());
