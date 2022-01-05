const fs = require("fs");
const StreamZip = require('node-stream-zip');
const LUA = require('luaparse');
var express = require('express');
var app = express();

var mizFile = "missions/Iraq_Insurgent_Strike_Multiplayer.miz";
const zip = new StreamZip({
    file: mizFile,
    storeEntries: true
});

let flights = {};
zip.on('ready', () => {
    let missionLua = zip.entryDataSync('mission').toString('utf8');
    let missionFileString = LUA.parse(missionLua);

    function getMissionFlightsFromString(missionFile) {
        let flightsReturn = {};
        for (let o of missionFile.body[0].init[0].fields) {
            let key = o.key.raw.replaceAll("\"", "");
            if (key == "coalition") {
                for (let o2 of o.value.fields) {
                    let side = o2.key.raw.replaceAll("\"", "");
                    if (!flightsReturn[side]) flightsReturn[side] = {};
    
                    for (let o3 of o2.value.fields) {
                        if (o3.key.raw.replaceAll("\"", "") == "country") {
                            for (let c of o3.value.fields) {
                                for (let o4 of c.value.fields) {
                                    if (o4.key.raw.replaceAll("\"", "") == "plane") {
                                        for (let fGroups of o4.value.fields[0].value.fields) {
                                            //console.log(fGroups);
                                            //flights[side].push();
                                            let fInfo = {};
                                            let fName = "";
                                            for (let i = 0; i < 2; i++) {
                                                for (let o5 of fGroups.value.fields) {
                                                    let o5Key = o5.key.raw.replaceAll("\"", "");
                                                    let valRaw = o5.value.raw ? o5.value.raw.replaceAll("\"", "") : "";
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
                                                                    let aSubInfoKey = aInfo.key.raw.replaceAll("\"", "");
                                                                    let aSubInfoValue;
                                                                    try {
                                                                        aSubInfoValue = aInfo.value.raw.replaceAll("\"", "");
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
    
    flights = getMissionFlightsFromString(missionFileString)

    console.log(flights)
    console.log(JSON.stringify(flights))
    fs.writeFileSync("./output.json", JSON.stringify(flights));

    zip.close()
    
    var server = app.listen(80, function () {
        var host = server.address().address
        var port = server.address().port
    
        console.log("\nWebserver istening at http://%s:%s", host, port)
    })
});

app.get('/', function (req, res, next) {
    //next();
    res.send(JSON.stringify(flights));
})
app.get('/api/getFlights', function (req, res, next) {
    console.log("GET=> ",req.query)
    console.log("POST=> ",req.body)
    res.send(JSON.stringify(flights));
})