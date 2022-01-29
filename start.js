const fs = require("fs");
const StreamZip = require('node-stream-zip');
const LUA = require('luaparse');
const mysql = require('mysql');
const express = require('express');
const app = express();
const path = require('path')
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const ObjectID = mongo.ObjectID;
const readline = require('readline');
const crypto = require("crypto");
const argon2 = require("argon2");

const enableServer = true;

start();

function start() {
    if (!initConfigFile()) {
        const config = JSON.parse(fs.readFileSync("conf.json", "utf-8").toString());
        console.log(config);

        if (enableServer) {
            var server = app.listen(config.http_server.port, config.http_server.bind_ip, function () {
                var host = server.address().address
                var port = server.address().port

                console.log("\nWebserver istening at http://%s:%s", host, port)
            })
        }

        app.use(express.urlencoded({ extended: true }));
        app.use((req, res, next) => {
            if (config.other.force_https) {
                if (req.headers['x-forwarded-proto'] !== 'https')
                    // the statement for performing our redirection
                    return res.redirect('https://' + req.headers.host + req.url);
                else
                    return next();
            } else
                return next();
        });
        app.use('/', express.static('dashboard'));

        app.use('/admin', function (req, res, next) {
            if (checkAuthLevel(req))
                express.static('admin')(req, res, next);
            else res.sendStatus(403)
        });
        app.use('/api/admin*', function (req, res, next) {
            console.log("Checking permission");
            if (checkAuthLevel())
                next();
            else
                res.sendStatus(403)
        })
        app.get("/api/admin", (req, res, next) => {
            res.send({ status: "Ok" });
        })
        app.get('/api/admin/getAllMissionFiles', function (req, res, next) {
            if (checkAuthLevel(req))
                res.send(JSON.stringify(getAllMissionFiles(config)));
            else res.sendStatus(403)
        })

        app.get('/api/admin/getMissionDetails', function (req, res, next) {
            res.send(JSON.stringify(flights));
        })
        app.post('/api/admin/publishMission', function (req, res, next) {
            if (checkAuthLevel(req)) {
                console.log(req.body);
                parseMissionFile(req.body.missionFile, (parsedMiz) => {
                    console.log(parsedMiz);

                    let insData = new Object(req.body);
                    insData.parsedMiz = parsedMiz;


                    mongoConn((dbo) => {
                        dbo.collection("missions").insertOne(insData, (err, dbRes) => {
                            if (err) res.sendStatus(500);
                            else {
                                res.send(insData);
                                console.log("PUblished mission ", insData);
                            }
                        })
                    });
                });

                //res.sendStatus(200);
            }
            else res.sendStatus(403)
        })
        app.post('/api/login', (req, res, next) => {
            const parm = req.body;
            mysqlConn((con) => {
                con.query("SELECT user_password FROM forums_users LIMIT 1", function (err, result, fields) {
                    if (err) res.sendStatus(500);
                    console.log("Result: ", result[1].user_password);
                    verifyArgon2(result[1].user_password, parm.password, (val) => {
                        if (val) {
                            /*mongoConn((dbo) => {
                                let insData = { token: randomString(), userId: -1, accessLevel: 0 };
                                dbo.collection("sessions").insertOne(insData, (err, dbRes) => {
                                    if (err) res.sendStatus(500);
                                    else {
                                        console.log("User logged in:", insData);
                                        res.send(insData);
                                    }
                                })
                            })*/
                        } else {
                            res.sendStatus(401)
                        }
                    })
                });
            })
        })
        app.get('/api/getAllMissions', function (req, res, next) {
            mongoConn((dbo) => {
                dbo.collection("missions").find({}, { projection: { missionInputData: 1, _id: 1 } }).sort({ "missionInputData.MissionDateandTime": -1 }).limit(5).toArray((err, dbRes) => {
                    if (err) res.sendStatus(500);
                    else {
                        res.send(dbRes);
                        //console.log("DB Res ", dbRes);
                    }
                })
            });
        })
        app.get('/api/getMissionDetails', function (req, res, next) {
            const parm = req.query;
            mongoConn((dbo) => {
                dbo.collection("missions").findOne(ObjectID(parm.missionId), { projection: { parsedMiz: 1 } }, (err, dbRes) => {
                    if (err) res.sendStatus(500);
                    else {
                        res.send(dbRes);
                        //console.log("DB Res ", dbRes);
                    }
                })
            });
        })

        app.get('/api/getAppName', function (req, res, next) {
            res.send(config.app_personalization.name);
        })

        app.get('/api/bookMission', (req, res, next) => {
            const parm = req.query;

            mongoConn((dbo) => {
                console.log(req.query);

                let findStr = "parsedMiz." + parm.sideColor + "." + parm.flight + ".units." + parm.inflightNumber;
                let update = findStr + ".player";
                console.log(update);

                let playerName = "TestPlayer3adwad";

                dbo.collection("missions").findOne(ObjectID(parm.missionId), { projection: { [findStr]: 1 } }, (err, dbRes) => {
                    if (err) res.sendStatus(500);
                    else {
                        let slot = dbRes.parsedMiz[parm.sideColor][parm.flight].units[parm.inflightNumber];
                        if (!slot.player || slot.player == "") {
                            dbo.collection("missions").updateOne({ _id: ObjectID(parm.missionId) }, { $set: { [update]: playerName } }, (err, dbRes) => {
                                if (err) res.sendStatus(500);
                                else {
                                    res.send({ playerName: playerName })
                                }
                            })
                        } else {
                            res.sendStatus(403);
                        }
                    }
                })


            });
        })

        app.get('/api/dismissMission', function (req, res, next) {
            const parm = req.query;

            mongoConn((dbo) => {
                console.log(req.query);

                let findStr = "parsedMiz." + parm.sideColor + "." + parm.flight + ".units." + parm.inflightNumber;
                let update = findStr + ".player";
                console.log(update);

                let playerName = "";
                dbo.collection("missions").findOne(ObjectID(parm.missionId), { projection: { [findStr]: 1 } }, (err, dbRes) => {
                    if (err) res.sendStatus(500);
                    else {
                        let slot = dbRes.parsedMiz[parm.sideColor][parm.flight].units[parm.inflightNumber];
                        if (slot.player && slot.player != "") {
                            dbo.collection("missions").updateOne({ _id: ObjectID(parm.missionId) }, { $set: { [update]: playerName } }, (err, dbRes) => {
                                if (err) res.sendStatus(500);
                                else {
                                    res.send({ removed: "ok" })
                                }
                            })
                        } else {
                            res.sendStatus(403);
                        }
                    }
                })


            });
        })

        function mongoConn(connCallback) {
            let url = "mongodb://" + config.database.mongo.host + ":" + config.database.mongo.port;
            let dbName = config.database.mongo._database;
            let client = MongoClient.connect(url, function (err, db) {
                if (err) res.sendStatus(500);
                var dbo = db.db(dbName);
                connCallback(dbo);
            });
        }
        function mysqlConn(connCallback) {
            var con = mysql.createConnection(config.database.mysql);
            con.connect(function (err) {
                if (err) res.sendStatus(500);
                connCallback(con);
            });
        }



    } else {
    }
}

