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
import { LevelDatastore } from "datastore-level";
import {createRequire} from "module";
import { WebSocketServer } from 'ws'
import fs from 'fs';
import { bootstrap } from '@libp2p/bootstrap'
import { floodsub } from '@libp2p/floodsub'
import { mplex } from '@libp2p/mplex'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { kadDHT } from '@libp2p/kad-dht'

const require = createRequire(import.meta.url);
let bootstrappers = [
    '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
  ]
const ipfsLibp2pOptions = {
    addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [
        tcp(),
    ],
    streamMuxers: [
        yamux(),
        mplex()
    ],
    connectionEncryption: [
        noise()
    ],
    peerDiscovery: [
        mdns({
            interval: 20e3
        }),
        pubsubPeerDiscovery({
            interval: 1000
        }),
        bootstrap({
            list: bootstrappers
        })
    ],
    services: {
        pubsub:
            gossipsub({
                allowPublishToZeroPeers: true
            }),
        identify: identify(),
        // kadDHT: kadDHT(),
    },
    connectionManager: {

    }
}

if (bootstrappers.length > 0) {
    ipfsLibp2pOptions.peerDiscovery.push(bootstrap({
        list: bootstrappers
    }))
}

EventEmitter.defaultMaxListeners = 20;

let ipfs
let orbitdb
let db

