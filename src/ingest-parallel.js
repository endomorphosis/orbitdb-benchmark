import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import  { Float16Array, getFloat16, setFloat16 } from '@petamoriken/float16';
import { WebSocketServer } from 'ws'

const parent_dir = path.dirname("..");
const resolve_path = path.resolve(parent_dir)
const collection_path = path.join(resolve_path, 'collection.json');



function floatTo16BitBytes(value) {
    if (value < -1 || value > 1) {
        throw new Error('Value must be between -1 and 1.');
    }

    // Scale float from [-1, 1] to [-32768, 32767]
    const scaled = Math.floor(value * 32767);

    // Convert to 16-bit signed integer
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setInt16(0, scaled, true); // true for littleEndian

    // Get bytes
    const byte1 = view.getUint8(0);
    const byte2 = view.getUint8(1);
    return [byte1, byte2];
}

function float16VectorToBase64(vector) {
    let byte_array = [];
    for (let i = 0; i < vector.length; i++){
        let this_bytes = floatTo16BitBytes(vector[i]);
        byte_array.push(this_bytes[0]);
        byte_array.push(this_bytes[1]);
    }
    //convert byte_array to base64
    let base64 = Buffer.from(byte_array).toString('base64');
    return base64;
}

export default async function main(collection_path){
    let chunkSize = 8;
    let dimensions = 768;
    let num_vectors = 4096;
    let config = fs.readFileSync('config.json', 'utf8');
    let config_json = JSON.parse(config);
    let ws_list = [];
    let first_send = Date.now();
    let first_recv;
    let final_recv;
    let delta_time;
    let recieved_count = 0;
    for (let i = 0; i < chunkSize; i++){
        let port = config_json[i].port - 40000;
        let ipAddress = config_json[i].ipAddress;
        let swarmName = config_json[i].swarmName;
        let index = config_json[i].index;
        let dbAddress = config_json[i].orbitdbAddress;
        let id = index;
        let knn_index = {};
        let ingest_count = 0;
        ws_list[i] = new WebSocketServer({ port: port })
        ws_list[i].on('connection', (ws) => {
            console.log('New WebSocket connection');
            ws.on('message', (message) => {
                message = JSON.parse(message.toString());
                console.log('Received message:', message);
                let method = Object.keys(message)[0];
                let data = message[method];
                // Handle WebSocket messages here
                switch (method) {
                    case 'ingest':
                        let ingestKey = data._id;
                        let ingestValue = data.content;
                        console.log('Ingesting data: ', ingestKey, ingestValue);
                        knn_index[ingestKey] = ingestValue;
                        ingest_count++;
                        break;
                    default:
                        console.log('Unknown message:', message);
                        break;
                }
            });
        });
    }
    console.log("All messages sent");
    console.log("Time to send all messages: ");
    let finish_send = Date.now();
    delta_time = finish_send - first_send;
    // in seconds
    delta_time = delta_time / 1000;
    console.log(delta_time);
}

main(collection_path);