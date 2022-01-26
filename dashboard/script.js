$(document).ready(() => {
    send_request("/api/getAppName", "GET", null, (data) => {
        if (data != "") {
            $("#appName").html(data)
            $("title").html(data)
        }
    })

    send_request("/api/getAllMissions", "GET", null, (data) => {
        const jsonData = JSON.parse(data);
        for (let m of jsonData) {
            let missionDate = new Date(m.missionInputData.MissionDateandTime)
            $("#missionSelection").append("<option value=\"" + m._id + "\">" + toUpperFirstChar(m.missionInputData.MissionName) + ": " + missionDate.toLocaleDateString("it-IT", {}) + "</option>");
        }

        $("#missionSelection").on("change", (e) => {
            const missionId = e.target.value;
            send_request("/api/getMissionDetails", "GET", { missionId: missionId }, (data) => {
                const jsonData = JSON.parse(data);
                console.log(jsonData);
                //console.log(jsonData.parsedMiz.blue);
                $("#tableContainer").find("table").remove();
                createTable(jsonData.parsedMiz, jsonData._id, "blue/red")
                //createTable(jsonData.parsedMiz.red, "red")

            });
        })
    })
})

function createTable(parsedMiz, missionId, sideFilter) {
    let table = $("<table><tr><th>Flight</th><th>Task</th><th>Slots</th></tr></table>");
    //$(".mainContainer")
    Object.entries(parsedMiz).forEach(entry => {
        const [k, v] = entry;
        let sideColor = k;
        if (sideFilter.includes(k)) {
            Object.entries(v).forEach(entry => {
                const [k, v] = entry;
                const showAI = false;
                if (v.units[1].skill == "Client" || showAI) {
                    table.append("<tr class='rowSpacer'></tr>");
                    const unitsCount = count(v.units);
                    let flightName = k;
                    let row = $("<tr><td rowspan=\"" + unitsCount + "\"><div class='flightContainer'><span class='aircraftType'>" + v.aircraftType + "</span><span class='groupName'>" + k + "</span></div></td></tr>");
                    table.append(row);
                    Object.entries(v).forEach(entry => {
                        const [k, v] = entry;
                        if (["task"].includes(k)) {
                            if (!isObject(v)) {
                                let td = $("<td class='colId " + k + " " + v + "' rowspan=\"" + unitsCount + "\">" + v + "</td>");
                                row.append(td);
                            }
                        }
                    });

                    Object.entries(v.units).forEach(entry => {
                        const [k, v] = entry;
                        let td = $("<td>" + v + "</td>");
                        let playerBooked = v.player && v.player != "";
                        let tdElm = $("<td class='playerContainer " + sideColor + " " + (playerBooked ? "booked" : "") + "'><span class='inFlightNumber'>" + k + "</span><span class='playerNameContainer'>" + (playerBooked ? v.player : "") + "</span></td>");
                        if (!playerBooked) {
                            tdElm.on("click", () => {
                                let par = { missionId: missionId, sideColor: sideColor, flight: flightName, spec: v, inflightNumber: k };
                                //console.log(par);
                                tdElm.toggleClass("booked");
                                send_request("/api/bookMission", "GET", par, (data) => {
                                    const jsonData = JSON.parse(data);
                                    tdElm.find(".playerNameContainer").html(jsonData.playerName);
                                    
                                    tdElm.off("click");
                                    tdElm.on("click", () => {
                                        send_request("/api/dismissMission", "GET", par, (data) => {
                                            
                                        })
                                    })
                                })
                            })
                        }
                        if (k == 1)
                            row.append(tdElm);
                        else {
                            let tmpTr = $("<tr></tr>")
                            tmpTr.append(tdElm);
                            table.append(tmpTr);
                        }
                    });

                }
            })
        }
    })
    $("#tableContainer").append(table);
}
function recursiveCellCreator(k, v) {
    if (!isObject(v)) {
        let td = $("<td rowspan=\"" + unitsCount + "\">" + v + "</td>");
        row.append(td);
    } else {
        console.log(k, v);
        Object.entries(v).forEach(entry => {
            const [k, v] = entry;
            let td = $("<td>" + v + "</td>");
            row.append(td);
        });
    }
}

function count(obj) { return Object.keys(obj).length; }
function isObject(elm) { return (typeof elm === 'object' && elm !== null) }


