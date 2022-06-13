import express from "express"
import fileUpload from "express-fileupload"
import csv from "csvtojson"
import axios from "axios"
import { dbConn } from "./cache.service.js"

//init sqlite database
initDb()
const app = express()
const port = 3000

app.use(express.json())

app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

app.get('/sql', async (req, res) => {
    const db = await dbConn();
    const result = await db.all('SELECT * from player');
    const [insertResult, errorSelect] = await selectPlayerData(1);
    if (!insertResult || errorSelect) {
        throw new Error(errorSelect || 'error selecting')
    }
    res.json({ out: insertResult, zz: result })
})

app.get('/health', (req, res) => {
    res.send('healthy')
})

app.post('/player', async (req, res) => {
    try {
        const csvFile = req.files.csv
        const filePath = csvFile.tempFilePath
        /*parsing file from req*/
        const csvPlayerData = await csv().fromFile(filePath);
        if (!csvPlayerData[0].nickname) {
            throw new Error("error parsing file")
        }
        /*looping over data and making api call*/
        const fullPlayerData = []
        for await (const playerData of csvPlayerData) {

            //check if data on player is cached
            const [cachedPlayerData, fetchCachedError] = await selectPlayerData(playerData.id)
            if (cachedPlayerData) {

                console.log('calling cache')
                const newData = {
                    id: playerData.id,
                    nickname: playerData.nickname,
                    first_name: cachedPlayerData.first_name,
                    last_name: cachedPlayerData.last_name,
                    team_id: cachedPlayerData.team_id,
                    team_full_name: cachedPlayerData.team_full_name
                }
                fullPlayerData.push(newData)
                continue;
            }

            console.log('calling api')

            const [outPut, fatchError] = await getPlayerData(playerData.id)
            if (!outPut || fatchError) {
                //throw new Error(fatchError || "error fatching player data")
                res.json({ error: "error fatching player data:" + playerData.id })
                return
            }

            const newData = {
                id: playerData.id,
                nickname: playerData.nickname,
                first_name: outPut.first_name,
                last_name: outPut.last_name,
                team_id: outPut.team.id,
                team_full_name: outPut.team.full_name
            }
            await wirtePlayerToTable(newData)
            fullPlayerData.push(newData)
        }

        const data = { filePath, jsonArray: csvPlayerData, fullPlayerData }
        res.json(data)
    } catch (error) {
        console.error("🚀 ~ file: index.js ~ line 29 ~ app.post ~ error", error)
        res.json({ error: error.stack || error.message || "an error has occured" })
    }
})

async function getPlayerData(playerId) {
    try {
        if (isNaN(playerId)) {
            return [null, "bad player id"]
        }
        const response = await axios.get('https://www.balldontlie.io/api/v1/players/' + playerId);
        return [response.data, null]
    } catch (error) {
        console.error(error);
        return [null, error]
    }
}

async function wirtePlayerToTable({ id, nickname, first_name, last_name, team_id, team_full_name }) {
    console.log("🚀 ~ file: index.js ~ line 81 ~", {
        id, nickname, first_name, last_name,
        team_id, team_full_name
    })
    try {
        const db = await dbConn();
        const player_id = id
        const playerValues = [player_id, nickname, first_name, last_name,
            team_id, team_full_name];
        const placeholders = playerValues.map((key) => '?').join(',');
        const sql = 'INSERT INTO player(player_id, nickname, first_name, last_name,team_id, team_full_name) VALUES (' + placeholders + ')';
        console.log("🚀 ~ file: index.js ~ line 88 ~ sql", { sql })

        const insertResult = await db.run(sql, playerValues)
        return [insertResult, null]
    } catch (error) {
        console.error("🚀 ~ file: index.js ~ line 95 ~ wirtePlayerToTable ~ error", error)
        return [null, error]
    }
}

async function selectPlayerData(playerId) {
    try {
        if (isNaN(playerId)) {
            throw new Error('bad playerId: ' + playerId)
        }
        const db = await dbConn();


        const sql = 'SELECT * FROM player WHERE player_id = ?';

        const [insertResult] = await db.all(sql, [playerId]);
        console.log("🚀 ~ file: index.js ~ line 92 ~ insertResult", insertResult)
        return [insertResult, null]

    } catch (error) {
        console.log("🚀 ~ file: index.js ~ line 106 ~ getPlayerData ~ error", error)
        return [null, error]
    }
}

// app.post('/player',(req, res) => {
//     try {
//         const csvFile = req.files.csv
//         console.log("🚀 ~ file: index.js ~ line 20 ~ app.post ~ csvFile", csvFile)
//         if(csvFile === undefined || csvFile.tempFilePath.length < 1){
//             res.json({error:"bad file"})
//             return
//         }
//         const data = {id:0};
//         res.json(data)
//     } catch (error) {
//         console.log("🚀 ~ file: index.js ~ line 29 ~ app.post ~ error", error)
//         res.json(error)
//     }
// }) 




app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})




async function initDb() {
    try {
        const db = await dbConn();
        const sql = `CREATE TABLE IF NOT EXISTS player(
        player_id INTEGER PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        nickname TEXT NOT NULL,
        team_id TEXT NOT NULL,
        team_full_name TEXT NOT NULL 
        )`;
        db.all(sql)
    } catch (error) {
        console.log("🚀 ~ file: index.js ~ line 117 ~ initDb ~ error", error)
    }

}