import sqlite3 from "sqlite3"
import * as sqlite from "sqlite"

// import {open} from "sqlite3"
const {open} = sqlite
import path from "path"
import fs from "fs"
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const verboseSqlite = sqlite3.verbose()
// const { open } = require('sqlite');
// const path = require('path');

const fsp = fs.promises;

async function checkFileExists(file) {
    try {
        return await fsp.stat(file);
    } catch (error) {
        return false;
    }
}

export async function dbConn() {
    try {
        const dbFile = 'main.db';
        const dir = path.join(__dirname, 'data');
        const dbFilePath = path.join(dir, dbFile);
        const fileExists = await checkFileExists(dbFilePath);

        if (!fileExists) {
            await fsp.mkdir(dir, { recursive: true });
            await fsp.writeFile(dbFilePath, '');
        }

        const db = await open({
            filename: dbFilePath,
            driver: verboseSqlite.Database,
        });
        
        return db;
    } catch (error) {
        throw new Error(error);
    }
}