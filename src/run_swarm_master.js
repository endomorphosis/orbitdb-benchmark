import {ChildProcess, execSync, spawn} from 'child_process';
import { exec } from 'child_process';
import child_process from 'child_process'

import { parse } from 'path';
import {promisify} from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import process from 'process';
const execPromise = promisify(exec);

export function config(chunkSize, swarmName, port) {

    if (fs.existsSync('config.json') == false) {
        fs.writeFileSync('config.json', JSON.stringify({}), 'utf8');
    }

    let config_json = fs.readFileSync('config.json', 'utf8');
    config_json = JSON.parse(config_json);

    let chunkList = {};
    for (let i = 0; i < chunkSize; i++) {
        if (!Object.keys(config_json).includes(i.toString())) {
            chunkList[i] = {
                index: i,
                ipAddress: "127.0.0.1",
                port: port + i,
                swarmName: swarmName,
                orbitdbAddress: "",
                chunkSize: chunkSize
            };
        }
    }
    fs.writeFileSync('config.json', JSON.stringify(chunkList), 'utf8');
    return chunkList;
}


export async function runSwarmMaster(chunkSize=0) {
    const portRange = 60000;
    let processes = [];
    let process_status = [];
    let process_message = [];
    console.log("run_swarm.js: runSwarm: threads: ", chunkSize);
    let this_config = config(chunkSize, "caselaw", portRange);
    console.log("this_config")
    console.log(Object.keys(this_config).length)

    let ps_command = "ps aux | grep 'node' | grep 'orbitv3-master-swarm.js' | grep -v grep | wc -l "
    let ps_results = execSync(ps_command, {stdio: 'pipe'}).toString().trim();
    if (parseInt(ps_results) > 0)
        let kill_command = "ps aux | grep 'node' | grep 'orbitv3-master-swarm.js' | awk '{print $2}' | xargs kill -9"
        execSync(kill_command, {stdio: 'ignore', detached: true});
    }
    let this_dir = process.cwd().replace("/src", "")
    for (let i = 0; i < this_config.length ; i++) {
        const this_port = this_config[i].port;
        const this_chunkSize = this_config[i].chunkSize
        const this_swarmName = this_config[i].swarmName;
        const this_index = this_config[i].index + 1;
        let command = "node "+this_dir+"/src/orbitv3-master-swarm.js --ipAddress=127.0.0.1 " + "--port=" + this_port + " --swarmName=" + this_swarmName + " --chunkSize=" + this_chunkSize + " --index=" + this_index;
        console.log(command);
        process_status[i] = exec(command, {stdio: 'ignore', detached: true}, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                process_message[i] = error;
                return;
            }
            if (stdout) {
                console.log(`stdout: ${stdout}`);
                process_message[i] = stdout;
            }
        



        // processes[i] = exec(command, {shell: true, detached: true}, (error, stdout, stderr) => {
        //     if (error) { 
        //         console.error(`exec error: ${error}`);
        //         process_message[i] = error;
        //         return;
        //     }
        //     if (stdout) {
        //         console.log(`stdout: ${stdout}`);
        //         process_message[i] = stdout;
        //     }
        // });

    }
    console.log('run_swarm.js: processes: ', processes);

    let all_processes_dead = false;
    while (true && all_processes_dead == false) {
        await execPromise('sleep 1');
        console.log('run_swarm.js: process_message: ', process_message);
        console.log('run_swarm.js: process_status: ', process_status);
    }
    return false;
}

await runSwarmMaster(64);
