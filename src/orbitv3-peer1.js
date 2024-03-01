import {createOrbitDB, Identities, OrbitDBAccessController} from '@orbitdb/core'
import {createHelia} from 'helia'
import {v4 as uuidv4} from 'uuid';
import {EventEmitter} from "events";
import {createLibp2p} from 'libp2p'
import {identify} from '@libp2p/identify'
import {noise} from '@chainsafe/libp2p-noise'
import {yamux} from '@chainsafe/libp2p-yamux'
import {gossipsub} from '@chainsafe/libp2p-gossipsub'
import {bitswap} from '@helia/block-brokers'
import {tcp} from '@libp2p/tcp'
import {mdns} from '@libp2p/mdns'
import {LevelBlockstore} from 'blockstore-level'
import {createRequire} from "module";

const require = createRequire(import.meta.url);

const ipfsLibp2pOptions = {
    transports: [
        tcp(),
    ],
    streamMuxers: [
        yamux()
    ],
    connectionEncryption: [
        noise()
    ],
    peerDiscovery: [
        mdns({
            interval: 20e3
        })
    ],
    services: {
        pubsub: gossipsub({
            allowPublishToZeroPeers: true
        }),
        identify: identify()
    },
    connectionManager: {}
}

EventEmitter.defaultMaxListeners = 20;

let ipfs
let orbitdb
let db

async function run() {
    process.env.LIBP2P_FORCE_PNET = "1"
    const argv = require('minimist')(process.argv.slice(2))
    if (!argv.ipAddress) {
        console.error("ipAddress not passed")
        throw new Error("ipAddress not passed")
    }

    process.on('SIGTERM', handleTerminationSignal);
    process.on('SIGINT', handleTerminationSignal);
    console.info('Script is running. Press CTRL+C to terminate.');

    const libp2p = await createLibp2p({
        addresses: {
            listen: [`/ip4/${argv.ipAddress}/tcp/0`]
        }, ...ipfsLibp2pOptions
    })
    const blockstore = new LevelBlockstore(`./ipfs/1/blocks`)
    ipfs = await createHelia({blockstore: blockstore, libp2p: libp2p, blockBrokers: [bitswap()]})
    const identities = await Identities({ipfs, path: `./orbitdb/1/identities`})
    const id = "1"
    const identity = identities.createIdentity({id})
    orbitdb = await createOrbitDB({ipfs: ipfs, identities, id: `1`, directory: `./orbitdb/1`})

    db = await orbitdb.open('test',
        {
            type: 'documents',
            AccessController: OrbitDBAccessController({write: ["*"]})
        })
    console.info(`running with db address ${db.address}`)
    console.info(`${new Date().toISOString()} adding data`)
    for (let i = 0; i < 10000; i++) {
        // await new Promise(r => setTimeout(r, 300));
        const doc = {_id: uuidv4(), content: "content " + i}
        if (i % 1000 === 0 && i !== 0) {
            console.debug(`added 1k of data`)
        }
        // console.debug(`putting data ${JSON.stringify(doc)}`)
        await db.put(doc)
    }
    console.info(`${new Date().toISOString()} finished adding data`)
}

async function handleTerminationSignal() {
    console.info('received termination signal, cleaning up and exiting...');
    await db.close()
    await orbitdb.stop()
    await ipfs.stop()
    process.exit();
}

await run()