function checkAuthLevel(req) {
    return true;
}

function getAllMissionFiles(config) {
    let listMission = []
    for (let d of config.missions_directories) {
        for (let f of fs.readdirSync(d)) {
            let fPath = path.join(d, f);
            let fstat = fs.statSync(fPath);
            if (f.endsWith(".miz"))
                listMission.push({ filePath: fPath, missionName: toUpperFirstChar(path.basename(f, path.extname(f))), lastupdate: fstat.ctime, birthtime: fstat.birthtime })
        }
    }
    listMission = listMission.sort(function (a, b) {
        return b.lastupdate - a.lastupdate;
    });
    //console.log(listMission);
    return listMission;
}
function parseMissionFile(mizFile, success) {
    const zip = new StreamZip({
        file: mizFile,
        storeEntries: true
    });
    let flights = {};
    zip.on('ready', () => {
        let missionLua = zip.entryDataSync('mission').toString('utf8');
        let missionFileString = LUA.parse(missionLua);

        flights = getMissionFlightsFromString(missionFileString)

        //console.log(flights)
        //console.log(JSON.stringify(flights))
        //fs.writeFileSync("./output.json", JSON.stringify(flights, null, "\t"));

        success(flights);
        zip.close()
    });
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

/*
function testDB() {
    var con = mysql.createConnection(config.database.mysql);

    con.connect(function (err) {
        if (err) res.sendStatus(500);
        console.log("Connected!");
        con.query("SELECT user_password FROM forums_users LIMIT 10", function (err, result, fields) {
            if (err) res.sendStatus(500);
            console.log("Result: ", result[1].user_password);
        });
    });
}
function testMongoDB(config) {
    let url = "mongodb://" + config.database.mongo.host + ":" + config.database.mongo.port;
    let dbName = config.database.mongo._database;
    let client = MongoClient.connect(url, function (err, db) {
        if (err) res.sendStatus(500);
        var dbo = db.db(dbName);

        dbo.collection("missions").find({}).toArray(function (err, result) {
            if (err) res.sendStatus(500);
            console.log(result);
            //let res = await dbo.collection("test").insertOne({})
            db.close();
        });

    });
}
*/

function initConfigFile() {
    let emptyConfFile = {
        http_server: {
            bind_ip: "0.0.0.0",
            port: 80
        },
        database: {
            mysql: {
                host: "hostname.xx",
                port: 3306,
                user: "username",
                password: "password",
                database: "my_db"
            },
            mongo: {
                host: "0.0.0.0",
                port: 27017,
                //"_user": "",
                //"_password": "",
                database: "DCS_MissionBooking"
            }
        },
        missions_directories: [
            "missions"
        ],
        app_personalization: {
            name: "DCS Mission Booking"
        },
        other: {
            force_https: true
        }
    }
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    //let q = await rl.question("Which is the app personalized name? Leave empty to keep the default name: " + emptyConfFile.app_personalization.name + "\n> ");

    if (!fs.existsSync("conf.json")) {
        fs.writeFileSync("conf.json", JSON.stringify(emptyConfFile, null, "\t"));
        console.log("Configuration file created, set your parameters and rerun \"node start\".\nTerminating execution...");
        return true;
    }
    return false;
}
function randomString(size = 64) {
    return crypto
        .randomBytes(size)
        .toString('base64')
        .slice(0, size)
}

async function verifyArgon2(hash, comp, callback) {
    try {
        //let pwdCheck = argon2.verify("$argon2id$v=19$m=16,t=2,p=1$YWlqYW93ZGlqd2Fzdw$jgdVmVItY4EfwZTwJWr6OA", "password");
        let pwdCheck = argon2.verify(hash, comp)
        pwdCheck.then(callback)
    } catch (err) {
    }
}