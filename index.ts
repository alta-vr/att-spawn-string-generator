import bitwise from 'bitwise';
import { Bit } from 'bitwise/types';

const ieee754 = require('ieee754');

import { Handle_Medium_Branch, Short_Sword_Blade, Guard_Pointy_Ends, Guard_Fancy } from './prefabs';

// import createDatabaseCode from './prefabsDatabaseCreator';

// createDatabaseCode();

type Vector3 =
{
    x:number,
    y:number,
    z:number
}

type Quaternion =
{
    x:number,
    y:number,
    z:number,
    w:number
}

type Child =
{
    parent:number, 
    serialize:(stream:Stream)=>void
}

class Stream
{
    scratch:number;

    words = [];
    bitIndex = 0;
    totalBits = 0;

    writeFloat(value:number)
    {
        var buffer:Buffer = Buffer.from(new Uint8Array(4));

        ieee754.write(buffer, value, 0, true, 23, 4);

        this.write(buffer.readInt32LE(0));
    }

    write(value:number)
    {
        for (var i = 0; i < 32; i++)
        {
            this.writeBit(bitwise.integer.getBit(value, 31 - i));
        }
    }

    writeBit(bit:Bit)
    {
        this.scratch = bitwise.integer.setBit(this.scratch, 31 - this.bitIndex, bit);

        this.bitIndex++;
        this.totalBits++;

        if (this.bitIndex == 32)
        {
            this.words.push(this.scratch);
            this.scratch = 0;
            this.bitIndex = 0;
        }
    }

    alignAndFlush()
    {
        while ((this.totalBits % 8) != 0)
        {
            this.writeBit(0);
        }

        var shift = 32 - this.bitIndex;

        for (var i = 31; i >= shift; i--)
        {
            this.scratch = bitwise.integer.setBit(this.scratch, 31 - i, bitwise.integer.getBit(this.scratch, i - shift));
            this.scratch = bitwise.integer.setBit(this.scratch, 31 - i - shift, 0);
        }

        this.words.push(this.scratch);
        this.scratch = 0;
        this.bitIndex = 0;

        return this.totalBits / 8;
    }
}

function serializeString(stream:Stream, value: string)
{    
    if (value.includes("|"))
    {
        var parts:string[] = value.split('|');

        value = parts[0];
    }

    var split : string[] = value.split(',');
    
    for (var i = 0; i < split.length - 1; i++)
    {
        stream.write(parseInt(split[i]));
    }
}

function serializePrefab(stream:Stream, hash : number, position : Vector3, rotation : Quaternion, scale : number, childGenerator : undefined|(()=>IterableIterator<Child>))
{
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
    if (!childGenerator)
    {
        stream.writeBit(0);
    }
    else
    {
        var children = childGenerator();

        while (true)
        {
            var child = children.next().value;

            if (!child)
            {
                stream.writeBit(0);
                break;
            }

            stream.writeBit(1);
            stream.write(child.parent);
            
            child.serialize(stream);
        }
    }
}

function streamToString(stream:Stream)
{
    // Size In Bytes = Align and Flush
    var bytes = stream.alignAndFlush();

    // Hash
    var result = stream.words[0].toString() + ',';

    // Size In Bytes
    result += bytes.toString() + ',';

    // each Word
    for (var i = 0; i < stream.words.length; i++)
    {
        result += (stream.words[i] >>> 0) + ',';
    }

    return result;
}

class PrefabTemplate
{
    hash:number;

    children:Child[] = [];
    
    position:Vector3 = {x:0, y:0, z:0};

    rotation:Quaternion = {x:0, y:0, z:0, w:1};

    scale:number = 1;

    constructor(hash:number)
    {
        this.hash = hash;
    }

    addStringChild(parent:number, prefab:string)
    {
        this.children.push({ parent, serialize:stream => serializeString(stream, prefab)});
    }

    addChild(parent:number, prefab:PrefabTemplate)
    {
        this.children.push({ parent, serialize:prefab.serialize.bind(prefab) });
    }

    serialize(stream:Stream)
    {
        serializePrefab(stream, this.hash, this.position, this.rotation, this.scale, this.getChildren.bind(this));
    }

    * getChildren() : IterableIterator<Child>
    {
        for (var i = 0; i < this.children.length; i++)
        {
            yield this.children[i];
        }
    }

    toString()
    {
        var stream:Stream = new Stream();

        this.serialize(stream);

        return streamToString(stream);        
    }
}

var handle = new PrefabTemplate(Handle_Medium_Branch.hash);
var crossGuard = new PrefabTemplate(Guard_Pointy_Ends.hash);
var fancyGuard = new PrefabTemplate(Guard_Fancy.hash);
var blade = new PrefabTemplate(Short_Sword_Blade.hash);

// blade.setPhysicalMaterial(23589);

handle.addChild(Handle_Medium_Branch.Slot_Multi, crossGuard);
crossGuard.addChild(Guard_Pointy_Ends.Slot_Multi, fancyGuard);
fancyGuard.addChild(Guard_Fancy.Slot_SwordType, blade);

console.log(handle.toString());