const versionN = "1.62";

const fs = require("fs");
const StreamZip = require('node-stream-zip');
const LUA = require('luaparse');
const mysql = require('mysql');
const https = require('https');
const express = require('express');
const app = express();
const path = require('path')
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const ObjectID = mongo.ObjectID;
const readline = require('readline');
const crypto = require("crypto");
const argon2 = require("argon2");
const bodyParser = require('body-parser');
const res = require("express/lib/response");
const cookieParser = require('cookie-parser');
const { application } = require("express");
const nocache = require('nocache');
const axios = require('axios');
const log4js = require('log4js');
const WebSocket = require('ws');

const enableServer = true;
var errorCount = 0;

let tmpData = new Date();
const logFile = path.join(__dirname, 'logs', (tmpData.toISOString().replace(/T/g, "_").replace(/(:|-|\.|Z)/g, "")) + ".log");
if (!fs.existsSync('logs')) fs.mkdirSync('logs');
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "");


log4js.configure({
    appenders: { App: { type: "file", filename: logFile } },
    categories: { default: { appenders: ["App"], level: "all" } }
});
const logger = log4js.getLogger("App");
extendLogging()
console.log("Log-file:", logFile);

var wss;
var server;

start();

function start() {
    if (!initConfigFile()) {
        const config = JSON.parse(fs.readFileSync("conf.json", "utf-8").toString());
        console.log(config);

        checkUpdates(config.other.automatic_updates, () => {
            if (enableServer) {
                const privKPath = 'certificates/privatekey.pem';
                const certPath = 'certificates/certificate.pem';
                if (fs.existsSync(privKPath) && fs.existsSync(certPath)) {
                    const httpsOptions = {
                        key: fs.readFileSync(privKPath),
                        cert: fs.readFileSync(certPath)
                    }
                    server = https.createServer(httpsOptions, app);
                    server.listen(config.http_server.https_port);
                    //wss = new WebSocket.Server({ server });
                    console.log("\HTTPS server listening at https://%s:%s", config.http_server.bind_ip, config.http_server.https_port)
                    handleUpgrade(server);
                } else {
                    server = app.listen(config.http_server.port, config.http_server.bind_ip, function () {
                        var host = server.address().address
                        var port = server.address().port

                        console.log("\HTTP server listening at http://%s:%s", host, port)
                        handleUpgrade(server);
                    })
                }
                wss = new WebSocket.Server({ noServer: true });
                if (wss) console.log("WSS server listening")
                wss.on('connection', function connection(ws, req, client) {
                    ws.on('message', function message(data) {
                        console.log('WS received: ', data.toString(), client);
                        wssBroadcast(data, ws);
                    });
                });
                function handleUpgrade(server) {
                    console.log("Setup server upgrade handling");
                    server.on('upgrade', (request, socket, head) => {
                        wss.handleUpgrade(request, socket, head, (ws, request, client) => {
                            wss.emit('connection', ws, request, client);
                        });
                    });
                }

            }
        });


        app.use(nocache());
        app.set('etag', false)
        app.use("/", bodyParser.json());
        app.use("/", bodyParser.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(forceHTTPS);
        //app.use(express.urlencoded({ extended: true }));

        app.use('/', express.static('dashboard'));
        app.use("/m/:mission_id", function (req, res, next) {
            let mizId = req.params.mission_id;
            let header;
            express.static('dashboard')(req, res, next);
        })

        app.use('*', getSession);
        app.use('/api/*', requireLogin);
        app.use('*', authorizeDCSUsers)

        app.use('/admin*', authorizeAdmin)
        app.use('/publishment*', authorizeAdmin)

        app.use('/publishment', function (req, res, next) {
            express.static('admin')(req, res, next);
        });
        app.use('/api/admin*', authorizeAdmin)

        app.get("/api/admin", (req, res, next) => {
            res.send({ status: "Ok" });
        })
        app.get("/api/admin/getConfig", (req, res, next) => {
            res.send(config);
        })
        app.get('/api/admin/getAllMissionFiles', function (req, res, next) {
            res.send(JSON.stringify(getAllMissionFiles(config)));
        })
        app.get('/api/admin/getMissionDetails', function (req, res, next) {
            res.send(JSON.stringify(flights));
        })
        app.get('/api/admin/testParseMission', function (req, res, next) {
            console.log(req.body);
            //parseMissionFile("C:\\Users\\Dave\\Saved Games\\DCS.openbeta\\Missions\\F14 Booking Test.miz", (parsedMiz) => {
            parseMissionFile("missions\\example.miz", (parsedMiz) => {
                console.log(parsedMiz);
                let insData = new Object(req.body);
                insData.parsedMiz = parsedMiz;
                res.send(parsedMiz);
            });
        })
        app.post('/api/admin/publishMission', function (req, res, next) {
            console.log(req.body);
            parseMissionFile(req.body.missionFile, (parsedMiz) => {
                console.log(parsedMiz);

                let insData = new Object(req.body);
                insData.missionInputData.MissionDateandTime = new Date(insData.missionInputData.MissionDateandTime);
                insData.parsedMiz = parsedMiz;


                mongoConn((dbo) => {
                    dbo.collection("missions").insertOne(insData, (err, dbRes) => {
                        if (err) serverError(err);
                        else {
                            res.send(insData);
                            console.log("PUblished mission ", insData);
                        }
                    })
                });
            });
        })
        app.get('/api/admin/removeMission', function (req, res, next) {
            const missionId = req.query.mission_id;
            mongoConn((dbo) => {
                dbo.collection("missions").deleteOne({ _id: ObjectID(missionId) }, (err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        res.send(missionId);
                        console.log("Removed mission ", missionId);
                    }
                })
            });
        })
        app.get("/api/admin/checkInstallUpdate", (req, res, next) => {
            res.send({ status: "Ok" });
            checkUpdates(true);
        })
        app.get("/api/admin/restartApplication", (req, res, next) => {
            res.send({ status: "Ok" });
            restartProcess(req.query.delay ? req.query.delay : 0, 0);
        })
        /*app.get("/api/contextMenuActions", (req, res, next) => {
            const parm = req.query;
            switch(parm.context.action){
                case '':
                    
                    break;
                default:
                    res.sendStatus(400);
                    break;
            }
            restartProcess(req.query.delay ? req.query.delay : 0, 0);
        })*/
        app.get('/api/admin/setPriority', function (req, res, next) {
            const parm = req.query;

            mongoConn((dbo) => {
                //log(req.query);

                let findStr = "parsedMiz." + parm.sideColor + "." + parm.flight + ".units." + parm.inflightNumber;
                let update = findStr + ".priority";

                dbo.collection("missions").updateOne({ _id: ObjectID(parm.missionId) }, { $set: { [update]: parseValue(parm.customContext.priority) } }, (err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        res.send({ priority: parm.customContext.priority })
                        wssBroadcast({ action: "priority", value: parseValue(parm.customContext.priority), slotData: parm })
                    }
                })
            });
        })
        app.get('/api/admin/setAttribute', function (req, res, next) {
            const parm = req.query;

            mongoConn((dbo) => {
                //log(req.query);

                let findStr = "parsedMiz." + parm.sideColor + "." + parm.flight + ".units." + parm.inflightNumber;
                let update = findStr + "." + parm.customContext.attr;

                dbo.collection("missions").updateOne({ _id: ObjectID(parm.missionId) }, { $set: { [update]: parseValue(parm.customContext.value) } }, (err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        res.send({ priority: parm.customContext.priority })
                        wssBroadcast({ action: "attribute", attr: parm.customContext.attr, value: parseValue(parm.customContext.value), slotData: parm })
                    }
                })
            });
        })

        app.get('/api/admin/getForumGroups', function (req, res, next) {
            mysqlConn((con) => {
                //const query = "SELECT DISTINCT rank_title FROM " + config.forum.db_table_prefix + "ranks; SELECT DISTINCT group_name FROM " + config.forum.db_table_prefix + "groups";
                const query = "SELECT DISTINCT group_name FROM " + config.forum.db_table_prefix + "groups";
                con.query(query, function (err, dbRes) {
                    if (err) serverError(err);
                    /*con.query(query, function (err, dbRes2) {
                        if (err) serverError(err);
                    });*/
                    for (let g of dbRes) if (config.forum.authorized_groups.includes(g.group_name)) g.selected = true;
                    res.send(dbRes)
                });
            })
        })
        app.post('/api/login', (req, res, next) => {
            const parm = req.body;
            //log(parm);
            mysqlConn((con) => {
                //con.query("SELECT user_password FROM forums_users LIMIT 1", function (err, result, fields) {
                //const query = "SELECT user_id, username, user_email, user_password, group_name, rank_title FROM " + config.forum.db_table_prefix + "users LEFT JOIN " + config.forum.db_table_prefix + "groups ON (" + config.forum.db_table_prefix + "users.group_id = " + config.forum.db_table_prefix + "groups.group_id) LEFT JOIN " + config.forum.db_table_prefix + "ranks ON (" + config.forum.db_table_prefix + "users.user_rank = " + config.forum.db_table_prefix + "ranks.rank_id) WHERE (username_clean = \"" + parm.Username.toLowerCase() + "\")";
                const query = "SELECT user_id, username, user_email, user_password, group_name, rank_title FROM " + config.forum.db_table_prefix + "users LEFT JOIN " + config.forum.db_table_prefix + "groups ON (" + config.forum.db_table_prefix + "users.group_id = " + config.forum.db_table_prefix + "groups.group_id) LEFT JOIN " + config.forum.db_table_prefix + "ranks ON (" + config.forum.db_table_prefix + "users.user_rank = " + config.forum.db_table_prefix + "ranks.rank_id) WHERE (username_clean = \"" + parm.Username.toLowerCase() + "\" OR user_email = \"" + parm.Username + "\")";
                //log(query);
                con.query(query, function (err, result, fields) {
                    if (err) serverError(err);
                    if (result[0]) {
                        console.log("Result: ", result[0]);
                        verifyArgon2(result[0].user_password, parm.Password, (val) => {
                            if (val) {
                                const sessDurationMS = config.other.session_duration_hours * 60 * 60 * 1000;
                                let userDt = result[0];
                                userDt.login_date = new Date();
                                userDt.session_expiration = new Date(Date.now() + sessDurationMS);
                                delete userDt.user_password;
                                let error;
                                do {
                                    error = false;
                                    userDt.token = randomString();
                                    mongoConn((dbo) => {
                                        dbo.collection("sessions").findOne({ token: userDt.token }, (err, dbRes) => {
                                            if (err) res.sendStatus(500);
                                            else if (dbRes == null) {
                                                dbo.collection("sessions").insertOne(userDt, (err, dbRes) => {
                                                    if (err) res.sendStatus(500);
                                                    else {
                                                        res.cookie("stok", userDt.token, { expires: userDt.session_expiration })
                                                        res.cookie("uid", userDt.user_id, { expires: userDt.session_expiration })
                                                        res.send({ status: "login_ok", userDt: userDt });
                                                    }
                                                })
                                            } else {
                                                error = true;
                                            }
                                        })
                                    })
                                } while (error);
                            } else {
                                res.send({ status: "wrong_credentials" });
                                //res.sendStatus(401)
                            }
                        })
                    } else {
                        res.send({ status: "wrong_credentials" });
                    }
                });
            })
        })
        app.use('/api/logout', (req, res, next) => {
            res.clearCookie("stok")
            res.clearCookie("uid")
            mongoConn((dbo) => {
                dbo.collection("sessions").remove({ token: req.userSession.token }, (err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        res.send("logout_ok");
                        //log("DB Res ", dbRes);
                    }
                })
            });
        })
        app.get('/api/getVersion', (req, res, next) => {
            res.send(versionN);
        })
        app.get('/api/getAllMissions/:sel?/:mission_id?', function (req, res, next) {
            const missionId = req.params.mission_id;
            let find = req.params.sel == "m" ? { _id: ObjectID(missionId) } : {};
            let specificMission = req.params.sel == "m" && req.params.mission_id;
            const recordsLimit = req.params.recordsLimit ? req.params.recordsLimit : 10;
            const parm = req.query;
            const dateNow = new Date();

            if (!parm.showAll && !specificMission) find["missionInputData.MissionDateandTime"] = { $gt: dateNow };
            console.log(dateNow, find);
            // (new Date(dbRes.missionInputData.MissionDateandTime) - dateNow > 0)
            mongoConn((dbo) => {
                dbo.collection("missions").find(find, { projection: { missionInputData: 1, _id: 1 } }).sort({ "missionInputData.MissionDateandTime": -1 }).limit(recordsLimit).toArray((err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        res.send(dbRes);
                        //log("DB Res ", dbRes);
                    }
                })
            });
        })
        app.get('/api/getMissionDetails', function (req, res, next) {
            const parm = req.query;
            if (parm.missionId) {
                mongoConn((dbo) => {
                    dbo.collection("missions").findOne(ObjectID(parm.missionId), { projection: { parsedMiz: 1 } }, (err, dbRes) => {
                        if (err) serverError(err);
                        else {
                            res.send(dbRes);
                            //log("DB Res ", dbRes);
                        }
                    })
                });
            } else {
                res.send({})
            }
        })

        app.get('/api/getAppName', function (req, res, next) {
            res.send(config.app_personalization.name);
        })
        app.get('/api/getAppPersonalization', function (req, res, next) {
            res.send(config.app_personalization);
        })

        app.get('/api/bookMission', (req, res, next) => {
            const parm = req.query;

            mongoConn((dbo) => {
                //log(req.query);

                let findStr = "parsedMiz." + parm.sideColor + "." + parm.flight + ".units." + parm.inflightNumber;
                let update = findStr + ".player";
                let updateUserId = findStr + ".user_id";
                //log(update);

                let playerName = req.userSession.username;
                let userId = req.userSession.user_id;

                dbo.collection("missions").findOne(ObjectID(parm.missionId), { projection: { missionInputData: 1, [findStr]: 1 } }, (err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        let slot = dbRes.parsedMiz[parm.sideColor][parm.flight].units[parm.inflightNumber];
                        let dateNow = new Date();
                        const canBook = (!slot.user_id || slot.user_id == -1)
                            && !slot.reserved
                            && (new Date(dbRes.missionInputData.MissionDateandTime) - dateNow > 0)
                            && (dbRes.missionInputData["authGroups-" + parm.sideColor].includes(req.userSession.group_name) || !(dbRes.missionInputData["authGroups-blue"] && dbRes.missionInputData["authGroups-red"]) || isAdmin(req))
                        if (canBook) {
                            dbo.collection("missions").updateOne({ _id: ObjectID(parm.missionId) }, { $set: { [update]: playerName, [updateUserId]: userId } }, (err, dbRes) => {
                                if (err) serverError(err);
                                else {
                                    res.send({ playerName: playerName })
                                    wssBroadcast({ action: "booking", slotData: parm, playerName: playerName })
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
                //log(req.query);

                let findStr = "parsedMiz." + parm.sideColor + "." + parm.flight + ".units." + parm.inflightNumber;
                let update = findStr + ".player";
                let updateUserId = findStr + ".user_id";
                //log(update);

                let playerName = "";
                let userId = req.userSession.user_id;

                dbo.collection("missions").findOne(ObjectID(parm.missionId), { projection: { missionInputData: 1, [findStr]: 1 } }, (err, dbRes) => {
                    if (err) serverError(err);
                    else {
                        let slot = dbRes.parsedMiz[parm.sideColor][parm.flight].units[parm.inflightNumber];
                        let dateNow = new Date();
                        const canBook = slot.player
                            && slot.player != ""
                            && (new Date(dbRes.missionInputData.MissionDateandTime) - dateNow > 0)
                            && ((slot.user_id && slot.user_id == userId) || (isAdmin(req) && parm.customContext.action == "force_dismission"))
                        if (canBook) {
                            dbo.collection("missions").updateOne({ _id: ObjectID(parm.missionId) }, { $set: { [update]: playerName, [updateUserId]: -1 } }, (err, dbRes) => {
                                if (err) serverError(err);
                                else {
                                    res.send({ removed: "ok", playerName: "" })
                                    wssBroadcast({ action: "dissmission", slotData: parm })
                                }
                            })
                        } else {
                            res.sendStatus(403);
                        }
                    }
                })
            });
        })

        app.get("/api/getMenuUrls", (req, res, next) => {
            let retUrls = [
                {
                    name: "Dashboard",
                    url: "/",
                    order: 0,
                    type: "redirect"
                }
            ];
            if (req.userSession) {
                retUrls = retUrls.concat([
                    {
                        name: "Logout",
                        url: "/api/logout",
                        order: 10,
                        type: "request"
                    }
                ])
            } else {
                retUrls = retUrls.concat([
                    {
                        name: "Login",
                        url: "/api/login",
                        order: 9,
                        type: "request"
                    }
                ])
            }
            if (isAdmin(req)) {
                retUrls = retUrls.concat([
                    {
                        name: "Publishment",
                        url: "/publishment",
                        order: 1,
                        type: "redirect"
                    },
                    {
                        name: "Update (Cur: V" + versionN + ")",
                        url: "/api/admin/checkInstallUpdate",
                        order: 50,
                        type: "request"
                    }
                ])
            }
            res.send(retUrls);
        })

        app.get("/api/getContextMenu", (req, res, next) => {
            let ret = [
                {
                    name: "Book Mission",
                    action: "tg_bookmission",
                    url: "/api/bookMission",
                    method: "get",
                    order: 0
                }
            ];
            if (isAdmin(req)) {
                ret = ret.concat([
                    {
                        name: "Priority ON",
                        action: "tg_priority",
                        priority: true,
                        url: "/api/admin/setPriority",
                        order: 5
                    },
                    {
                        name: "Priority OFF",
                        action: "tg_priority",
                        priority: false,
                        url: "/api/admin/setPriority",
                        order: 6
                    },
                    {
                        name: "Reserve ON",
                        action: "tg_reserve",
                        attr: "reserved",
                        value: true,
                        url: "/api/admin/setAttribute",
                        order: 6
                    },
                    {
                        name: "Reserve OFF",
                        action: "tg_reserve",
                        attr: "reserved",
                        value: false,
                        url: "/api/admin/setAttribute",
                        order: 6
                    },
                    {
                        name: "Force Dismission",
                        action: "force_dismission",
                        url: "/api/dismissMission",
                        method: "get",
                        order: 15
                    }
                ])
            }
            res.send(ret);
        })
        app.use((req, res, next) => {
            res.redirect("/");
        });

        function mongoConn(connCallback) {
            let url = "mongodb://" + config.database.mongo.host + ":" + config.database.mongo.port;
            let dbName = config.database.mongo.database;
            let client = MongoClient.connect(url, function (err, db) {
                if (err) serverError(err);
                var dbo = db.db(dbName);
                connCallback(dbo);
            });
        }
        function mysqlConn(connCallback) {
            var con = mysql.createConnection(config.database.mysql);
            con.connect(function (err) {
                if (err) serverError(err);
                connCallback(con);
            });
        }
        function getSession(req, res, callback = null) {
            //const parm = Object.keys(req.query).length > 0 ? req.query : req.body;
            const parm = req.cookies;
            if (parm.stok != null && parm.stok != "") {
                mongoConn((dbo) => {
                    dbo.collection("sessions").findOne({ token: parm.stok }, (err, dbRes) => {
                        if (err) res.sendStatus(500);
                        else if (dbRes != null) {
                            //log(dbRes);
                            req.userSession = dbRes
                            if (callback)
                                callback();
                        } else {
                            if (callback)
                                callback();
                            /*const path = req.originalUrl.replace(/\?.*$/, '');
                            callback();
                            switch (path) {
                                case "/api/getAppName":
                                case "/api/login":
                                    callback();
                                    break;

                                default:
                                    res.send({ status: "login_required" });
                                    break;
                            }*/
                        }
                    })
                })
            } else {
                callback();
            }
        }
        function requireLogin(req, res, callback = null) {
            const parm = Object.keys(req.query).length > 0 ? req.query : req.body;
            const path = getReqPath(req);
            console.log("path", path);
            switch (path) {
                case "/api/getAppName":
                case "/api/getAppPersonalization":
                case "/api/login":
                case "/api/getAllMissions/m/":
                case "/api/getMissionDetails":
                    callback();
                    break;

                default:
                    console.log("\nREQ: " + path + "\nSESSION: ", req.userSession, "\nPARM: ", parm);
                    if (!req.userSession) res.send({ status: "login_required" });
                    else callback();//authorizeDCSUsers(req, res, callback)
                    break;
            }
        }
        function authorizeDCSUsers(req, res, next) {
            const parm = Object.keys(req.query).length > 0 ? req.query : req.body;
            const path = getReqPath(req);

            switch (path) {
                case "/api/bookMission":
                    if (isDCSUser(req)) next();
                    else res.sendStatus(401)
                    break;

                default:
                    next();
                    break;
            }
        }
        function getReqPath(req, callback) {
            const fullPath = req.originalUrl.replace(/\?.*$/, '')
            let basePaths = [
                "/api/getAllMissions/m/"
            ];
            for (let val of basePaths) {
                if (fullPath.startsWith(val)) return val
            }
            return fullPath
        }
        function authorizeAdmin(req, res, next) {
            if (isAdmin(req))
                next();
            else res.redirect("/");
        }
        function forceHTTPS(req, res, next) {
            if (config.other.force_https) {
                if (req.headers['x-forwarded-proto'] !== 'https')
                    return res.redirect('https://' + req.headers.host + req.url);
                else
                    return next();
            } else
                return next();
        }

        function checkUpdates(downloadInstallUpdate = false, callback = null) {
            let releasesUrl = "https://api.github.com/repos/fantinodavide/DCS_MissionBooking/releases";
            let curDate = new Date();
            console.log("Current version: ", versionN, "\n > Checking for updates", curDate.toLocaleString());
            axios
                .get(releasesUrl)
                .then(res => {
                    const gitResData = res.data[0];
                    /*mongoConn((dbo) => {
                        dbo.collection("releases").findOne(res.data[0], (err, dbRes) => {
                            if (!dbRes) {
                            }
                        })
                    })*/
                    const checkV = gitResData.tag_name.toUpperCase().replace("V", "").split(".");
                    const versionSplit = versionN.toString().split(".");
                    if (parseInt(versionSplit[0]) < parseInt(checkV[0]) || parseInt(versionSplit[1]) < parseInt(checkV[1])) {
                        console.log("Update found: " + gitResData.tag_name, gitResData.name);
                        //if (updateFoundCallback) updateFoundCallback();
                        if (downloadInstallUpdate) downloadLatestUpdate(gitResData);
                    } else {
                        console.log(" > No updates found. Proceding startup");
                        if (callback) callback();
                    }
                })
                .catch(err => {
                    console.error(" > Couldn't check for updates. Proceding startup");
                    if (callback) callback();
                })
        }

        function downloadLatestUpdate(gitResData) {
            console.log("Downloading update: " + gitResData.tag_name, gitResData.name);
            const url = gitResData.zipball_url;
            const dwnDir = path.resolve(__dirname, 'tmp_update');//, 'gitupd.zip')
            const dwnFullPath = path.resolve(dwnDir, 'gitupd.zip')

            if (!fs.existsSync(dwnDir)) fs.mkdirSync(dwnDir);

            const writer = fs.createWriteStream(dwnFullPath)
            axios({
                method: "get",
                url: url,
                responseType: "stream"
            }).then((response) => {
                response.data.pipe(writer);
            });

            writer.on('finish', (res) => {
                if (server) server.close();
                installLatestUpdate(dwnDir, dwnFullPath, gitResData);
            })
            writer.on('error', (err) => {
                console.error(err);
            })
        }

        function installLatestUpdate(dwnDir, dwnFullPath, gitResData) {
            const zip = new StreamZip({
                file: dwnFullPath,
                storeEntries: true
            });
            zip.on('ready', () => {
                const gitZipDir = Object.values(zip.entries())[0].name;
                console.log(gitZipDir);
                zip.extract(gitZipDir, __dirname, (err, res) => {
                    console.log(" > Extracted", res, "files");
                    if (fs.rmSync(dwnDir, { recursive: true })) console.log(`${dwnDir} folder deleted`);
                    //log(" > Deleting temporary folder");
                    console.log(" > Restart in 5 seconds");
                    restartProcess();
                    /*const destinationPath = path.resolve(__dirname, "test");
                    const currentPath = path.resolve(dwnDir, gitZipDir);

                    fs.rename(currentPath, destinationPath, function (err) {
                        if (err) {
                            throw err
                        } else {
                            log("Successfully moved the file!");
                        }
                    });*/
                    zip.close();
                });
            });
        }

        function isAdmin(req) {
            return (req.userSession && ((config.forum.admin_ranks && config.forum.admin_ranks.includes(req.userSession.rank_title)) || req.userSession.username == "JetDave"));
        }

        function isDCSUser(req) {
            return isAdmin(req) || (req.userSession && (config.forum.authorized_groups.includes(req.userSession.group_name)))
        }
    } else {
    }
}

function restartProcess(delay = 5000, code = 0) {
    process.on("exit", function () {
        console.log("Process terminated");
        require("child_process").spawn(process.argv.shift(), process.argv, {
            cwd: process.cwd(),
            detached: true,
            stdio: "inherit"
        });
    });
    setTimeout(() => {
        process.exit(code);
    }, delay)
}

function getDateFromEpoch(ep) {
    let d = new Date(0);
    d.setUTCSeconds(ep);
    return d;
}

function serverError(err) {
    res.sendStatus(500);
    console.error(err);
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
    //log(listMission);
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

        //log(flights)
        //log(JSON.stringify(flights))
        //fs.writeFileSync("./output.json", JSON.stringify(flights, null, "\t"));

        success(flights);
        zip.close()
    });
}
function getMissionFlightsFromString(missionFile) {
    let flightsReturn = {};
    for (let o of missionFile.body[0].init[0].fields) {
        let key = LUAGetKey(o);
        if (key == "coalition") {
            for (let o2 of o.value.fields) {
                let side = LUAGetKey(o2);
                if (!flightsReturn[side]) flightsReturn[side] = {};

                for (let o3 of o2.value.fields) {
                    if (LUAGetKey(o3) == "country") {
                        for (let c of o3.value.fields) {
                            for (let o4 of c.value.fields) {
                                if (["plane", "helicopter"].includes(LUAGetKey(o4))) {
                                    for (let fGroups of o4.value.fields[0].value.fields) {
                                        //log(fGroups);
                                        //flights[side].push();
                                        let fInfo = {};
                                        let fName = "";
                                        for (let i = 0; i < 2; i++) {
                                            for (let o5 of fGroups.value.fields) {
                                                let o5Key = LUAGetKey(o5);

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
                                                            let repeats = 0;
                                                            for (let _rep = -1; _rep < repeats; _rep++) {
                                                                let slotN = aircraft.key.value;
                                                                let arrayIndex = length(flightsReturn[side][fName]["units"]) + 1//flightsReturn[side][fName]["units"].length;//aircraft.key.value * 1;
                                                                if (!arrayIndex) arrayIndex = 1;
                                                                if (repeats > 0) {
                                                                    //arrayIndex += slotN + (_rep + 2);
                                                                    //slotN = slotN + (_rep + 2) / 10;
                                                                    slotN = slotN + "-" + (_rep + 2);
                                                                }
                                                                flightsReturn[side][fName]["units"][arrayIndex] = {}
                                                                flightsReturn[side][fName]["units"][arrayIndex].slotN = slotN;
                                                                flightsReturn[side][fName]["units"][arrayIndex].multicrew = repeats > 0;
                                                                for (let aInfo of aircraft.value.fields) {
                                                                    let aSubInfoKey = aInfo.key.raw.replace(/\"/g, '');
                                                                    let aSubInfoValue;
                                                                    try {
                                                                        aSubInfoValue = aInfo.value.raw.replace(/\"/g, '');
                                                                    } catch (error) {
                                                                        aSubInfoValue = aInfo.value;
                                                                    }
                                                                    if (aSubInfoKey == "type") {
                                                                        flightsReturn[side][fName].aircraftType = aSubInfoValue;
                                                                        if (repeats == 0) {
                                                                            if (aSubInfoValue.includes("F-14")) repeats = 1;
                                                                            else if (aSubInfoValue.includes("UH-1H")) repeats = 3;
                                                                            else if (aSubInfoValue.includes("Mi-24")) repeats = 1;
                                                                            else if (aSubInfoValue.includes("SA342")) repeats = 1;
                                                                            else if (aSubInfoValue.includes("AH-64")) repeats = 1;
                                                                            else if (aSubInfoValue.includes("Mosquito")) repeats = 1;
                                                                        }
                                                                    } else if (aSubInfoKey == "callsign") flightsReturn[side][fName].callsign = parseCallsign(aSubInfoValue.fields);

                                                                    if (["type", "unitid", "name", "parking", "skill"].includes(aSubInfoKey)) {
                                                                        //log((arrayIndex + ") " + aSubInfoKey + ": "), aSubInfoValue)
                                                                        if (aSubInfoKey == "callsign") {
                                                                            //console.log("callsign", aSubInfoValue);
                                                                            flightsReturn[side][fName]["units"][arrayIndex][aSubInfoKey] = aSubInfoValue.name;
                                                                        } else if (aSubInfoKey == "skill") {
                                                                            flightsReturn[side][fName].skill = aSubInfoValue;
                                                                        } else
                                                                            flightsReturn[side][fName]["units"][arrayIndex][aSubInfoKey] = aSubInfoValue;
                                                                    }
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
function LUAGetKey(key) {
    return LUARealString(key.key.raw ? key.key.raw : key.key.name);
}

function LUARealString(txt) {
    return txt.replace(/\"/g, '')
}
function parseCallsign(callsignLua) {
    let ret = { name: "", group: 1, pilot: 1 };
    console.log(callsignLua);
    //console.log("callsign", callsignLua, ret);
    if (callsignLua) {
        let csparts = [];

        csparts[1]=getLUAArrElm(callsignLua, 1)
        csparts[2]=getLUAArrElm(callsignLua, 2)
        csparts[3]=getLUAArrElm(callsignLua, 3)
        csparts["name"]=getLUAArrElm(callsignLua, "name")
        //console.log(csparts)

        if (csparts[2]) ret.group = csparts[2].value.value ? csparts[2].value.value : 1;
        if (csparts[3]) ret.pilot = csparts[3].value.value ? csparts[3].value.value : 1;
        if (csparts["name"]) ret.name = LUARealString(csparts["name"].value.raw).replace(ret.group.toString() + ret.pilot.toString(), "");
    }
    return ret;
}
function getLUAArrElm(luaArr, indx) {
    for(let value of luaArr){
        if (LUARealString(value.key.raw) == indx || value.key.value == indx) return value
    }
    return null;
}
function toUpperFirstChar(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function testDB(config) {
    var con = mysql.createConnection(config.database.mysql);

    con.connect(function (err) {
        if (err) console.log("MySQL Test: ", err);
        console.log("Connected!");
        //con.query("SELECT username, user_password, user_email FROM " + config.forum.db_table_prefix + "users WHERE username = 'JetDave' LIMIT 10 ", function (err, result, fields) {
        con.query("SELECT user_id, username, user_email, user_password, group_name, rank_title FROM forums_users LEFT JOIN forums_groups ON (forums_users.group_id = forums_groups.group_id AND forums_users.username) LEFT JOIN forums_ranks ON (forums_users.user_rank = forums_ranks.rank_id) WHERE username = 'Iggy' OR username = 'Webber'", function (err, result, fields) {
            if (err) console.log("MySQL Test: ", err);
            console.log("Result: ", result);
            //fs.writeFileSync("users_Iggy_Webber.json", JSON.stringify(result, null, "\t"));
        });
    });
}
/*
function testMongoDB(config) {
    let url = "mongodb://" + config.database.mongo.host + ":" + config.database.mongo.port;
    let dbName = config.database.mongo._database;
    let client = MongoClient.connect(url, function (err, db) {
        if (err) res.sendStatus(500);
        var dbo = db.db(dbName);
 
        dbo.collection("missions").find({}).toArray(function (err, result) {
            if (err) res.sendStatus(500);
            log(result);
            //let res = await dbo.collection("test").insertOne({})
            db.close();
        });
 
    });
}
function testMySQL(config){
    mysqlConn.
}
*/

function initConfigFile() {
    let emptyConfFile = {
        http_server: {
            bind_ip: "0.0.0.0",
            port: 80,
            https_port: 443
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
                host: "127.0.0.1",
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
            name: "DCS Mission Booking",
            favicon: "",
            accentc_color: "#f60",
            dashboard: {
                preBookingConfirmation: false,
                preBookingConfText: "Confirm Booking?"
            }
        },
        forum: {
            db_table_prefix: "forums_",
            admin_ranks: [
                "Site Admin",
                "Moderatore"
            ],
            authorized_groups: [
                "SIG DCS",
                "SIGnew DCS"
            ]
        },
        other: {
            force_https: false,
            automatic_updates: true,
            update_check_interval_seconds: 3600,
            session_duration_hours: 168
        }
    }
    /*var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });*/

    //let q = await rl.question("Which is the app personalized name? Leave empty to keep the default name: " + emptyConfFile.app_personalization.name + "\n> ");

    if (!fs.existsSync("conf.json")) {
        console.log("Configuration file created, set your parameters and rerun \"node start\".\nTerminating execution...");
        fs.writeFileSync("conf.json", JSON.stringify(emptyConfFile, null, "\t"));
        process.exit(1)
        return true;
    } else {
        const config = JSON.parse(fs.readFileSync("conf.json", "utf-8").toString());
        var config2 = { ...config }
        updateConfig(config2, emptyConfFile);
        fs.writeFileSync("conf.json", JSON.stringify(config2, null, "\t"));
    }
    return false;

}
function updateConfig(config, emptyConfFile) {
    for (let k in emptyConfFile) {
        //config[k] = emptyConfFile[k];
        //console.log(k, config[k]);
        const objType = Object.prototype.toString.call(emptyConfFile[k]);
        const parentObjType = Object.prototype.toString.call(emptyConfFile);
        if (config[k] == undefined || (config[k] && (parentObjType == "[object Array]" && !config[k].includes(emptyConfFile[k])))) {
            switch (objType) {
                case "[object Object]":
                    config[k] = {}
                    break;
                case "[object Array]":
                    config[k] = []
                    break;

                default:
                    //console.log("CONFIG:", config, "\nKEY:", k, "\nCONFIG_K:", config[k], "\nEMPTY_CONFIG_K:", emptyConfFile[k], "\nPARENT_TYPE:",parentObjType,"\n");
                    if (parentObjType == "[object Array]") config.push(emptyConfFile[k])
                    else config[k] = emptyConfFile[k]
                    break;
            }
        }
        if (typeof (emptyConfFile[k]) === "object") {
            updateConfig(config[k], emptyConfFile[k])
        }
    }
}
process.on('uncaughtException', function (err) {
    console.error("Uncaught Exception", err.message, err.stack)
    if (++errorCount >= 20) {
        console.error("Too many errors occurred during the current run. Terminating execution...");
        restartProcess(0, 0);
    }
})
function randomString(size = 64) {
    return crypto
        .randomBytes(size)
        .toString('base64')
        .slice(0, size)
}
function extendLogging() {
    const consoleLogBackup = console.log;
    const consoleErrorBackup = console.error;
    console.log = (...params) => {
        consoleLogBackup(...params);
        logger.trace(...params)
    }
    console.error = (...params) => {
        consoleErrorBackup(...params);
        logger.error(...params)
    }
}
async function verifyArgon2(hash, comp, callback) {
    try {
        //let pwdCheck = argon2.verify("$argon2id$v=19$m=16,t=2,p=1$YWlqYW93ZGlqd2Fzdw$jgdVmVItY4EfwZTwJWr6OA", "password");
        let pwdCheck = argon2.verify(hash, comp)
        pwdCheck.then(callback)
    } catch (err) {
    }
}
function length(obj) {
    return Object.keys(obj).length;
}
function parseValue(str) {
    if (str === 'true') return true;
    else if (str === 'false') return false;
    else return str
}

function wssBroadcast(data, ws = null) {
    console.log("WS Broadcast", data);
    wss.clients.forEach(function each(client) {
        if ((client !== ws) && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}