async function run(options) {
    process.env.LIBP2P_FORCE_PNET = "1"
    const argv = require('minimist')(process.argv.slice(2))
    let ipAddress
    let dbAddress
    let index
    let chunkSize
    let swarmName
    let port
    if (!argv.ipAddress && !Object.keys(options).includes('ipAddress')) {
        ipAddress = "127.0.0.1"
    } else if (Object.keys(options).includes('ipAddress')){
        ipAddress = options.ipAddress
    }
    else if (argv.ipAddress) {
        ipAddress = argv.ipAddress
    }
    
    if (!argv.swarmName && !options.swarmName) {
        console.error('Please provide a swarm Name');
        process.exit(1);
    }
    else if (Object.keys(options).includes('swarmName')) {
        swarmName = options.swarmName
    }
    else if (argv.swarmName) {
        swarmName = argv.swarmName
    }
    
    if (!argv.port && !Object.keys(options).includes('port')) {
        console.error('Please provide a port number');
        process.exit(1);
    }else if (Object.keys(options).includes('port')) {
        port = options.port
    }else if (argv.port) {
        port = argv.port
    }

    if (!argv.chunkSize && !Object.keys(options).includes('chunkSize')) {
        console.error('Please provide a chunk size');
        process.exit(1);
    }else if (Object.keys(options).includes('chunkSize')) {
        chunkSize = options.chunkSize
    }else if (argv.chunkSize) {
        chunkSize = argv.chunkSize
    }

    if (!argv.index && !Object.keys(options).includes('index')) {
        console.error('Please provide an index');
        process.exit(1);
    }
    else if (Object.keys(options).includes('index')) {
        index = options.index
    }
    else if (argv.index) {
        index = argv.index
    }

    process.on('SIGTERM', handleTerminationSignal);
    process.on('SIGINT', handleTerminationSignal);
    const id = index

    const libp2p = await createLibp2p({
        addresses: {
            //listen: [`/ip4/${ipAddress}/tcp/0`]
            listen: ['/ip4/0.0.0.0/tcp/0']
        }, ...ipfsLibp2pOptions
    })
    const blockstore = new LevelBlockstore(`./ipfs/`+id+`/blocks`)
    const datastore = new LevelDatastore(ipfsDSDirectory);
    ipfs = await createHelia({blockstore: blockstore, libp2p: libp2p, datastore: datastore, blockBrokers: [bitswap()]})
    const identities = await Identities({ipfs, path: `./orbitdb/`+id+`/identities`})
    identities.createIdentity({id}) // Remove the unused variable 'identity'
    orbitdb = await createOrbitDB({ipfs: ipfs, identities, id: id, directory: `./orbitdb/`+id})

    db = await orbitdb.open(swarmName+"-"+index+"-of-"+chunkSize,
        {
            type: 'documents',
            AccessController: OrbitDBAccessController({write: ["*"]})
        })
    let config_json
    if (fs.existsSync('config.json') === false) {
        fs.writeFileSync('config.json', JSON.stringify([]), 'utf8');
    }

    if (fs.existsSync('config.json') === true) {
        config_json = fs.readFileSync('config.json', 'utf8');
        config_json = JSON.parse(config_json);
        let config_json_length = Object.keys(config_json).length;
        while((config_json_length - 1) < parseInt(index)) {
            config_json.push({});
            config_json_length = Object.keys(config_json).length;
        }
        if (Object.keys(config_json[index]).includes("orbitdbAddress") === true) {
            config_json[index]["orbitdbAddress"] = db.address.toString();
        }
        else {
            config_json[index] = {
                index: index,
                ipAddress: ipAddress,
                port: port,
                swarmName: swarmName,
                orbitdbAddress: db.address.toString(),
                chunkSize: chunkSize
            };
        }
        fs.writeFileSync('config.json', JSON.stringify(config_json), 'utf8');
    }
    console.info(`running with db address ${db.address}`)
    // Add a new WebSocket server
    const wss = new WebSocketServer({ port: port })
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');
        ws.on('message', (message) => {
            message = JSON.parse(message.toString());
            console.log('Received message:', message);
            let method = Object.keys(message)[0];
            let data = message[method];
            // Handle WebSocket messages here
            switch (method) {
                case 'insert':
                    // Handle insert logic
                    let insertKey = data._id;
                    let insertValue = data.content;
                    console.log('Inserting data: ', insertKey, insertValue);
                    validate(insertValue).then((result) => {
                        if (result) {
                            db.put(data).then(() => {
                                console.log('Data inserted:', data);
                                ws.send('Data inserted');
                            }).catch((error) => {
                                console.error('Error inserting data:', error);
                                ws.send('Error inserting data');
                            });
                        }
                        else{
                            console.error('Data validation failed:', insertValue);
                            ws.send('Data validation failed');
                        }
                    });
                    break;
                case 'update':
                    // Handle update logic
                    let updateKey = data._id;
                    let updateValue = data.content;
                    let updatedDoc = {_id: updateKey, content: updateValue};
                    let docToUpdate = db.get(updateKey).then((doc) => {
                        validate(updatedDoc).then((result) => {
                            db.put(updatedDoc).then(() => {
                                console.log('Data updated:', data);
                                ws.send('Data updates');
                            }).catch((error) => {
                                console.error('Error updating data:', error);
                                ws.send('Error updating data');
                            });
                        }).catch((error) => {
                            console.error('Error updating data:', error);
                            ws.send('Error updating data');
                        })
                    }).catch((error) => {
                        console.error('Error upfating document:', error);
                        ws.send('Error updating document');
                    });
                    break;
                case 'select':
                    // Handle select logic
                    let selectID = data._id;
                    let docToSelect = db.get(selectID).then((doc) => {
                        console.log('Selected document:', doc);
                        ws.send(JSON.stringify(doc));
                    }).catch((error) => {
                        console.error('Error selecting document:', error);
                        ws.send('Error selecting document');
                    })
                    break;
                case 'delete':
                    // Handle delete by ID logic
                    let deleteId = data._id;
                    let docToDelete = db.get(deleteId).then((doc) => {
                        db.del(deleteId).then((deletedDoc) => {
                            console.log('Document deleted:', deletedDoc);
                            ws.send('Document deleted');
                        }).catch((error) => {
                            console.error('Error deleting document:', error);
                            ws.send('Error deleting document');
                        });
                    }).catch((error) => {
                        console.error('Error deleting document:', error);
                        ws.send('Error deleting document');
                    });
                    break;
                default:
                    console.log('Unknown message:', message);
                    break;
            }
        });
    });
}

async function handleTerminationSignal() {
    console.info('received termination signal, cleaning up and exiting...');
    await db.close()
    await orbitdb.stop()
    await ipfs.stop()
    process.exit();
}

async function validate() {
    // Add validation logic here
    return true;
}

async function test() {
    let ipAddress = "127.0.0.1"
    let orbitdbAddress = undefined
    let index = 4
    let chunkSize = 8  
    let swarmName = "caselaw"
    let port = 60003

    let test = {
        ipAddress: ipAddress,
        orbitdbAddress: orbitdbAddress,
        index: index,
        chunkSize: chunkSize,
        swarmName: swarmName,
        port: port
    }
    return await run(test)
}

//await test()
await run({})