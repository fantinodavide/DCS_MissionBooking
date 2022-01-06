const fs = require("fs");
const StreamZip = require('node-stream-zip');
const LUA = require('luaparse');
const mysql = require('mysql');
const express = require('express');
const app = express();
const path = require('path')

const enableServer = false;

var mizFile = "missions/example.miz";
const zip = new StreamZip({
    file: mizFile,
    storeEntries: true
});

const config = JSON.parse(fs.readFileSync("conf.json", "utf-8").toString());
console.log(config);

let flights = {};
zip.on('ready', () => {
    let missionLua = zip.entryDataSync('mission').toString('utf8');
    let missionFileString = LUA.parse(missionLua);

    flights = getMissionFlightsFromString(missionFileString)

    //console.log(flights)
    //console.log(JSON.stringify(flights))
    //fs.writeFileSync("./output.json", JSON.stringify(flights));

    if (enableServer) {
        var server = app.listen(config.http_server.port, config.http_server.bind_ip, function () {
            var host = server.address().address
            var port = server.address().port

            console.log("\nWebserver istening at http://%s:%s", host, port)
        })
    }

    zip.close()
});

app.use('/', express.static('dashboard'));
/*app.get('/', function (req, res, next) {
    res.send(JSON.stringify(flights));
    //next();
})*/
app.get('/api/getMissionDetails', function (req, res, next) {
    //console.log("GET=> ",req.query)
    console.log("POST=> ", req.body)
    res.send(JSON.stringify(flights));
})
app.get('/api/getAllMissions', function (req, res, next) {
    //console.log("GET=> ",req.query)
    //console.log("POST=> ",req.body)
    res.send(JSON.stringify(getAllMissions()));
})

getAllMissions();

function getAllMissions() {
    let listMission = []
    for (let d of config.missions_directories) {
        for (let f of fs.readdirSync(d)) {
            let fstat = fs.statSync(path.join(d, f));
            if (f.endsWith(".miz"))
                listMission.push({ fileName: f, missionName: toUpperFirstChar(path.basename(f, path.extname(f))), lastupdate: fstat.ctime, birthtime: fstat.birthtime })
        }
    }
    listMission = listMission.sort(function (a, b) {
        return b.lastupdate - a.lastupdate;
    });
    console.log(listMission);
    return listMission;
}

function getMissionFlightsFromString(missionFile) {
    let flightsReturn = {};
    for (let o of missionFile.body[0].init[0].fields) {
        let key = o.key.raw.replace(/\"/g, '');
        if (key == "coalition") {
            for (let o2 of o.value.fields) {
                let side = o2.key.raw.replace(/\"/g, '');
                if (!flightsReturn[side]) flightsReturn[side] = {};

                for (let o3 of o2.value.fields) {
                    if (o3.key.raw.replace(/\"/g, '') == "country") {
                        for (let c of o3.value.fields) {
                            for (let o4 of c.value.fields) {
                                if (o4.key.raw.replace(/\"/g, '') == "plane") {
                                    for (let fGroups of o4.value.fields[0].value.fields) {
                                        //console.log(fGroups);
                                        //flights[side].push();
                                        let fInfo = {};
                                        let fName = "";
                                        for (let i = 0; i < 2; i++) {
                                            for (let o5 of fGroups.value.fields) {
                                                let o5Key = o5.key.raw.replace(/\"/g, '');
                                                let valRaw = o5.value.raw ? o5.value.raw.replace(/\"/g, '') : "";
                                                if (o5Key == "name") {
                                                    if (!flightsReturn[side][valRaw]) flightsReturn[side][valRaw] = {};
                                                    fName = valRaw
                                                }
                                                if (flightsReturn[side][fName]) {
                                                    if (o5Key == "task") {
                                                        flightsReturn[side][fName].task = valRaw;
                                                    } if (o5Key == "units") {
                                                        if (!flightsReturn[side][fName]["units"]) flightsReturn[side][fName]["units"] = {};
                                                        for (let aircraft of o5.value.fields) {
                                                            flightsReturn[side][fName]["units"][aircraft.key.value] = {}
                                                            for (let aInfo of aircraft.value.fields) {
                                                                let aSubInfoKey = aInfo.key.raw.replace(/\"/g, '');
                                                                let aSubInfoValue;
                                                                try {
                                                                    aSubInfoValue = aInfo.value.raw.replace(/\"/g, '');
                                                                } catch (error) { }
                                                                if (aSubInfoKey == "type") flightsReturn[side][fName].aircraftType = aSubInfoValue;

                                                                if (["type", "unitid", "name", "parking", "skill"].includes(aSubInfoKey)) {
                                                                    //console.log((aircraft.key.value + ") " + aSubInfoKey + ": "), aSubInfoValue)
                                                                    flightsReturn[side][fName]["units"][aircraft.key.value][aSubInfoKey] = aSubInfoValue;
                                                                }
                                                            }
                                                        }
                                                        //flights[side][fName].units = valRaw;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            break;
        }
    }
    return flightsReturn
}
function toUpperFirstChar(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function testDB() {
    var con = mysql.createConnection(config.database);

    con.connect(function (err) {
        if (err) throw err;
        console.log("Connected!");
        con.query("SELECT user_password FROM forums_users LIMIT 10", function (err, result, fields) {
            if (err) throw err;
            console.log("Result: ", result[1].user_password);
        });
    });
}

function initConfigFile(){
    let emptyConfFile = {
        http_server: {
            "bind_ip": "127.0.0.1",
            "port": 80
        },
        database: {
            "host": "hostname.xx",
            "port": 3306,
            "user": "username",
            "password": "password",
            "database": "my_db"
        },
        missions_directories: [
            "missions"
        ]
    }
}