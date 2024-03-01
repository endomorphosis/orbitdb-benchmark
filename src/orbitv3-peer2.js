import {createOrbitDB, Identities, OrbitDBAccessController} from '@orbitdb/core'
import {createHelia} from 'helia'
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
  connectionManager: {
  }
}

EventEmitter.defaultMaxListeners = 20;

let ipfs
let orbitdb
let db

async function run () {
  const argv = require('minimist')(process.argv.slice(2))
  if (!argv.ipAddress) {
    console.error("ipAddress not passed")
    throw new Error("ipAddress not passed")
  }
  if (!argv.dbAddress) {
    console.error("dbAddress not passed")
    throw new Error("dbAddress not passed")
  }
  process.on('SIGTERM', handleTerminationSignal);
  process.on('SIGINT', handleTerminationSignal);
  console.info('Script is running. Press CTRL+C to terminate.');

  const libp2p = await createLibp2p({  addresses: {
      listen: [`/ip4/${argv.ipAddress}/tcp/0`]
    }, ...ipfsLibp2pOptions})
  const blockstore = new LevelBlockstore(`./ipfs/2/blocks`)
  ipfs = await createHelia({blockstore: blockstore, libp2p: libp2p, blockBrokers: [bitswap()]})
  const identities = await Identities({ ipfs, path: `./orbitdb/2/identities` })
  const id = "2"
  const identity = identities.createIdentity({ id })
  orbitdb = await createOrbitDB({ipfs: ipfs, identities, id: `2`, directory: `./orbitdb/2`})

  db = await orbitdb.open(argv.dbAddress,
      {type: 'documents',
        AccessController: OrbitDBAccessController({ write: ["*"], sync: false}),
      })
  let oldHeads = await db.log.heads()
  console.debug(`${new Date().toISOString()} initial heads ${JSON.stringify(Array.from(oldHeads, h => h.payload))}`)
  await new Promise(r => setTimeout(r, 5000));
  await db.close()
  console.debug(`${new Date().toISOString()} opening db for sync`)
  db = await orbitdb.open(argv.dbAddress,
      {type: 'documents',
        AccessController: OrbitDBAccessController({ write: ["*"]}),
      })
  db.events.on('join', async (peerId, heads) => {
    for await (let entry of heads) {
      console.info(`peer ${peerId} joined with head ${JSON.stringify(entry.payload)}`)
    }
    if (oldHeads) {
      for (let hash of Array.from(oldHeads, h => h.hash)) {
        let it = db.log.iterator({gt: hash})
        for await (let entry of it) {
          //console.debug(`new startup entry ${JSON.stringify(entry.payload)}`)
          oldHeads = [entry]
        }
      }
    }
  })
  console.info(`${new Date().toISOString()}running with db address ${db.address}`)

  console.info(`${new Date().toISOString()} getting updates ...`)
  db.events.on('update', async (entry) => {
      //console.debug(`new head entry op ${entry.payload.op} with value ${JSON.stringify(entry.payload.value)}`)
      if (oldHeads) {
        for (let hash of Array.from(oldHeads, h => h.hash)) {
          let it = db.log.iterator({gt: hash, lte: entry.hash})
          for await (let entry of it) {
            //console.debug(`new updated entry ${JSON.stringify(entry.payload)}`)
            oldHeads = [entry]
          }
        }
      } else {
        let it = db.log.iterator({lte: entry.hash})
        for await (let entry of it) {
          //console.debug(`new updated entry ${JSON.stringify(entry.payload)}`)
          oldHeads = [entry]
        }
      }
  })
  console.info(`${new Date().toISOString()} searching result: `)
  let result = await db.query(data => {
    return data.content === "content 5000"
  })
  console.info(`${new Date().toISOString()} result: `, JSON.stringify(result))
}

async function handleTerminationSignal() {
  console.info('received termination signal, cleaning up and exiting...');
  await db.close()
  await orbitdb.stop()
  await ipfs.stop()
  process.exit();
}

await run()